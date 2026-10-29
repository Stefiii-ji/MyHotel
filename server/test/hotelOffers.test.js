import assert from 'node:assert/strict';
import test from 'node:test';
import { createHotelHandlers, serializeHotel } from '../src/controllers/hotelController.js';
import { createAmadeusHotelOffersAdapter } from '../src/services/amadeusHotelOffersAdapter.js';
import { createHotelOffersService } from '../src/services/hotelOffersService.js';
import { hotelOfferQuerySchema } from '../src/validators/hotelValidators.js';

const hotelId = '507f1f77bcf86cd799439011';
const providerHotelId = 'MCLONGHM';
function dateOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const query = {
  checkIn: dateOffset(10),
  checkOut: dateOffset(12),
  guests: 2,
  currency: 'INR',
};

function providerHotel() {
  return {
    _id: hotelId,
    name: 'Example Inn',
    source: 'openstreetmap',
    sourceId: 'node/123',
    providerHotelIds: { amadeus: providerHotelId },
  };
}

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, async json() { return data; } };
}

function offerResponse({
  hotelId: responseHotelId = providerHotelId,
  offers = [{
    price: {
      total: '1200.00',
      currency: 'INR',
      taxes: [
        { amount: '100.00', code: 'GST', included: true },
        { amount: '25.00', code: 'SERVICE_CHARGE', included: false },
      ],
    },
    room: { typeEstimated: { category: 'STANDARD_ROOM' }, description: { text: 'Queen room' } },
    boardType: 'BREAKFAST',
    policies: { cancellation: { type: 'FREE_CANCELLATION', deadline: '2027-01-08T23:59:00' } },
    bookingUrl: 'https://booking.example/stay',
  }],
} = {}) {
  return {
    data: [{
      hotel: { hotelId: responseHotelId },
      offers,
    }],
  };
}

function createAmadeusFetch(offerFetch) {
  const requestedUrls = [];
  const fetchImpl = async (input, options) => {
    const url = new URL(String(input));
    requestedUrls.push({ url, options });
    if (url.pathname === '/v1/security/oauth2/token') {
      return response(200, { access_token: 'test-access-token', expires_in: 1800 });
    }
    return offerFetch(url, options);
  };
  return { fetchImpl, requestedUrls };
}

test('validates real offer dates, date order, supported currency, and guest bounds', () => {
  assert.equal(hotelOfferQuerySchema.safeParse(query).success, true);
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const pastDate = yesterday.toISOString().slice(0, 10);
  for (const invalid of [
    { ...query, checkIn: '2027-02-29' },
    { ...query, checkIn: pastDate, checkOut: query.checkIn },
    { ...query, checkOut: query.checkIn },
    { ...query, guests: 0 },
    { ...query, guests: 9 },
    { ...query, currency: 'XXX' },
    { ...query, unexpected: 'value' },
  ]) {
    assert.equal(hotelOfferQuerySchema.safeParse(invalid).success, false);
  }
});

test('normalizes confirmed Amadeus offers and requests the documented test endpoint parameters', async () => {
  const { fetchImpl, requestedUrls } = createAmadeusFetch(async () => response(200, offerResponse()));
  const adapter = createAmadeusHotelOffersAdapter({
    mode: 'test',
    clientId: 'client',
    clientSecret: 'secret',
    fetchImpl,
    now: () => new Date('2027-01-01T00:00:00.000Z'),
  });
  const result = await adapter.getOffers(providerHotelId, query);

  assert.equal(result.availability, 'available');
  assert.equal(result.provider, 'amadeus');
  assert.equal(result.mode, 'test');
  assert.deepEqual(result.offer, {
    totalStayPrice: 1200,
    currency: 'INR',
    nightlyAverage: 600,
    taxes: [{ amount: 100, currency: 'INR', code: 'GST', included: true }],
    fees: [{ amount: 25, currency: 'INR', code: 'SERVICE_CHARGE', included: false }],
    room: { category: 'STANDARD_ROOM', description: 'Queen room' },
    boardType: 'BREAKFAST',
    cancellation: {
      type: 'FREE_CANCELLATION',
      deadline: '2027-01-08T23:59:00',
      amount: null,
      numberOfNights: null,
    },
    bookingUrl: 'https://booking.example/stay',
  });
  const offerRequest = requestedUrls[1];
  assert.equal(offerRequest.url.origin, 'https://test.api.amadeus.com');
  assert.equal(offerRequest.url.pathname, '/v3/shopping/hotel-offers');
  assert.equal(offerRequest.url.searchParams.get('hotelIds'), providerHotelId);
  assert.equal(offerRequest.url.searchParams.get('adults'), '2');
  assert.equal(offerRequest.url.searchParams.get('checkInDate'), query.checkIn);
  assert.equal(offerRequest.url.searchParams.get('checkOutDate'), query.checkOut);
  assert.equal(offerRequest.url.searchParams.get('currency'), 'INR');
});

