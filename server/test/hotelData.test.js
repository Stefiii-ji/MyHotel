import assert from 'node:assert/strict';
import test from 'node:test';
import { createHotelHandlers } from '../src/controllers/hotelController.js';
import Hotel from '../src/models/Hotel.js';
import { createAdminImportAuth } from '../src/middleware/adminImportAuth.js';
import { createImportRateLimit } from '../src/middleware/importRateLimit.js';
import { escapeRegex } from '../src/utils/regex.js';
import {
  buildOverpassQuery,
  normalizeOsmElement,
  refreshOsmHotels,
} from '../src/services/osmHotelService.js';

const osmElement = {
  type: 'node',
  id: 12345,
  lat: 19.04,
  lon: 73.02,
  tags: {
    name: 'Example Inn',
    tourism: 'hotel',
    'addr:suburb': 'Vashi',
    'addr:street': 'Example Road',
    'addr:housenumber': '12',
    internet_access: 'wlan',
  },
};

function createResponse() {
  return {
    body: null,
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test('normalizes named OSM accommodation without fabricating ratings, prices, or photos', () => {
  const record = normalizeOsmElement(osmElement, 'Navi Mumbai');

  assert.equal(record.name, 'Example Inn');
  assert.equal(record.source, 'openstreetmap');
  assert.equal(record.sourceId, 'node/12345');
  assert.equal(record.locality, 'Vashi');
  assert.equal(record.city, 'Navi Mumbai');
  assert.equal(record.address, '12 Example Road');
  assert.deepEqual(record.imageUrls, []);
  assert.equal('rating' in record, false);
  assert.equal('pricePerNight' in record, false);
  assert.deepEqual(record.amenities, ['internet_access: wlan']);
});

test('normalizes way center coordinates and ignores incomplete or unsupported OSM records', () => {
  const way = normalizeOsmElement(
    { ...osmElement, type: 'way', center: { lat: 19.1, lon: 72.9 }, lat: undefined, lon: undefined },
    'Mumbai',
  );
  assert.equal(way.latitude, 19.1);
  assert.equal(way.longitude, 72.9);
  assert.equal(normalizeOsmElement({ ...osmElement, tags: { tourism: 'hotel' } }, 'Mumbai'), null);
  assert.equal(normalizeOsmElement({ ...osmElement, tags: { ...osmElement.tags, tourism: 'cafe' } }, 'Mumbai'), null);
  assert.equal(normalizeOsmElement({ ...osmElement, lat: 100 }, 'Mumbai'), null);
});

test('Hotel schema requires normalized fields and uniquely indexes the OSM identity pair', () => {
  const identityIndex = Hotel.schema.indexes().find(
    ([keys, options]) => keys.source === 1 && keys.sourceId === 1 && options.unique,
  );
  assert.ok(identityIndex);

  const invalid = new Hotel({ source: 'openstreetmap', sourceId: 'node/1' });
  const validationError = invalid.validateSync();
  assert.ok(validationError.errors.name);
  assert.ok(validationError.errors.latitude);
  assert.ok(validationError.errors.longitude);
  assert.ok(validationError.errors.accommodationType);
});

test('builds a bounded Overpass query only for supported areas', () => {
  const query = buildOverpassQuery('Navi Mumbai');
  assert.match(query, /\[out:json\]\[timeout:25\]/);
  assert.match(query, /tourism/);
  assert.match(query, /18\.75,72\.96,19\.15,73\.15/);
  assert.throws(() => buildOverpassQuery('Anywhere'), { statusCode: 400 });
});

test('deduplicates source IDs before upserting records', async () => {
  let operations;
  const Hotel = {
    async bulkWrite(ops) {
      operations = ops;
      return { upsertedCount: ops.length };
    },
  };
  const fetchImpl = async () => ({
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    async text() {
      return JSON.stringify({ elements: [osmElement, { ...osmElement, tags: { ...osmElement.tags, name: 'Updated Inn' } }] });
    },
  });

  const result = await refreshOsmHotels({
    area: 'Navi Mumbai',
    Hotel,
    overpassUrl: 'https://overpass.example/api/interpreter',
    fetchImpl,
  });

  assert.deepEqual(result, {
    imported: 1,
    processed: 2,
    inserted: 1,
    updated: 0,
    unchanged: 0,
    skipped: 1,
    failed: 0,
    area: 'Navi Mumbai',
  });
  assert.equal(operations.length, 1);
  assert.equal(operations[0].updateOne.filter.sourceId, 'node/12345');
  assert.equal(operations[0].updateOne.update.$setOnInsert.sourceId, 'node/12345');
  assert.equal('sourceId' in operations[0].updateOne.update.$set, false);
  assert.equal(operations[0].updateOne.update.$set.name, 'Updated Inn');
  assert.equal(operations[0].updateOne.upsert, true);
});

test('posts the query to the configured primary mirror and logs the successful mirror safely', async () => {
  const requests = [];
  const logs = [];
  const result = await refreshOsmHotels({
    area: 'Mumbai',
    Hotel: { async bulkWrite() {} },
    overpassUrl: 'https://primary.example/api/interpreter',
    logger(message) { logs.push(JSON.parse(message)); },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        headers: new Headers(),
        async text() { return JSON.stringify({ elements: [osmElement] }); },
      };
    },
  });

  assert.equal(result.imported, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://primary.example/api/interpreter');
  assert.equal(requests[0].options.method, 'POST');
  assert.match(requests[0].options.headers['content-type'], /application\/x-www-form-urlencoded/);
  assert.equal(
    new URLSearchParams(requests[0].options.body).get('data'),
    buildOverpassQuery('Mumbai'),
  );
  assert.ok(requests[0].options.signal instanceof AbortSignal);
  const mirrorSuccess = logs.find(({ event }) => event === 'osm_overpass_mirror_succeeded');
  assert.equal(mirrorSuccess.hostname, 'primary.example');
  assert.equal(Number.isFinite(mirrorSuccess.elapsedMs), true);
  assert.equal(logs[0].event, 'osm_import_started');
  assert.equal(logs.at(-1).event, 'osm_import_finished');
  assert.equal(Number.isFinite(logs.at(-1).elapsedMs), true);
});

test('falls through from the configured primary mirror to the next unique mirror', async () => {
  const urls = [];
  const logs = [];
  const result = await refreshOsmHotels({
    area: 'Mumbai',
    Hotel: { async bulkWrite() {} },
    overpassUrl: 'https://overpass-api.de/api/interpreter',
    logger(message) { logs.push(JSON.parse(message)); },
    fetchImpl: async (url) => {
      urls.push(url);
      if (urls.length === 1) return { ok: false, status: 503 };
      return {
        ok: true,
        headers: new Headers(),
        async text() { return JSON.stringify({ elements: [osmElement] }); },
      };
    },
  });

  assert.equal(result.imported, 1);
  assert.deepEqual(urls, [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ]);
  assert.deepEqual(
    logs
      .filter(({ event }) => ['osm_overpass_request_failed', 'osm_overpass_mirror_succeeded'].includes(event))
      .map(({ event, hostname, errorCategory }) => ({
        event,
        hostname,
        errorCategory,
      })),
    [
    {
      event: 'osm_overpass_request_failed',
      hostname: 'overpass-api.de',
      errorCategory: 'http_503',
    },
    {
      event: 'osm_overpass_mirror_succeeded',
      hostname: 'overpass.private.coffee',
      errorCategory: undefined,
    },
    ],
  );
});

test('tries the next mirror after HTTP 406 and 429 responses', async () => {
  for (const status of [406, 429]) {
    const urls = [];
    const result = await refreshOsmHotels({
      area: 'Mumbai',
      Hotel: { async bulkWrite() {} },
      overpassUrl: 'https://overpass-api.de/api/interpreter',
      logger() {},
      fetchImpl: async (url) => {
        urls.push(url);
        if (urls.length === 1) return { ok: false, status };
        return {
          ok: true,
          headers: new Headers(),
          async text() { return JSON.stringify({ elements: [osmElement] }); },
        };
      },
    });

    assert.equal(result.imported, 1);
    assert.equal(urls.length, 2);
    assert.equal(urls[1], 'https://overpass.private.coffee/api/interpreter');
  }
});

test('tries the next mirror after a network error', async () => {
  const urls = [];
  const result = await refreshOsmHotels({
    area: 'Mumbai',
    Hotel: { async bulkWrite() {} },
    overpassUrl: 'https://overpass-api.de/api/interpreter',
    logger() {},
    fetchImpl: async (url) => {
      urls.push(url);
      if (urls.length === 1) throw new TypeError('network failure');
      return {
        ok: true,
        headers: new Headers(),
        async text() { return JSON.stringify({ elements: [osmElement] }); },
      };
    },
  });

  assert.equal(result.imported, 1);
  assert.equal(urls.length, 2);
  assert.equal(urls[1], 'https://overpass.private.coffee/api/interpreter');
});

test('fails safely after trying each distinct mirror once', async () => {
  const urls = [];
  const result = await refreshOsmHotels({
    area: 'Mumbai',
    Hotel: { async bulkWrite() { assert.fail('Should not write after all mirrors fail'); } },
    overpassUrl: 'https://overpass.kumi.systems/api/interpreter',
    logger() {},
    fetchImpl: async (url) => {
      urls.push(url);
      return { ok: false, status: 503 };
    },
  }).then(
    () => assert.fail('Expected all mirrors to fail'),
    (error) => error,
  );

  assert.equal(result.statusCode, 502);
  assert.match(result.message, /All configured OpenStreetMap Overpass mirrors failed/);
  assert.deepEqual(urls, [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ]);
  assert.equal(new Set(urls).size, urls.length);
});

test('retries network timeouts per mirror with a bounded 15-second default', async () => {
  const urls = [];
  const signals = [];
  const logs = [];
  const result = await refreshOsmHotels({
    area: 'Mumbai',
    Hotel: { async bulkWrite() { assert.fail('Should not write after timeouts'); } },
    overpassUrl: 'https://overpass-api.de/api/interpreter',
    timeoutMs: 5,
    logger(message) { logs.push(JSON.parse(message)); },
    fetchImpl: (url, { signal }) => new Promise((_resolve, reject) => {
      urls.push(url);
      signals.push(signal);
      signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('request timeout'), { name: 'TimeoutError' }));
      }, { once: true });
    }),
  }).then(
    () => assert.fail('Expected mirror timeouts'),
    (error) => error,
  );

  assert.equal(result.statusCode, 504);
  assert.match(result.message, /mirrors timed out/);
  assert.equal(urls.length, 3);
  assert.equal(new Set(urls).size, 3);
  assert.ok(signals.every((signal) => signal.aborted));
  const failures = logs.filter(({ event }) => event === 'osm_overpass_request_failed');
  assert.equal(failures.length, 3);
  assert.ok(failures.every(({ errorCategory }) => errorCategory === 'timeout'));
  assert.equal(logs.at(-1).event, 'osm_import_failed');
  assert.equal(logs.at(-1).statusCode, 504);
  const attempts = logs.filter(({ event }) => event === 'osm_overpass_attempt_started');
  const completedAttempts = logs.filter(({ event }) => event === 'osm_overpass_attempt_finished');
  assert.equal(attempts.length, 3);
  assert.equal(completedAttempts.length, 3);
  assert.ok(completedAttempts.every(({ elapsedMs }) => Number.isFinite(elapsedMs)));
  assert.ok(logs.every(({ importId }) => importId === logs[0].importId));
});

