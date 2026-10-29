import { httpError } from '../utils/httpError.js';

export function createRateLimit({
  limit,
  intervalMs,
  message = 'Too many requests. Please try again later.',
  keyForRequest = (request) => request.ip ?? request.socket?.remoteAddress ?? 'unknown',
  now = Date.now,
}) {
  const requestsByKey = new Map();

  return function rateLimit(request, _response, next) {
    const currentTime = now();
    const key = keyForRequest(request);
    const previous = requestsByKey.get(key);
    if (previous && currentTime - previous.startedAt < intervalMs) {
      if (previous.count >= limit) {
        next(httpError(429, message));
        return;
      }
      previous.count += 1;
    } else {
      if (!previous && requestsByKey.size >= 10000) {
        for (const [storedKey, record] of requestsByKey) {
          if (currentTime - record.startedAt >= intervalMs) requestsByKey.delete(storedKey);
        }
        if (requestsByKey.size >= 10000) {
          requestsByKey.delete(requestsByKey.keys().next().value);
        }
      }
      requestsByKey.set(key, { startedAt: currentTime, count: 1 });
    }
    next();
  };
}