test('returns typed unavailable results for missing credentials and unmapped inventory without calling a provider', async () => {
  let calls = 0;
  const adapter = createAmadeusHotelOffersAdapter({
    mode: 'test',
    fetchImpl: async () => { calls += 1; },
  });
  const service = createHotelOffersService({ provider: 'amadeus', mode: 'test', adapter });
  const noCredentials = await service.getOffers(providerHotel(), query);
  assert.equal(noCredentials.availability, 'unavailable');
  assert.equal(noCredentials.reason, 'credentials_missing');

  const configuredAdapter = {
    isConfigured: true,
    async getOffers() { calls += 1; },
  };
  const mappedService = createHotelOffersService({
    provider: 'amadeus',
    mode: 'test',
    adapter: configuredAdapter,
  });
  const unmapped = await mappedService.getOffers({ _id: hotelId }, query);
  assert.equal(unmapped.reason, 'inventory_not_mapped');
  assert.equal(calls, 0);

  const disabled = await createHotelOffersService({
    provider: 'none',
    mode: 'test',
  }).getOffers(providerHotel(), query);
  assert.equal(disabled.reason, 'provider_disabled');
});

test('does not confuse MongoDB hotel IDs with Amadeus inventory IDs or expose mappings', async () => {
  let requestedHotelId;
  const service = createHotelOffersService({
    provider: 'amadeus',
    mode: 'test',
    adapter: {
      isConfigured: true,
      async getOffers(id) {
        requestedHotelId = id;
        return { availability: 'unavailable', reason: 'no_availability' };
      },
    },
  });
  await service.getOffers(providerHotel(), query);
  assert.equal(requestedHotelId, providerHotelId);
  assert.notEqual(requestedHotelId, hotelId);
  assert.equal('providerHotelIds' in serializeHotel(providerHotel()), false);
});

test('reports no availability, malformed responses, and mismatched provider inventory safely', async () => {
  const cases = [
    [async () => response(200, { data: [] }), 'no_availability'],
    [async () => response(200, { data: 'invalid' }), 'malformed_response'],
    [async () => response(200, offerResponse({ hotelId: 'OTHERHOTEL' })), 'inventory_mismatch'],
    [async () => response(200, offerResponse({ offers: [{ price: { total: 'not-a-price', currency: 'INR' } }] })), 'malformed_response'],
    [async () => ({ ok: true, status: 200, async json() { throw new Error('invalid JSON'); } }), 'malformed_response'],
  ];

  for (const [offerFetch, reason] of cases) {
    const { fetchImpl } = createAmadeusFetch(offerFetch);
    const adapter = createAmadeusHotelOffersAdapter({
      mode: 'test',
      clientId: 'client',
      clientSecret: 'secret',
      fetchImpl,
    });
    const result = await adapter.getOffers(providerHotelId, query);
    assert.equal(result.availability, 'unavailable');
    assert.equal(result.reason, reason);
    assert.equal(result.offer, null);
  }
});

test('handles provider timeouts and rate limits without leaking upstream details', async () => {
  const diagnostics = [];
  const timeoutAdapter = createAmadeusHotelOffersAdapter({
    mode: 'test',
    clientId: 'client',
    clientSecret: 'secret',
    timeoutMs: 5,
    fetchImpl: async () => new Promise(() => {}),
    logger: (entry) => diagnostics.push(entry),
  });
  assert.equal((await timeoutAdapter.getOffers(providerHotelId, query)).reason, 'upstream_timeout');

  const { fetchImpl } = createAmadeusFetch(async () => response(429, {}));
  const rateLimited = createAmadeusHotelOffersAdapter({
    mode: 'test',
    clientId: 'client',
    clientSecret: 'secret',
    fetchImpl,
    logger: (entry) => diagnostics.push(entry),
  });
  const result = await rateLimited.getOffers(providerHotelId, query);
  assert.equal(result.reason, 'rate_limited');
  assert.equal(JSON.stringify(result).includes('secret'), false);

  const bodyTimeoutFetch = createAmadeusFetch(async () => ({
    ok: true,
    status: 200,
    async json() { return new Promise(() => {}); },
  }));
  const bodyTimeout = createAmadeusHotelOffersAdapter({
    mode: 'test',
    clientId: 'client',
    clientSecret: 'secret',
    timeoutMs: 5,
    fetchImpl: bodyTimeoutFetch.fetchImpl,
    logger: (entry) => diagnostics.push(entry),
  });
  assert.equal((await bodyTimeout.getOffers(providerHotelId, query)).reason, 'upstream_timeout');
  assert.deepEqual(
    diagnostics.map((entry) => JSON.parse(entry).errorCategory),
    ['upstream_timeout', 'rate_limited', 'upstream_timeout'],
  );
  assert.equal(diagnostics.join('\n').includes('secret'), false);
});

