import assert from 'node:assert/strict';
import test from 'node:test';
import { getAllCityHotels } from '../src/utils/hotelPagination.js';

test('loads city pages in ordered batches with bounded concurrency', async () => {
  const requests = [];
  let activeRequests = 0;
  let maximumActiveRequests = 0;
  const items = await getAllCityHotels(async ({ page }) => {
    requests.push(page);
    activeRequests += 1;
    maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
    await new Promise((resolve) => setTimeout(resolve, page === 1 ? 0 : 2));
    activeRequests -= 1;
    return {
      items: [`hotel-${page}`],
      pagination: { totalPages: 7 },
    };
  }, {
    city: 'Mumbai',
    limit: 100,
    concurrency: 3,
  });

  assert.deepEqual(requests, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(maximumActiveRequests, 3);
  assert.deepEqual(items, [
    'hotel-1',
    'hotel-2',
    'hotel-3',
    'hotel-4',
    'hotel-5',
    'hotel-6',
    'hotel-7',
  ]);
});
