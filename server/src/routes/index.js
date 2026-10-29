import { Router } from 'express';
import { env } from '../config/env.js';
import Hotel from '../models/Hotel.js';
import { createHotelHandlers } from '../controllers/hotelController.js';
import Group from '../models/Group.js';
import Swipe from '../models/Swipe.js';
import { createGroupRouter } from './groupRoutes.js';
import { createAdminHotelRouter } from './adminHotelRoutes.js';
import { createHotelRouter } from './hotelRoutes.js';
import { createHealthRouter } from './healthRoutes.js';
import { createAmadeusHotelOffersAdapter } from '../services/amadeusHotelOffersAdapter.js';
import { createHotelOffersService } from '../services/hotelOffersService.js';

export default function createApiRouter({ isDatabaseReady }) {
  const apiRouter = Router();
  const adapter = env.HOTEL_OFFERS_PROVIDER === 'amadeus'
    ? createAmadeusHotelOffersAdapter({
        mode: env.HOTEL_OFFERS_MODE,
        clientId: env.AMADEUS_CLIENT_ID,
        clientSecret: env.AMADEUS_CLIENT_SECRET,
        timeoutMs: env.HOTEL_OFFERS_TIMEOUT_MS,
      })
    : null;
  const hotelOffersService = createHotelOffersService({
    provider: env.HOTEL_OFFERS_PROVIDER,
    mode: env.HOTEL_OFFERS_MODE,
    adapter,
    cacheTtlMs: env.HOTEL_OFFERS_CACHE_TTL_MS,
  });
  const handlers = createHotelHandlers({ Hotel, isDatabaseReady, hotelOffersService });

  apiRouter.use('/health', createHealthRouter({ isDatabaseReady }));
  apiRouter.use(
    '/groups',
    createGroupRouter({
      Group,
      Swipe,
      Hotel,
      clientOrigin: env.CLIENT_ORIGIN,
      isProduction: env.NODE_ENV === 'production',
    }),
  );
  apiRouter.use('/hotels', createHotelRouter(handlers));
  apiRouter.use(
    '/admin/hotels',
    createAdminHotelRouter({
      Hotel,
      importToken: env.HOTEL_IMPORT_TOKEN,
      overpassUrl: env.OVERPASS_URL,
      isDatabaseReady,
    }),
  );

  return apiRouter;
}
