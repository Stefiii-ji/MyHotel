import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import test from 'node:test';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { createAdminHotelRouter } from '../src/routes/adminHotelRoutes.js';

const importToken = 'test-import-token-'.padEnd(32, 'x');
const hotelElement = {
  type: 'node',
  id: 7351,
  lat: 19.04,
  lon: 72.92,
  tags: { name: 'Gateway Stay', tourism: 'hotel' },
};

async function withImportApi(options, run) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/admin/hotels',
    createAdminHotelRouter({
      Hotel: {
        async bulkWrite(operations) {
          options.operations?.push(...operations);
          return options.writeResult ?? {
            upsertedCount: operations.length,
            modifiedCount: 0,
            matchedCount: 0,
          };
        },
      },
      importToken,
      overpassUrl: 'https://primary.example/api/interpreter',
      isDatabaseReady: options.isDatabaseReady ?? (() => true),
      fetchImpl: options.fetchImpl ?? (async () => ({
        ok: true,
        headers: new Headers(),
        async text() { return JSON.stringify({ elements: [hotelElement] }); },
      })),
    }),
  );
  app.use(errorHandler);

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}/api/admin/hotels/refresh`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

async function postImport(url, { token = importToken, area = 'Mumbai' } = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token === null ? {} : { 'x-import-token': token }),
    },
    body: JSON.stringify({ area }),
  });
  return { response, body: await response.json() };
}

test('mounts the authenticated import at the API path and returns import statistics', async () => {
  const operations = [];
  await withImportApi({ operations }, async (url) => {
    const { response, body } = await postImport(url);
    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      imported: 1,
      processed: 1,
      inserted: 1,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      failed: 0,
      area: 'Mumbai',
      attribution: '© OpenStreetMap contributors, available under ODbL.',
    });
    assert.equal(operations[0].updateOne.filter.source, 'openstreetmap');
    assert.equal(operations[0].updateOne.filter.sourceId, 'node/7351');
    assert.equal(JSON.stringify(body).includes(importToken), false);
  });
});

test('rejects missing and incorrect import tokens', async () => {
  await withImportApi({}, async (url) => {
    const missing = await postImport(url, { token: null });
    const invalid = await postImport(url, { token: 'wrong-token' });
    assert.equal(missing.response.status, 401);
    assert.equal(invalid.response.status, 401);
    assert.equal(missing.body.message, 'Valid import credentials are required');
  });
});

test('validates import areas and requires database readiness', async () => {
  await withImportApi({}, async (url) => {
    const invalidArea = await postImport(url, { area: 'Pune' });
    assert.equal(invalidArea.response.status, 400);
    assert.match(invalidArea.body.message, /supported import area/);
  });

  await withImportApi({ isDatabaseReady: () => false }, async (url) => {
    const unavailable = await postImport(url);
    assert.equal(unavailable.response.status, 503);
  });
});

test('preserves rate limiting on repeated imports', async () => {
  let upstreamRequests = 0;
  await withImportApi({
    fetchImpl: async () => {
      upstreamRequests += 1;
      return {
        ok: true,
        headers: new Headers(),
        async text() { return JSON.stringify({ elements: [hotelElement] }); },
      };
    },
  }, async (url) => {
    const first = await postImport(url);
    const second = await postImport(url);
    assert.equal(first.response.status, 200);
    assert.equal(second.response.status, 429);
    assert.equal(upstreamRequests, 1);
  });
});

test('returns a safe HTTP error after the Overpass mirrors fail', async () => {
  const requestedUrls = [];
  await withImportApi({
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      return { ok: false, status: 503 };
    },
  }, async (url) => {
    const { response, body } = await postImport(url);
    assert.equal(response.status, 502);
    assert.equal(body.status, 'error');
    assert.equal(body.message, 'OpenStreetMap mirrors failed; no import was completed.');
    assert.equal(JSON.stringify(body).includes('primary.example'), false);
    assert.equal(requestedUrls.length, 4);
    assert.equal(new Set(requestedUrls).size, 4);
  });
});

test('returns a deliberate 504 response when every Overpass mirror times out', async () => {
  await withImportApi({
    fetchImpl: async () => {
      throw Object.assign(new Error('upstream timed out'), { name: 'TimeoutError' });
    },
  }, async (url) => {
    const { response, body } = await postImport(url);
    assert.equal(response.status, 504);
    assert.deepEqual(body, {
      status: 'error',
      message: 'OpenStreetMap mirrors timed out; no import was completed.',
    });
  });
});

test('reports inserted, updated, unchanged, skipped, and processed counts', async () => {
  await withImportApi({
    writeResult: { upsertedCount: 1, modifiedCount: 1, matchedCount: 2 },
    fetchImpl: async () => ({
      ok: true,
      headers: new Headers(),
      async text() {
        return JSON.stringify({
          elements: [
            hotelElement,
            { ...hotelElement, tags: { ...hotelElement.tags, name: 'Duplicate identity' } },
            { ...hotelElement, id: 7352, tags: { ...hotelElement.tags, name: 'Second stay' } },
            { ...hotelElement, id: 7353, tags: { tourism: 'hotel' } },
          ],
        });
      },
    }),
  }, async (url) => {
    const { response, body } = await postImport(url, { area: 'Navi Mumbai' });
    assert.equal(response.status, 200);
    assert.equal(body.processed, 4);
    assert.equal(body.imported, 2);
    assert.equal(body.inserted, 1);
    assert.equal(body.updated, 1);
    assert.equal(body.unchanged, 1);
    assert.equal(body.skipped, 2);
    assert.equal(body.failed, 0);
    assert.equal(body.area, 'Navi Mumbai');
  });
});
