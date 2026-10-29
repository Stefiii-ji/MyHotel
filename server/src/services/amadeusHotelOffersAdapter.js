const hosts = {
  test: 'https://test.api.amadeus.com',
  production: 'https://api.amadeus.com',
};

function isValidBookingUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function unavailable(mode, reason, now, logger) {
  if (
    ['malformed_response', 'inventory_mismatch', 'rate_limited', 'upstream_error', 'upstream_timeout']
      .includes(reason)
  ) {
    logger(JSON.stringify({
      event: 'amadeus_hotel_offer_unavailable',
      mode,
      errorCategory: reason,
    }));
  }
  return {
    provider: 'amadeus',
    availability: 'unavailable',
    mode,
    reason,
    retrievedAt: now().toISOString(),
    offer: null,
  };
}

function formatPrice(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function mapTaxAmounts(taxes, currency) {
  if (!Array.isArray(taxes)) return { taxes: [], fees: [] };
  return taxes.reduce(
    (result, tax) => {
      const amount = formatPrice(tax?.amount);
      if (amount === null) return result;
      const item = {
        amount,
        currency,
        code: typeof tax.code === 'string' ? tax.code : null,
        included: typeof tax.included === 'boolean' ? tax.included : null,
      };
      if (/fee|charge/i.test(item.code ?? '')) result.fees.push(item);
      else result.taxes.push(item);
      return result;
    },
    { taxes: [], fees: [] },
  );
}

function normalizeOffer(offer, mode, now) {
  const totalStayPrice = formatPrice(offer?.price?.total);
  const currency = offer?.price?.currency;
  if (totalStayPrice === null || !/^[A-Z]{3}$/.test(currency ?? '')) return null;

  const retrievedAt = now().toISOString();
  const cancellation = offer?.policies?.cancellation;
  const { taxes, fees } = mapTaxAmounts(offer.price.taxes, currency);
  return {
    provider: 'amadeus',
    availability: 'available',
    mode,
    retrievedAt,
    offer: {
      totalStayPrice,
      currency,
      nightlyAverage: null,
      taxes,
      fees,
      room: {
        category: typeof offer?.room?.typeEstimated?.category === 'string'
          ? offer.room.typeEstimated.category
          : null,
        description: typeof offer?.room?.description?.text === 'string'
          ? offer.room.description.text
          : null,
      },
      boardType: typeof offer?.boardType === 'string' ? offer.boardType : null,
      cancellation: cancellation && typeof cancellation === 'object'
        ? {
            type: typeof cancellation.type === 'string' ? cancellation.type : null,
            deadline: typeof cancellation.deadline === 'string' ? cancellation.deadline : null,
            amount: formatPrice(cancellation.amount),
            numberOfNights: Number.isInteger(cancellation.numberOfNights)
              ? cancellation.numberOfNights
              : null,
          }
        : null,
      bookingUrl: isValidBookingUrl(offer?.bookingUrl),
    },
  };
}

function getErrorReason(error) {
  if (error?.code === 'UPSTREAM_TIMEOUT') return 'upstream_timeout';
  return 'upstream_error';
}

export function createAmadeusHotelOffersAdapter({
  mode,
  clientId,
  clientSecret,
  timeoutMs = 8000,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  logger = console.warn,
}) {
  if (!hosts[mode]) throw new TypeError('Amadeus mode must be test or production');
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');

  let token = null;
  let tokenExpiresAt = 0;
  let tokenRequest = null;

  async function request(url, options) {
    const controller = new AbortController();
    let timedOut = false;
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(Object.assign(new Error('Upstream timeout'), { code: 'UPSTREAM_TIMEOUT' }));
      }, timeoutMs);
    });
    try {
      return await Promise.race([
        fetchImpl(url, { ...options, signal: controller.signal }).then(async (response) => {
          try {
            return { response, body: await response.json(), jsonError: null };
          } catch (jsonError) {
            return { response, body: null, jsonError };
          }
        }),
        timeout,
      ]);
    } catch (error) {
      if (timedOut) throw Object.assign(new Error('Upstream timeout'), { code: 'UPSTREAM_TIMEOUT' });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function getAccessToken() {
    if (token && tokenExpiresAt > Date.now() + 30_000) return token;
    if (tokenRequest) return tokenRequest;
    tokenRequest = (async () => {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      });
      const { response, body: data, jsonError } = await request(`${hosts[mode]}/v1/security/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!response.ok) {
        throw Object.assign(new Error('Amadeus token request failed'), {
          code: response.status === 429 ? 'UPSTREAM_RATE_LIMIT' : 'UPSTREAM_ERROR',
        });
      }
      if (jsonError || typeof data?.access_token !== 'string' || !Number.isFinite(Number(data.expires_in))) {
        throw Object.assign(new Error('Malformed Amadeus token response'), { code: 'UPSTREAM_ERROR' });
      }
      token = data.access_token;
      tokenExpiresAt = Date.now() + Number(data.expires_in) * 1000;
      return token;
    })();

    try {
      return await tokenRequest;
    } finally {
      tokenRequest = null;
    }
  }

  async function getOffers(providerHotelId, query) {
    const expectedHotelId = typeof providerHotelId === 'string' ? providerHotelId.trim() : '';
    if (!/^[A-Z0-9]{8}$/.test(expectedHotelId)) {
      return unavailable(mode, 'inventory_not_mapped', now, logger);
    }
    if (!clientId || !clientSecret) {
      return unavailable(mode, 'credentials_missing', now, logger);
    }

    try {
      const accessToken = await getAccessToken();
      const url = new URL(`${hosts[mode]}/v3/shopping/hotel-offers`);
      url.searchParams.set('hotelIds', expectedHotelId);
      url.searchParams.set('adults', String(query.guests));
      url.searchParams.set('checkInDate', query.checkIn);
      url.searchParams.set('checkOutDate', query.checkOut);
      url.searchParams.set('currency', query.currency);
      const { response, body, jsonError } = await request(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.amadeus+json' },
      });
      if (response.status === 429) return unavailable(mode, 'rate_limited', now, logger);
      if (!response.ok) return unavailable(mode, 'upstream_error', now, logger);
      if (jsonError) return unavailable(mode, 'malformed_response', now, logger);
      if (!Array.isArray(body?.data)) return unavailable(mode, 'malformed_response', now, logger);
      if (!body.data.length) return unavailable(mode, 'no_availability', now, logger);
      if (body.data.some((item) => typeof item?.hotel?.hotelId !== 'string')) {
        return unavailable(mode, 'malformed_response', now, logger);
      }
      const matchingHotel = body.data.find((item) => item?.hotel?.hotelId === expectedHotelId);
      if (!matchingHotel) return unavailable(mode, 'inventory_mismatch', now, logger);
      if (!Array.isArray(matchingHotel.offers)) {
        return unavailable(mode, 'malformed_response', now, logger);
      }
      const normalized = matchingHotel.offers
        .map((offer) => normalizeOffer(offer, mode, now))
        .find(Boolean);
      if (!normalized) return unavailable(mode, 'malformed_response', now, logger);
      const checkIn = new Date(`${query.checkIn}T00:00:00.000Z`);
      const checkOut = new Date(`${query.checkOut}T00:00:00.000Z`);
      const nights = (checkOut.getTime() - checkIn.getTime()) / 86_400_000;
      normalized.offer.nightlyAverage = Number((normalized.offer.totalStayPrice / nights).toFixed(2));
      return normalized;
    } catch (error) {
      if (error?.code === 'UPSTREAM_RATE_LIMIT') return unavailable(mode, 'rate_limited', now, logger);
      return unavailable(mode, getErrorReason(error), now, logger);
    }
  }

  return {
    isConfigured: Boolean(clientId && clientSecret),
    getOffers,
  };
}
