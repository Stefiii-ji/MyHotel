import { timingSafeEqual } from 'node:crypto';
import { httpError } from '../utils/httpError.js';

export function createAdminImportAuth(importToken) {
  return function requireAdminImportToken(request, _response, next) {
    if (!importToken) {
      next(httpError(503, 'Hotel imports are disabled until HOTEL_IMPORT_TOKEN is configured'));
      return;
    }

    const providedToken = request.get('x-import-token') ?? '';
    const expected = Buffer.from(importToken);
    const provided = Buffer.from(providedToken);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      next(httpError(401, 'Valid import credentials are required'));
      return;
    }
    next();
  };
}
