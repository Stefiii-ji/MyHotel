import { randomUUID } from 'node:crypto';
import { httpError } from '../utils/httpError.js';

export const OSM_AREAS = Object.freeze({
  Mumbai: [18.89, 72.75, 19.3, 72.96],
  'Navi Mumbai': [18.75, 72.96, 19.15, 73.15],
});

const accommodationKinds = new Set(['hotel', 'guest_house', 'hostel', 'motel', 'apartment']);
const amenityKeys = new Set([
  'internet_access',
  'internet_access:fee',
  'wheelchair',
  'parking',
  'restaurant',
  'bar',
  'swimming_pool',
  'breakfast',
  'air_conditioning',
]);
const maximumResponseBytes = 5 * 1024 * 1024;
const requestTimeoutMs = 15000;
const fallbackMirrors = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function logRequestFailure(logger, hostname, elapsedMs, errorCategory, attempt, importId) {
  logger(
    JSON.stringify({
      event: 'osm_overpass_request_failed',
      importId,
      hostname,
      elapsedMs,
      errorCategory,
      attempt,
    }),
  );
}

function logEvent(logger, event) {
  logger(JSON.stringify(event));
}

function getFetchErrorCategory(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timeout';
  return 'network';
}

function shouldRetryStatus(status) {
  return status === 406 || status === 429 || (status >= 500 && status < 600);
}

function getMirrors(primaryUrl) {
  return [...new Set([primaryUrl, ...fallbackMirrors].map((url) => new URL(url).toString()))];
}

function logMirrorSuccess(logger, hostname, elapsedMs, importId) {
  logger(JSON.stringify({
    event: 'osm_overpass_mirror_succeeded',
    importId,
    hostname,
    elapsedMs,
  }));
}

function clean(value, maxLength = 200) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function elementCoordinates(element) {
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    return { latitude: element.lat, longitude: element.lon };
  }
  if (Number.isFinite(element.center?.lat) && Number.isFinite(element.center?.lon)) {
    return { latitude: element.center.lat, longitude: element.center.lon };
  }
  return null;
}

