import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createServer } from 'node:http';
import { createHotelHandlers } from '../src/controllers/hotelController.js';
import Hotel from '../src/models/Hotel.js';
import { developmentHotelRecords, seedDevelopmentHotels } from '../src/services/developmentHotelSeeds.js';
import { createHotelRouter } from '../src/routes/hotelRoutes.js';

test('development sample records use the dedicated source and existing unique identity', async () => {
  const sourcePath = Hotel.schema.path('source');
  assert.ok(sourcePath.enumValues.includes('openstreetmap'));
  assert.ok(sourcePath.enumValues.includes('stayswipe_sample'));
  assert.equal(Hotel.schema.path('sourceId').options.immutable, true);
  assert.equal(Hotel.schema.path('isSampleData').instance, 'Boolean');
  assert.equal(developmentHotelRecords.length, 16);
  assert.equal(new Set(developmentHotelRecords.map(({ sourceId }) => sourceId)).size, 16);
  assert.equal(developmentHotelRecords.filter(({ city }) => city === 'Mumbai').length, 8);
  assert.equal(developmentHotelRecords.filter(({ city }) => city === 'Navi Mumbai').length, 8);
  assert.ok(developmentHotelRecords.every((record) =>
    record.source === 'stayswipe_sample' &&
    record.isSampleData === true &&
    record.name.startsWith('StaySwipe Demo Hotel ') &&
    record.tags.sampleNotice.includes('Fictional development sample') &&
    !('price' in record) &&
    !('rating' in record) &&
    !('availability' in record),
  ));

  const documents = new Map([[
    'openstreetmap:node/real-record',
    { source: 'openstreetmap', sourceId: 'node/real-record', name: 'Existing OSM record' },
  ]]);
  const HotelMock = {
    async bulkWrite(operations, options) {
      assert.equal(options.ordered, true);
      let upsertedCount = 0;
      for (const { updateOne } of operations) {
        assert.deepEqual(Object.keys(updateOne.filter).sort(), ['source', 'sourceId']);
        assert.equal(updateOne.filter.source, 'stayswipe_sample');
        assert.equal(updateOne.upsert, true);
        assert.deepEqual(Object.keys(updateOne.update), ['$setOnInsert']);
        const key = `${updateOne.filter.source}:${updateOne.filter.sourceId}`;
        if (!documents.has(key)) {
          documents.set(key, updateOne.update.$setOnInsert);
          upsertedCount += 1;
        }
      }
      return { upsertedCount };
    },
  };

  assert.deepEqual(await seedDevelopmentHotels(HotelMock), {
    records: 16,
    inserted: 16,
    alreadyPresent: 0,
  });
  assert.deepEqual(await seedDevelopmentHotels(HotelMock), {
    records: 16,
    inserted: 0,
    alreadyPresent: 16,
  });
  assert.equal(documents.size, 17);
  assert.equal(documents.get('openstreetmap:node/real-record').name, 'Existing OSM record');
});

test('hotel listing API returns explicitly marked sample records and accurate attribution', async () => {
  const app = express();
  const records = developmentHotelRecords.map((record, index) => ({
    ...record,
    _id: `sample-${index + 1}`,
  }));
  const HotelMock = {
    find(filter) {
      return {
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        async lean() {
          return records.filter((record) =>
            Object.entries(filter).every(([key, value]) =>
              value instanceof RegExp ? value.test(record[key]) : record[key] === value,
            ),
          );
        },
      };
    },
    async countDocuments(filter) {
      return records.filter((record) =>
        Object.entries(filter).every(([key, value]) =>
          value instanceof RegExp ? value.test(record[key]) : record[key] === value,
        ),
      ).length;
    },
  };
  app.use('/api/hotels', createHotelRouter(createHotelHandlers({
    Hotel: HotelMock,
    isDatabaseReady: () => true,
    hotelOffersService: { async getOffers() { assert.fail('Sample listings do not request offers'); } },
  })));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/hotels?city=Mumbai&page=1&limit=20`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.items.length, 8);
    assert.ok(body.items.every((item) =>
      item.city === 'Mumbai' &&
      item.source === 'stayswipe_sample' &&
      item.isSampleData === true,
    ));
    assert.equal(body.attribution.source, 'StaySwipe fictional development samples');
    assert.equal(body.attribution.url, null);
    assert.equal('price' in body.items[0], false);
    assert.equal('rating' in body.items[0], false);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
