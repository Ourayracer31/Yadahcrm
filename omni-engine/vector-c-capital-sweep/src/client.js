/**
 * Paginated ArcGIS parcel/sales client for Vector C.
 *
 * County assessor parcel layers and recorder sales layers carry the owner name,
 * land-use code and most-recent sale date we need to detect corporate buyers
 * accumulating single-family rentals. Same ArcGIS REST query mechanics as the
 * other vectors (kept local so the actor is self-contained for Apify deploy).
 */

import { log, sleep } from 'apify';

const MAX_RETRIES = 4;

async function getJson(url) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'OmniEngine-VectorC/0.1' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const body = await res.json();
      if (body.error) throw new Error(`ArcGIS error ${body.error.code}: ${body.error.message}`);
      return body;
    } catch (err) {
      const backoff = 2 ** attempt * 1000;
      log.warning(`Fetch failed (attempt ${attempt}/${MAX_RETRIES}): ${err.message}. Retry in ${backoff}ms`);
      if (attempt === MAX_RETRIES) throw err;
      await sleep(backoff);
    }
  }
  return { features: [] };
}

export async function* queryArcgis({ queryUrl, where, pageSize = 1000, maxRecords = 0 }) {
  let offset = 0;
  let pulled = 0;
  while (true) {
    const params = new URLSearchParams({
      where: where || '1=1',
      outFields: '*',
      f: 'json',
      returnGeometry: 'false',
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
      orderByFields: 'OBJECTID ASC',
    });
    const body = await getJson(`${queryUrl}?${params.toString()}`);
    const features = body.features || [];
    if (features.length === 0) break;
    for (const f of features) {
      yield f.attributes || {};
      pulled += 1;
      if (maxRecords > 0 && pulled >= maxRecords) return;
    }
    const more = body.exceededTransferLimit === true || features.length === pageSize;
    if (!more) break;
    offset += features.length;
  }
}