export function normalizeOsmElement(element, area) {
  const tags = element?.tags ?? {};
  const name = clean(tags.name, 160);
  const accommodationType = clean(tags.tourism, 60);
  const coordinates = elementCoordinates(element ?? {});

  if (
    !['node', 'way', 'relation'].includes(element?.type) ||
    !name ||
    !Number.isSafeInteger(element?.id) ||
    !accommodationKinds.has(accommodationType) ||
    !coordinates ||
    coordinates.latitude < -90 ||
    coordinates.latitude > 90 ||
    coordinates.longitude < -180 ||
    coordinates.longitude > 180
  ) {
    return null;
  }

  const locality =
    clean(tags['addr:suburb'], 100) ||
    clean(tags['addr:neighbourhood'], 100) ||
    clean(tags['addr:city_district'], 100) ||
    clean(tags['addr:place'], 100);
  const address =
    clean(tags['addr:full'], 400) ||
    [
      [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
      tags['addr:postcode'],
    ]
      .map((part) => clean(part, 100))
      .filter(Boolean)
      .join(', ');
  const normalizedTags = Object.fromEntries(
    Object.entries(tags)
      .filter(
        ([key, value]) =>
          key.length <= 80 &&
          !key.includes('.') &&
          !key.startsWith('$') &&
          typeof value === 'string' &&
          value.trim(),
      )
      .slice(0, 100)
      .map(([key, value]) => [key, clean(value, 500)]),
  );

  return {
    name,
    source: 'openstreetmap',
    sourceId: `${element.type}/${element.id}`,
    address,
    locality,
    city: area,
    region: clean(tags['addr:state'], 100) || 'Maharashtra',
    ...coordinates,
    accommodationType,
    amenities: [...amenityKeys]
      .filter((key) => tags[key] && !['no', 'false', '0'].includes(String(tags[key]).toLowerCase()))
      .map((key) => `${key}: ${clean(tags[key], 100)}`),
    tags: normalizedTags,
    imageUrls: [],
    lastUpdatedAt: new Date(),
  };
}

export function buildOverpassQuery(area) {
  const bounds = OSM_AREAS[area];
  if (!bounds) throw httpError(400, 'Unsupported OpenStreetMap import area');
  const bbox = bounds.join(',');
  return `[out:json][timeout:25];(node["tourism"~"^(hotel|guest_house|hostel|motel|apartment)$"]["name"](${bbox});way["tourism"~"^(hotel|guest_house|hostel|motel|apartment)$"]["name"](${bbox});relation["tourism"~"^(hotel|guest_house|hostel|motel|apartment)$"]["name"](${bbox}););out center tags;`;
}

async function fetchOverpassElements({
  area,
  overpassUrl,
  fetchImpl,
  timeoutMs = requestTimeoutMs,
  logger = console.warn,
  importId,
}) {
  const mirrors = getMirrors(overpassUrl);
  let lastFailure = 'network';

  for (const [index, mirror] of mirrors.entries()) {
    const hostname = new URL(mirror).hostname;
    const startedAt = Date.now();
    let response;
    logEvent(logger, {
      event: 'osm_overpass_attempt_started',
      importId,
      hostname,
      attempt: index + 1,
      timeoutMs,
    });
    try {
      response = await fetchImpl(mirror, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'StaySwipe/0.1.0 (OpenStreetMap accommodation importer)',
        },
        body: new URLSearchParams({ data: buildOverpassQuery(area) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const errorCategory = getFetchErrorCategory(error);
      lastFailure = errorCategory;
      logRequestFailure(logger, hostname, Date.now() - startedAt, errorCategory, index + 1, importId);
      logEvent(logger, {
        event: 'osm_overpass_attempt_finished',
        importId,
        hostname,
        attempt: index + 1,
        elapsedMs: Date.now() - startedAt,
        outcome: 'retry',
        errorCategory,
      });
      continue;
    }

    if (!response.ok) {
      const errorCategory = `http_${response.status}`;
      logRequestFailure(logger, hostname, Date.now() - startedAt, errorCategory, index + 1, importId);
      if (shouldRetryStatus(response.status)) {
        lastFailure = response.status;
        logEvent(logger, {
          event: 'osm_overpass_attempt_finished',
          importId,
          hostname,
          attempt: index + 1,
          elapsedMs: Date.now() - startedAt,
          outcome: 'retry',
          statusCode: response.status,
        });
        continue;
      }
      logEvent(logger, {
        event: 'osm_overpass_attempt_finished',
        importId,
        hostname,
        attempt: index + 1,
        elapsedMs: Date.now() - startedAt,
        outcome: 'failed',
        statusCode: response.status,
      });
      throw httpError(
        502,
        `OpenStreetMap Overpass returned non-retryable HTTP ${response.status}`,
      );
    }

    let text;
    try {
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > maximumResponseBytes) {
        throw httpError(502, 'OpenStreetMap response exceeded the size limit');
      }
      text = await readResponseBody(response);
    } catch (error) {
      if (error.statusCode) {
        logRequestFailure(
          logger,
          hostname,
          Date.now() - startedAt,
          'response_error',
          index + 1,
          importId,
        );
        logEvent(logger, {
          event: 'osm_overpass_attempt_finished',
          importId,
          hostname,
          attempt: index + 1,
          elapsedMs: Date.now() - startedAt,
          outcome: 'failed',
          errorCategory: 'invalid_response_size',
        });
        throw error;
      }

      const errorCategory = getFetchErrorCategory(error);
      lastFailure = errorCategory;
      logRequestFailure(logger, hostname, Date.now() - startedAt, errorCategory, index + 1, importId);
      logEvent(logger, {
        event: 'osm_overpass_attempt_finished',
        importId,
        hostname,
        attempt: index + 1,
        elapsedMs: Date.now() - startedAt,
        outcome: 'retry',
        errorCategory,
      });
      continue;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      logRequestFailure(logger, hostname, Date.now() - startedAt, 'invalid_json', index + 1, importId);
      logEvent(logger, {
        event: 'osm_overpass_attempt_finished',
        importId,
        hostname,
        attempt: index + 1,
        elapsedMs: Date.now() - startedAt,
        outcome: 'failed',
        errorCategory: 'invalid_json',
      });
      throw httpError(502, 'OpenStreetMap returned an invalid response');
    }
    if (!data || typeof data !== 'object' || !Array.isArray(data.elements)) {
      logRequestFailure(
        logger,
        hostname,
        Date.now() - startedAt,
        'invalid_response_shape',
        index + 1,
        importId,
      );
      logEvent(logger, {
        event: 'osm_overpass_attempt_finished',
        importId,
        hostname,
        attempt: index + 1,
        elapsedMs: Date.now() - startedAt,
        outcome: 'failed',
        errorCategory: 'invalid_response_shape',
      });
      throw httpError(502, 'OpenStreetMap response did not contain element records');
    }

    logMirrorSuccess(logger, hostname, Date.now() - startedAt, importId);
    logEvent(logger, {
      event: 'osm_overpass_attempt_finished',
      importId,
      hostname,
      attempt: index + 1,
      elapsedMs: Date.now() - startedAt,
      outcome: 'success',
      elementCount: data.elements.length,
    });
    return data.elements;
  }

  if (lastFailure === 'timeout') {
    throw httpError(504, 'All OpenStreetMap Overpass mirrors timed out');
  }
  throw httpError(502, 'All configured OpenStreetMap Overpass mirrors failed');
}

async function readResponseBody(response) {
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maximumResponseBytes) {
      throw httpError(502, 'OpenStreetMap response exceeded the size limit');
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumResponseBytes) {
      await reader.cancel();
      throw httpError(502, 'OpenStreetMap response exceeded the size limit');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export async function refreshOsmHotels({
  area,
  Hotel,
  overpassUrl,
  fetchImpl = fetch,
  timeoutMs = requestTimeoutMs,
  logger = console.warn,
}) {
  if (!OSM_AREAS[area]) throw httpError(400, 'Unsupported OpenStreetMap import area');

  const importId = randomUUID();
  const startedAt = Date.now();
  let stage = 'overpass';
  logEvent(logger, { event: 'osm_import_started', importId, area });

  try {
    const elements = await fetchOverpassElements({
      area,
      overpassUrl,
      fetchImpl,
      timeoutMs,
      logger,
      importId,
    });
    const uniqueRecords = new Map();
    for (const element of elements) {
      const record = normalizeOsmElement(element, area);
      if (record) uniqueRecords.set(record.sourceId, record);
    }

    const records = [...uniqueRecords.values()];
    const skipped = elements.length - records.length;
    let result = null;
    if (records.length) {
      stage = 'database_write';
      result = await Hotel.bulkWrite(
        records.map(({ source, sourceId, ...fields }) => ({
          updateOne: {
            filter: { source, sourceId },
            update: { $set: fields, $setOnInsert: { source, sourceId } },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }

    const inserted = result?.upsertedCount ?? 0;
    const updated = result?.modifiedCount ?? 0;
    const matched = result?.matchedCount ?? updated;
    const stats = {
      imported: records.length,
      processed: elements.length,
      inserted,
      updated,
      unchanged: Math.max(0, matched - updated),
      skipped,
      failed: 0,
      area,
    };
    logEvent(logger, {
      event: 'osm_import_finished',
      importId,
      area,
      elapsedMs: Date.now() - startedAt,
      ...stats,
    });
    return stats;
  } catch (error) {
    logEvent(logger, {
      event: 'osm_import_failed',
      importId,
      area,
      elapsedMs: Date.now() - startedAt,
      stage,
      statusCode: Number.isInteger(error?.statusCode) ? error.statusCode : undefined,
      errorCategory: stage === 'database_write'
        ? 'database_write_failed'
        : error?.statusCode === 504
          ? 'all_mirrors_timed_out'
          : error?.statusCode === 502
            ? 'upstream_response_failed'
            : 'import_failed',
    });
    throw error;
  }
}
