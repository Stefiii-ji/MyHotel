import { Router } from 'express';
import { createHealthHandler } from '../controllers/healthController.js';

export function createHealthRouter({ isDatabaseReady }) {
  const router = Router();
  router.get('/', createHealthHandler({ isDatabaseReady }));
  return router;
}
