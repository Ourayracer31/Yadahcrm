#!/usr/bin/env node
/**
 * Scrape BUILDERS automatically from a public building-permit feed — Vector A.
 *
 * Reuses Vector A's tested logic: roll permits up by builder, keep the mid-market
 * band (5-50/yr, national mega-builders excluded), and (optionally) layer spec
 * DOM/price signals. Writes builders.json for the pipeline. No hand-typing.
 *
 * Works against a Socrata open-data feed (e.g. data.kcmo.org) or an ArcGIS permit
 * layer — same idea as pull-parcels. For sources that need a real browser (some
 * builder sites, Zillow), run an Apify actor instead and ingest it with tools/apify.js.
 *
 * Usage:
 *   node tools/pull-permits.js --source config/permit-sources.json --out samples/builders.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { aggregatePermits, filterMidMarket, classifyHealth } from '../vector-a-builder-health/src/builders.js';
import { indexListingsByBuilder, summarizeSpecs } from '../vector-a-builder-health/src/specs.js';

const MEGA_DEFAULT = ['D.R. Horton', 'Lennar', 'Pulte', 'NVR', 'Ryan Homes', 'KB Home', 'Taylor Morrison', 'Meritage', 'Century Communities', 'LGI Homes', 'Richmond American'];

/** Pure: turn raw permit rows (+ optional listings) into scored builder records. */
export function buildersFromPermits(permits, listings, config, now = new Date()) {
  const byBuilder = aggregatePermits(permits, { fieldMap: config.permitFieldMap, windowMonths: config.windowMonths, now });
  const mid = filterMidMarket(byBuilder, {
    minPerYear: config.minPerYear, maxPerYear: config.maxPerYear,
    windowMonths: config.windowMonths, megaExcludes: config.megaExcludes || MEGA_DEFAULT,
  });
  let listingsByBuilder = new Map();
  if (listings && listings.length && config.listingsFieldMap) listingsByBuilder = indexListingsByBuilder(listings, config.listingsFieldMap, now);

  return mid.map((b) => {
    const specSummary = summarizeSpecs(listingsByBuilder.get(b.builderName), { staleDomDays: config.staleDomDays || 60 });
    const rec = classifyHealth(b, specSummary, { staleDomDays: config.staleDomDays || 60 });
    rec.vector = 'A';
    rec.metro = (config.metro || '').toUpperCase();
    rec.scrapedAt = now.toISOString();
    return rec;
  });
}

/** Paginated fetch for Socrata or ArcGIS. */
async function* fetchRecords(src, { fetchImpl = fetch, pageSize = 1000, maxRecords = 0 } = {}) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let offset = 0; let pulled = 0;
  while (true) {
    if (maxRecords > 0 && pulled >= maxRecords) return;
    const page = maxRecords > 0 ? Math.min(pageSize, maxRecords - pulled) : pageSize;
    let url;
    if (src.type === 'socrata') {
      const p = new URLSearchParams({ $limit: String(page), $offset: String(offset) });
      if (src.where) p.set('$where', src.where);
      url = `${src.url}?${p.toString()}`;
    } else { // arcgis
      const p = new URLSearchParams({ where: src.where || '1=1', outFields: '*', f: 'json', returnGeometry: 'false', resultOffset: String(offset), resultRecordCount: String(page), orderByFields: 'OBJECTID ASC' });
      url = `${src.url}?${p.toString()}`;
    }
    let body;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await fetchImpl(url, { headers: { Accept: 'application/json', 'User-Agent': 'OmniEngine/0.1' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        body = await res.json();
        if (body.error) throw new Error(`API ${body.error.message || body.error.code}`);
        break;
      } catch (err) { if (attempt === 4) throw err; process.stderr.write(`  retry ${attempt}/4 (${err.message})\n`); await sleep(2 ** attempt * 1000); }
    }
    const rows = src.type === 'socrata' ? body : (body.features || []).map((f) => f.attributes || {});
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) { yield r; pulled += 1; if (maxRecords > 0 && pulled >= maxRecords) return; }
    if (rows.length < page && !(body.exceededTransferLimit === true)) break;
    offset += rows.length;
  }
}

function hasUnverified(obj) {
  return JSON.stringify(obj).includes('VERIFY_');
}

async function main() {
  const args = process.argv.slice(2);
  const opt = { source: 'config/permit-sources.json', out: 'samples/builders.json', max: 50000 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source') opt.source = args[++i];
    else if (args[i] === '--out') opt.out = args[++i];
    else if (args[i] === '--max') opt.max = Number(args[++i]);
  }
  const config = JSON.parse(readFileSync(opt.source, 'utf8'));
  const src = config.permitSource;
  if (!src || !src.url || hasUnverified(src)) {
    console.error(`\n⚠️  ${opt.source} still needs the real permit feed URL + field names.`);
    console.error('   Find your city/county "building permits" open-data API, then set permitSource.url');
    console.error('   and permitFieldMap (builderName/issueDate/address). discover-fields.js helps for ArcGIS.\n');
    process.exit(1);
  }

  console.log(`Scraping permits from ${src.url} …`);
  const permits = [];
  for await (const r of fetchRecords(src, { maxRecords: opt.max })) permits.push(r);
  console.log(`Pulled ${permits.length} permits.`);

  let listings = [];
  if (config.listingsSource && config.listingsSource.url && !hasUnverified(config.listingsSource)) {
    for await (const r of fetchRecords(config.listingsSource, { maxRecords: opt.max })) listings.push(r);
    console.log(`Pulled ${listings.length} listings.`);
  }

  const builders = buildersFromPermits(permits, listings, {
    permitFieldMap: src.fieldMap, listingsFieldMap: config.listingsSource?.fieldMap,
    windowMonths: config.windowMonths ?? 24, minPerYear: config.minPerYear ?? 5, maxPerYear: config.maxPerYear ?? 50,
    staleDomDays: config.staleDomDays ?? 60, megaExcludes: config.megaExcludes, metro: config.metro,
  });
  writeFileSync(opt.out, JSON.stringify(builders, null, 2));
  console.log(`Scraped ${builders.length} mid-market builders (5-50/yr, mega-builders excluded) -> ${opt.out}`);
}

if (process.argv[1] && process.argv[1].endsWith('pull-permits.js')) {
  main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
}
