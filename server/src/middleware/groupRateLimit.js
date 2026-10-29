import { createRateLimit } from './rateLimit.js';

export function createGroupRateLimit({
  limit = 20,
  intervalMs = 15 * 60 * 1000,
  message = 'Too many group requests. Please try again later.',
  keyForRequest,
  now,
} = {}) {
  return createRateLimit({
    limit,
    intervalMs,
    message,
    ...(keyForRequest ? { keyForRequest } : {}),
    ...(now ? { now } : {}),
  });
}
