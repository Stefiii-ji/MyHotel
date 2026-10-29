import { Router } from 'express';
import { createRefreshHandler } from '../controllers/adminHotelController.js';
import { createAdminImportAuth } from '../middleware/adminImportAuth.js';
import { createImportRateLimit } from '../middleware/importRateLimit.js';

export function createAdminHotelRouter({
  Hotel,
  importToken,
  overpassUrl,
  isDatabaseReady,
  fetchImpl,
}) {
  const router = Router();
  router.post(
    '/refresh',
    createAdminImportAuth(importToken),
    createImportRateLimit(),
    createRefreshHandler({ Hotel, overpassUrl, isDatabaseReady, fetchImpl }),
  );
  return router;
}
