import mongoose from 'mongoose';
import { hotelOfferQuerySchema, hotelQuerySchema } from '../validators/hotelValidators.js';
import { httpError } from '../utils/httpError.js';
import { escapeRegex } from '../utils/regex.js';

function getAttribution(source) {
  if (source === 'stayswipe_sample') {
    return {
      source: 'StaySwipe fictional development samples',
      license: 'Fictional test data; not real listings or offers',
      url: null,
    };
  }
  return {
    source: 'OpenStreetMap contributors',
    license: 'Open Database License (ODbL)',
    url: 'https://www.openstreetmap.org/copyright',
  };
}

function getListAttribution(hotels) {
  const sources = new Set(hotels.map((hotel) => hotel.source));
  if (sources.size === 1 && sources.has('stayswipe_sample')) {
    return getAttribution('stayswipe_sample');
  }
  if (sources.has('stayswipe_sample') && sources.has('openstreetmap')) {
    return {
      source: 'OpenStreetMap contributors and StaySwipe fictional development samples',
      license: 'ODbL applies to OpenStreetMap records only; sample records are fictional',
      url: 'https://www.openstreetmap.org/copyright',
    };
  }
  return getAttribution('openstreetmap');
}

export function serializeHotel(hotel) {
  const { _id, __v, providerHotelIds, ...fields } = hotel;
  return {
    id: String(_id),
    ...fields,
    amenities: fields.amenities ?? [],
    tags: fields.tags instanceof Map ? Object.fromEntries(fields.tags) : fields.tags ?? {},
    imageUrls: fields.imageUrls ?? [],
  };
}

export function createHotelHandlers({ Hotel, isDatabaseReady, hotelOffersService }) {
  async function listHotels(request, response, next) {
    const parsedQuery = hotelQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      next(httpError(400, 'Invalid hotel filters or pagination values'));
      return;
    }
    if (!isDatabaseReady()) {
      next(httpError(503, 'Hotel data is temporarily unavailable'));
      return;
    }

    const { city, region, locality, type, page, limit } = parsedQuery.data;
    const filter = {};
    if (city) filter.city = new RegExp(`^${escapeRegex(city)}$`, 'i');
    if (region) filter.region = new RegExp(`^${escapeRegex(region)}$`, 'i');
    if (locality) filter.locality = new RegExp(escapeRegex(locality), 'i');
    if (type) filter.accommodationType = type;

    try {
      const skip = (page - 1) * limit;
      const [hotels, total] = await Promise.all([
        Hotel.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
        Hotel.countDocuments(filter),
      ]);
      response.json({
        items: hotels.map(serializeHotel),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        attribution: getListAttribution(hotels),
      });
    } catch (error) {
      next(error);
    }
  }

  async function getHotel(request, response, next) {
    if (!mongoose.isValidObjectId(request.params.id)) {
      next(httpError(400, 'Invalid hotel id'));
      return;
    }
    if (!isDatabaseReady()) {
      next(httpError(503, 'Hotel data is temporarily unavailable'));
      return;
    }
    try {
      const hotel = await Hotel.findById(request.params.id).lean();
      if (!hotel) {
        next(httpError(404, 'Hotel not found'));
        return;
      }
      response.json({
        item: serializeHotel(hotel),
        attribution: getAttribution(hotel.source),
      });
    } catch (error) {
      next(error);
    }
  }

  async function getHotelOffers(request, response, next) {
    const parsedId = mongoose.isObjectIdOrHexString(request.params.id);
    const parsedQuery = hotelOfferQuerySchema.safeParse(request.query);
    if (!parsedId || !parsedQuery.success) {
      next(httpError(400, 'Invalid hotel id or offer search parameters'));
      return;
    }
    if (!isDatabaseReady()) {
      next(httpError(503, 'Hotel data is temporarily unavailable'));
      return;
    }

    try {
      const hotel = await Hotel.findById(request.params.id).lean();
      if (!hotel) {
        next(httpError(404, 'Hotel not found'));
        return;
      }
      const result = await hotelOffersService.getOffers(hotel, parsedQuery.data);
      response.json({ item: result });
    } catch (error) {
      next(error);
    }
  }

  return { listHotels, getHotel, getHotelOffers };
}
