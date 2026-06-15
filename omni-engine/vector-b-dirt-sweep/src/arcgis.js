/**
 * Thin ArcGIS REST client for county parcel/zoning layers.
 *
 * Both Jackson County (KCMO) and Wyandotte County (KCK) publish their parcel,
 * zoning and assessment attributes through ArcGIS FeatureServer/MapServer
 * "query" endpoints that return JSON and honor a server-side WHERE clause.
 * Querying those endpoints is far more reliable than HTML-scraping the public
 * parcel viewers, and it is the same data the county exposes to the public map.
 */

import { log, sleep } from 'apify';

const MAX_RETRIES = 4;

/** Fetch one page of features from an ArcGIS query endpoint. */
async function fetchPage({ queryUrl, where, offset, pageSize }) {
  const params = new URLSearchParams({
    where,
    outFields: '*',
    f: 'json',
    returnGeometry: 'false',
    resultOffset: String(offset),
    resultRecordCount: String(pageSize),
    orderByFields: 'OBJECTID ASC',
  });
  const url = `${queryUrl}?${params.toString()}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'OmniEngine-VectorB/0.1' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const body = await res.json();
      if (body.error) {
        throw new Error(`ArcGIS error ${body.error.code}: ${body.error.message}`);
      }
      return body;
    } catch (err) {
      const backoff = 2 ** attempt * 1000; // 2s, 4s, 8s, 16s
      log.warning(`ArcGIS page fetch failed (attempt ${attempt}/${MAX_RETRIES}): ${err.message}. Retrying in ${backoff}ms`);
      if (attempt === MAX_RETRIES) throw err;
      await sleep(backoff);
    }
  }
  return { features: [] };
}

/**
 * Async generator that walks every page of an ArcGIS layer for a WHERE clause,
 * yielding raw attribute objects one at a time. Stops at `maxRecords` (0 = all).
 */
export async function* queryArcgisParcels({ queryUrl, where, pageSize = 1000, maxRecords = 0 }) {
  let offset = 0;
  let pulled = 0;

  while (true) {
    const remaining = maxRecords > 0 ? maxRecords - pulled : pageSize;
    if (maxRecords > 0 && remaining <= 0) break;
    const thisPage = Math.min(pageSize, maxRecords > 0 ? remaining : pageSize);

    const body = await fetchPage({ queryUrl, where, offset, pageSize: thisPage });
    const features = body.features || [];
    if (features.length === 0) break;

    for (const feature of features) {
      yield feature.attributes || {};
      pulled += 1;
      if (maxRecords > 0 && pulled >= maxRecords) return;
    }

    // exceededTransferLimit tells us another page exists; otherwise stop.
    const more = body.exceededTransferLimit === true || features.length === thisPage;
    if (!more) break;
    offset += features.length;
  }
}
