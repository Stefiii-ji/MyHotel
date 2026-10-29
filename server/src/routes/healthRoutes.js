import { Router } from 'express';
import {
  createHealthHandler,
  createReadinessHandler,
} from '../controllers/healthController.js';

export function createHealthRouter({ isDatabaseReady }) {
  const router = Router();
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/', createHealthHandler({ isDatabaseReady }));
  router.get('/ready', createReadinessHandler({ isDatabaseReady }));
  return router;
}