test('rejects invalid provider hotel codes and displays the actual returned currency', async () => {
  let calls = 0;
  const invalidMapping = createAmadeusHotelOffersAdapter({
    mode: 'test',
    clientId: 'client',
    clientSecret: 'secret',
    fetchImpl: async () => { calls += 1; },
  });
  assert.equal((await invalidMapping.getOffers('MCLONGH', query)).reason, 'inventory_not_mapped');
  assert.equal(calls, 0);

  const { fetchImpl } = createAmadeusFetch(async () =>
    response(200, offerResponse({
      offers: [{
        price: { total: '60.00', currency: 'EUR' },
      }],
    })),
  );
  const adapter = createAmadeusHotelOffersAdapter({
    mode: 'test',
    clientId: 'client',
    clientSecret: 'secret',
    fetchImpl,
  });
  const result = await adapter.getOffers(providerHotelId, query);
  assert.equal(result.availability, 'available');
  assert.equal(result.offer.currency, 'EUR');
  assert.equal(result.offer.nightlyAverage, 30);
});

test('caches only confirmed offers, expires them, and coalesces identical requests', async () => {
  let calls = 0;
  let now = new Date('2027-01-01T00:00:00.000Z');
  let release;
  const adapter = {
    isConfigured: true,
    async getOffers() {
      calls += 1;
      await new Promise((resolve) => { release = resolve; });
      return {
        availability: 'available',
        offer: { totalStayPrice: 100, currency: 'INR' },
      };
    },
  };
  const service = createHotelOffersService({
    provider: 'amadeus',
    mode: 'test',
    adapter,
    cacheTtlMs: 1000,
    now: () => now,
  });
  const first = service.getOffers(providerHotel(), query);
  const second = service.getOffers(providerHotel(), query);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  release();
  await Promise.all([first, second]);
  await service.getOffers(providerHotel(), query);
  assert.equal(calls, 1);

  now = new Date(now.getTime() + 1001);
  const expired = service.getOffers(providerHotel(), query);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
  release();
  await expired;
});

test('does not cache unavailable provider responses', async () => {
  let calls = 0;
  const service = createHotelOffersService({
    provider: 'amadeus',
    mode: 'test',
    adapter: {
      isConfigured: true,
      async getOffers() {
        calls += 1;
        return { availability: 'unavailable', reason: 'no_availability' };
      },
    },
    cacheTtlMs: 60_000,
  });
  await service.getOffers(providerHotel(), query);
  await service.getOffers(providerHotel(), query);
  assert.equal(calls, 2);
});

test('validates offer route inputs and returns a safe typed unavailable hotel result', async () => {
  let findCount = 0;
  const Hotel = {
    findById(id) {
      findCount += 1;
      assert.equal(id, hotelId);
      return { lean: async () => providerHotel() };
    },
  };
  const hotelOffersService = {
    async getOffers(hotel, parameters) {
      assert.equal(hotel.providerHotelIds.amadeus, providerHotelId);
      assert.deepEqual(parameters, query);
      return {
        provider: 'amadeus',
        availability: 'unavailable',
        mode: 'test',
        reason: 'inventory_not_mapped',
        retrievedAt: '2027-01-01T00:00:00.000Z',
        offer: null,
      };
    },
  };
  const handlers = createHotelHandlers({
    Hotel,
    isDatabaseReady: () => true,
    hotelOffersService,
  });
  const res = { body: null, json(value) { this.body = value; } };
  let error;

  await handlers.getHotelOffers(
    { params: { id: hotelId }, query: { ...query, guests: '2' } },
    res,
    (value) => { error = value; },
  );
  assert.equal(error, undefined);
  assert.equal(res.body.item.availability, 'unavailable');
  assert.equal(findCount, 1);

  for (const request of [
    { params: { id: 'not-an-object-id' }, query },
    { params: { id: hotelId }, query: { ...query, checkIn: '2027-02-30' } },
  ]) {
    await handlers.getHotelOffers(request, { json() {} }, (value) => { error = value; });
    assert.equal(error.statusCode, 400);
  }
  assert.equal(findCount, 1);
});

test('reports missing hotel records and unavailable database without offer lookups', async () => {
  let lookups = 0;
  const handlers = createHotelHandlers({
    Hotel: { findById() { return { lean: async () => null }; } },
    isDatabaseReady: () => true,
    hotelOffersService: { async getOffers() { lookups += 1; } },
  });
  let error;
  await handlers.getHotelOffers(
    { params: { id: hotelId }, query },
    { json() {} },
    (value) => { error = value; },
  );
  assert.equal(error.statusCode, 404);
  assert.equal(lookups, 0);

  const unavailableHandlers = createHotelHandlers({
    Hotel: { findById() { assert.fail('Database should not be queried'); } },
    isDatabaseReady: () => false,
    hotelOffersService: { async getOffers() { lookups += 1; } },
  });
  await unavailableHandlers.getHotelOffers(
    { params: { id: hotelId }, query },
    { json() {} },
    (value) => { error = value; },
  );
  assert.equal(error.statusCode, 503);
  assert.equal(lookups, 0);
});
