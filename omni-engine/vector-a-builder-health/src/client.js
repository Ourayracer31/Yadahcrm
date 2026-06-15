/**
 * Generic paginated JSON record client for Vector A sources.
 *
 * Building-permit and new-construction-listing data in the KC metro is published
 * two common ways:
 *   - Socrata open-data portals (e.g. data.kcmo.org) - SoQL via $where/$limit/$offset
 *   - ArcGIS FeatureServer/MapServer "query" layers - WHERE + resultOffset/Count
 * This module abstracts both behind `fetchRecords(source)` so the rest of the
 * actor doesn't care which backend a jurisdiction happens to use.
 */

import { log, sleep } from 'apify';

const MAX_RETRIES = 4;

async function getJson(url) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'OmniEngine-VectorA/0.1' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      const backoff = 2 ** attempt * 1000;
      log.warning(`Fetch failed (attempt ${attempt}/${MAX_RETRIES}): ${err.message}. Retry in ${backoff}ms`);
      if (attempt === MAX_RETRIES) throw err;
      await sleep(backoff);
    }
  }
  return [];
}

/** Socrata: paginate with $limit/$offset, optional $where. */
async function* fetchSocrata({ url, where, pageSize, maxRecords }) {
  let offset = 0;
  let pulled = 0;
  while (true) {
    const params = new URLSearchParams({ $limit: String(pageSize), $offset: String(offset) });
    if (where) params.set('$where', where);
    const rows = await getJson(`${url}?${params.toString()}`);
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const row of rows) {
      yield row;
      pulled += 1;
      if (maxRecords > 0 && pulled >= maxRecords) return;
    }
    if (rows.length < pageSize) break;
    offset += rows.length;
  }
}

/** ArcGIS: paginate with resultOffset/resultRecordCount, WHERE. */
async function* fetchArcgis({ url, where, pageSize, maxRecords }) {
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
    const body = await getJson(`${url}?${params.toString()}`);
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

/** Dispatch on source.type. Yields raw record objects. */
export async function* fetchRecords(source, { pageSize = 1000, maxRecords = 0 } = {}) {
  const opts = { url: source.url, where: source.where || '', pageSize, maxRecords };
  if (source.type === 'socrata') {
    yield* fetchSocrata(opts);
  } else if (source.type === 'arcgis') {
    yield* fetchArcgis(opts);
  } else {
    throw new Error(`Unknown source.type "${source.type}" (expected "socrata" or "arcgis")`);
  }
}
