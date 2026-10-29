function unavailable(provider, mode, reason, now) {
  return {
    provider,
    availability: 'unavailable',
    mode,
    reason,
    retrievedAt: now().toISOString(),
    offer: null,
  };
}

function providerHotelId(hotel, provider) {
  const mappings = hotel.providerHotelIds;
  if (mappings instanceof Map) return mappings.get(provider);
  return mappings?.[provider];
}

export function createHotelOffersService({
  provider,
  mode,
  adapter,
  cacheTtlMs = 300_000,
  now = () => new Date(),
}) {
  const cache = new Map();
  const inFlight = new Map();

  async function getOffers(hotel, query) {
    if (provider === 'none') return unavailable(provider, mode, 'provider_disabled', now);
    const mappedHotelId = providerHotelId(hotel, provider);
    if (!mappedHotelId) {
      return unavailable(provider, mode, 'inventory_not_mapped', now);
    }
    if (!adapter || !adapter.isConfigured) {
      return unavailable(provider, mode, 'credentials_missing', now);
    }

    const key = JSON.stringify([provider, mode, mappedHotelId, query]);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now().getTime()) return cached.result;
    if (cached) cache.delete(key);
    if (inFlight.has(key)) return inFlight.get(key);

    const request = Promise.resolve()
      .then(() => adapter.getOffers(mappedHotelId, query))
      .catch(() => unavailable(provider, mode, 'upstream_error', now))
      .then((result) => {
        if (result.availability === 'available' && cacheTtlMs > 0) {
          if (cache.size >= 1000) {
            for (const [cachedKey, entry] of cache) {
              if (entry.expiresAt <= now().getTime()) cache.delete(cachedKey);
            }
            if (cache.size >= 1000) cache.delete(cache.keys().next().value);
          }
          cache.set(key, { result, expiresAt: now().getTime() + cacheTtlMs });
        }
        return result;
      });

    inFlight.set(key, request);
    try {
      return await request;
    } finally {
      if (inFlight.get(key) === request) inFlight.delete(key);
    }
  }

  return { getOffers };
}