test('returns zero imports for a valid empty result without writing records', async () => {
  let writeCount = 0;
  const result = await refreshOsmHotels({
    area: 'Mumbai',
    Hotel: { async bulkWrite() { writeCount += 1; } },
    overpassUrl: 'https://primary.example/api/interpreter',
    fetchImpl: async () => ({
      ok: true,
      headers: new Headers(),
      async text() { return JSON.stringify({ elements: [] }); },
    }),
  });

  assert.deepEqual(result, {
    imported: 0,
    processed: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
    area: 'Mumbai',
  });
  assert.equal(writeCount, 0);
});

test('repeated imports use the same stable OSM identity for idempotent upserts', async () => {
  const filters = [];
  const Hotel = {
    async bulkWrite(operations) {
      filters.push(...operations.map(({ updateOne }) => updateOne.filter));
    },
  };
  const fetchImpl = async () => ({
    ok: true,
    headers: new Headers(),
    async text() { return JSON.stringify({ elements: [osmElement] }); },
  });
  const options = {
    area: 'Mumbai',
    Hotel,
    overpassUrl: 'https://primary.example/api/interpreter',
    fetchImpl,
    logger() {},
  };

  await refreshOsmHotels(options);
  await refreshOsmHotels(options);

  assert.deepEqual(filters, [
    { source: 'openstreetmap', sourceId: 'node/12345' },
    { source: 'openstreetmap', sourceId: 'node/12345' },
  ]);
});

