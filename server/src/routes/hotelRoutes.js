import { Router } from 'express';
import { createRateLimit } from '../middleware/rateLimit.js';

export function createHotelRouter(handlers) {
  const router = Router();
  const rateLimitOffers = createRateLimit({
    limit: 30,
    intervalMs: 60 * 1000,
    message: 'Too many hotel offer requests. Please try again shortly.',
  });
  router.get('/', handlers.listHotels);
  router.get('/:id/offers', rateLimitOffers, handlers.getHotelOffers);
  router.get('/:id', handlers.getHotel);
  return router;
}
