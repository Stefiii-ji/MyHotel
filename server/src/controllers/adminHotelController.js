import { refreshSchema } from '../validators/hotelValidators.js';
import { refreshOsmHotels } from '../services/osmHotelService.js';
import { httpError } from '../utils/httpError.js';

export function createRefreshHandler({
  Hotel,
  overpassUrl,
  isDatabaseReady,
  fetchImpl,
}) {
  return async function refreshHotels(request, response, next) {
    const parsedBody = refreshSchema.safeParse(request.body);
    if (!parsedBody.success) {
      next(httpError(400, 'Select a supported import area: Mumbai or Navi Mumbai'));
      return;
    }
    if (!isDatabaseReady()) {
      next(httpError(503, 'Hotel data is temporarily unavailable'));
      return;
    }
    try {
      const result = await refreshOsmHotels({
        ...parsedBody.data,
        Hotel,
        overpassUrl,
        fetchImpl,
      });
      response.json({
        ...result,
        attribution: '© OpenStreetMap contributors, available under ODbL.',
      });
    } catch (error) {
      next(error);
    }
  };
}