test('rejects Overpass failures, malformed responses, and oversized payloads', async () => {
  const options = {
    area: 'Mumbai',
    Hotel: { async bulkWrite() { assert.fail('Should not write invalid response'); } },
    overpassUrl: 'https://overpass.example/api/interpreter',
    logger() {},
  };
  await assert.rejects(
    refreshOsmHotels({ ...options, fetchImpl: async () => ({ ok: false, status: 400 }) }),
    { statusCode: 502 },
  );
  await assert.rejects(
    refreshOsmHotels({
      ...options,
      fetchImpl: async () => ({
        ok: true,
        headers: new Headers({ 'content-length': '6000000' }),
        async text() { return '{}'; },
      }),
    }),
    { statusCode: 502 },
  );
  await assert.rejects(
    refreshOsmHotels({
      ...options,
    fetchImpl: async () => ({
      ok: true,
      headers: new Headers(),
      async text() { return 'not-json'; },
    }),
    }),
    { statusCode: 502 },
  );
  await assert.rejects(
    refreshOsmHotels({
    ...options,
    fetchImpl: async () => ({
      ok: true,
      headers: new Headers(),
      async text() { return '{}'; },
    }),
    }),
    { statusCode: 502 },
  );
  const timeoutLogs = [];
  await assert.rejects(
    refreshOsmHotels({
      ...options,
      timeoutMs: 1,
      logger(message) { timeoutLogs.push(JSON.parse(message)); },
      fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
        }, { once: true });
      }),
    }),
    { statusCode: 504 },
  );
  const failures = timeoutLogs.filter(({ event }) => event === 'osm_overpass_request_failed');
  assert.equal(failures.length, 4);
  assert.ok(failures.every(({ hostname, errorCategory }) =>
    [
      'overpass.example',
      'overpass-api.de',
      'overpass.private.coffee',
      'overpass.kumi.systems',
    ].includes(hostname) &&
      errorCategory === 'timeout',
  ));
});

