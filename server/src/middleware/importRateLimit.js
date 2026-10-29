import { createRateLimit } from './rateLimit.js';

export function createImportRateLimit({ intervalMs = 60000, now = Date.now } = {}) {
  return createRateLimit({
    limit: 1,
    intervalMs,
    message: 'Please wait before refreshing OpenStreetMap data again',
    keyForRequest: () => 'hotel-import',
    now,
  });
}