test('falls through after a transient upstream failure and logs safe diagnostics', async () => {
  let calls = 0;
  const logs = [];
  const result = await refreshOsmHotels({
    area: 'Mumbai',
    Hotel: {
      async bulkWrite(operations) {
        assert.equal(operations.length, 1);
      },
    },
    overpassUrl: 'https://overpass.example/api/interpreter',
    logger(message) {
      logs.push(JSON.parse(message));
    },
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 503 };
      return {
        ok: true,
        headers: new Headers(),
        async text() {
          return JSON.stringify({ elements: [osmElement] });
        },
      };
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.imported, 1);
  const firstFailure = logs.find(({ event }) => event === 'osm_overpass_request_failed');
  assert.equal(firstFailure.hostname, 'overpass.example');
  assert.equal(firstFailure.errorCategory, 'http_503');
  assert.equal(firstFailure.attempt, 1);
  const mirrorSuccess = logs.find(({ event }) => event === 'osm_overpass_mirror_succeeded');
  assert.equal(mirrorSuccess.event, 'osm_overpass_mirror_succeeded');
  assert.ok(logs.every((entry) => !('headers' in entry) && !('token' in entry)));
});

test('does not retry non-retryable upstream HTTP errors', async () => {
  let calls = 0;
  await assert.rejects(
    refreshOsmHotels({
      area: 'Mumbai',
      Hotel: { async bulkWrite() { assert.fail('Should not write after upstream error'); } },
      overpassUrl: 'https://overpass.example/api/interpreter',
      logger() {},
      fetchImpl: async () => {
        calls += 1;
        return { ok: false, status: 400 };
      },
    }),
    (error) => {
      assert.equal(error.statusCode, 502);
      assert.match(error.message, /non-retryable HTTP 400/);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test('applies city, locality, type, and pagination to hotel queries', async () => {
  let filter;
  let skip;
  let limit;
  const Hotel = {
    find(query) {
      filter = query;
      return {
        sort() { return this; },
        skip(value) { skip = value; return this; },
        limit(value) { limit = value; return this; },
        async lean() { return [{ _id: 'abc', name: 'Example Inn', source: 'openstreetmap' }]; },
      };
    },
    async countDocuments() { return 3; },
  };
  const handlers = createHotelHandlers({ Hotel, isDatabaseReady: () => true });
  const response = createResponse();
  let error;

  await handlers.listHotels(
    {
      query: {
        city: 'Mumbai',
        region: 'Maharashtra',
        locality: 'Band',
        type: 'hotel',
        page: '2',
        limit: '1',
      },
    },
    response,
    (value) => { error = value; },
  );

  assert.equal(error, undefined);
  assert.equal(filter.city.test('Mumbai'), true);
  assert.equal(filter.region.test('Maharashtra'), true);
  assert.equal(filter.locality.test('Bandra'), true);
  assert.equal(filter.accommodationType, 'hotel');
  assert.equal(skip, 1);
  assert.equal(limit, 1);
  assert.deepEqual(response.body.pagination, { page: 2, limit: 1, total: 3, totalPages: 3 });
  assert.equal(response.body.items[0].id, 'abc');
  assert.equal(response.body.attribution.source, 'OpenStreetMap contributors');
});

test('escapes special characters before constructing user-provided location filters', () => {
  const escaped = new RegExp(`^${escapeRegex('Mumbai (West)+')}$`, 'i');
  assert.equal(escaped.test('Mumbai (West)+'), true);
  assert.equal(escaped.test('Mumbai West'), false);
  assert.equal(escaped.test('Mumbai (West)++'), false);
});

test('returns validation and unavailable-database errors without querying MongoDB', async () => {
  let queryCount = 0;
  const handlers = createHotelHandlers({
    Hotel: { find() { queryCount += 1; }, countDocuments() { queryCount += 1; } },
    isDatabaseReady: () => false,
  });
  let validationError;
  await handlers.listHotels({ query: { limit: '500' } }, createResponse(), (error) => { validationError = error; });
  assert.equal(validationError.statusCode, 400);

  let databaseError;
  await handlers.listHotels({ query: {} }, createResponse(), (error) => { databaseError = error; });
  assert.equal(databaseError.statusCode, 503);
  assert.equal(queryCount, 0);
});

test('returns a hotel detail record with empty fields normalized and reports missing records', async () => {
  const document = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Example Inn',
    tags: new Map([['tourism', 'hotel']]),
    amenities: null,
    imageUrls: null,
  };
  let missing = false;
  const Hotel = {
    findById() {
      return { lean: async () => (missing ? null : document) };
    },
  };
  const handlers = createHotelHandlers({ Hotel, isDatabaseReady: () => true });
  const response = createResponse();
  await handlers.getHotel({ params: { id: document._id } }, response, assert.fail);
  assert.equal(response.body.item.id, document._id);
  assert.deepEqual(response.body.item.tags, { tourism: 'hotel' });
  assert.deepEqual(response.body.item.amenities, []);
  assert.deepEqual(response.body.item.imageUrls, []);

  missing = true;
  let notFound;
  await handlers.getHotel(
    { params: { id: document._id } },
    createResponse(),
    (error) => { notFound = error; },
  );
  assert.equal(notFound.statusCode, 404);
});

test('protects imports and rate limits refresh requests', () => {
  let passed = false;
  const auth = createAdminImportAuth('a'.repeat(32));
  createAdminImportAuth(undefined)({ get: () => 'ignored' }, {}, (error) => {
    assert.equal(error.statusCode, 503);
  });
  auth({ get: () => 'wrong' }, {}, (error) => { assert.equal(error.statusCode, 401); });
  auth({ get: () => 'a'.repeat(32) }, {}, (error) => { passed = !error; });
  assert.equal(passed, true);

  let now = 100000;
  const rateLimit = createImportRateLimit({ intervalMs: 60000, now: () => now });
  let rateError;
  rateLimit({}, {}, () => {});
  rateLimit({}, {}, (error) => { rateError = error; });
  assert.equal(rateError.statusCode, 429);
  now += 60001;
  rateLimit({}, {}, (error) => { assert.equal(error, undefined); });
});
