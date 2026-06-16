#!/usr/bin/env node
/**
 * Pull REAL Vector B (dirt) data straight from a county ArcGIS service — no Apify
 * account needed, just Node and a verified fieldMap. Writes a lots.json the daily
 * pipeline reads directly.
 *
 * Reuses the Vector B zoning + enrichment logic (already unit-tested) so the
 * output matches what the Apify actor produces.
 *
 * Usage:
 *   node tools/pull-parcels.js --source config/county-sources.json --county "Jackson (KCMO)" --out samples/lots.json
 *   node tools/pull-parcels.js --source config/county-sources.json --county "Jackson (KCMO)" --vacant --max 2000
 *
 * Run `node tools/discover-fields.js --url <layer>/query` FIRST and replace the
 * VERIFY_* placeholders in county-sources.json with the real field names.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { buildZoningWhereClause } from '../vector-b-dirt-sweep/src/zoning.js';
import { buildLead, passesFilters } from '../vector-b-dirt-sweep/src/enrich.js';

const DEFAULT_ZONING = ['R-2.5', 'R-3', 'R-4', 'R-2', 'R-5', 'MF', 'MULTI-FAMILY', 'DUPLEX', 'TWO-FAMILY'];

/** Pure: turn raw ArcGIS attribute rows into enriched, filtered Vector B leads. */
export function leadsFromFeatures(rows, source, config) {
  const out = [];
  for (const raw of rows) {
    const lead = buildLead(raw, source, config);
    if (passesFilters(lead, config)) out.push(lead);
  }
  return out;
}

/** Paginated ArcGIS query with retry/backoff over native fetch. */
async function* queryArcgis({ queryUrl, where, pageSize, maxRecords }) {
  let offset = 0;
  let pulled = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  while (true) {
    if (maxRecords > 0 && pulled >= maxRecords) return;
    const thisPage = maxRecords > 0 ? Math.min(pageSize, maxRecords - pulled) : pageSize;
    const params = new URLSearchParams({
      where, outFields: '*', f: 'json', returnGeometry: 'false',
      resultOffset: String(offset), resultRecordCount: String(thisPage), orderByFields: 'OBJECTID ASC',
    });
    let body;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await fetch(`${queryUrl}?${params.toString()}`, { headers: { Accept: 'application/json', 'User-Agent': 'OmniEngine/0.1' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        body = await res.json();
        if (body.error) throw new Error(`ArcGIS ${body.error.code}: ${body.error.message}`);
        break;
      } catch (err) {
        if (attempt === 4) throw err;
        process.stderr.write(`  retry ${attempt}/4 (${err.message})\n`);
        await sleep(2 ** attempt * 1000);
      }
    }
    const features = body.features || [];
    if (!features.length) break;
    for (const f of features) { yield f.attributes || {}; pulled += 1; if (maxRecords > 0 && pulled >= maxRecords) return; }
    if (!(body.exceededTransferLimit === true || features.length === thisPage)) break;
    offset += features.length;
  }
}

function hasUnverified(source) {
  const vals = [source.zoningField, ...Object.values(source.fieldMap || {})];
  return vals.some((v) => typeof v === 'string' && /^VERIFY_/.test(v));
}

async function main() {
  const args = process.argv.slice(2);
  const opt = { source: 'config/county-sources.json', zoning: DEFAULT_ZONING.join(','), out: 'samples/lots.json', max: 5000, pageSize: 1000, vacant: false };
  for (let i = 0; i < args.length; i++) {
    const k = args[i];
    if (k === '--source') opt.source = args[++i];
    else if (k === '--county') opt.county = args[++i];
    else if (k === '--zoning') opt.zoning = args[++i];
    else if (k === '--out') opt.out = args[++i];
    else if (k === '--max') opt.max = Number(args[++i]);
    else if (k === '--vacant') opt.vacant = true;
  }

  const cfg = JSON.parse(readFileSync(opt.source, 'utf8'));
  const sources = cfg.vectorB_dirtSweep?.sources || [];
  const source = opt.county ? sources.find((s) => s.county === opt.county) : sources[0];
  if (!source) { console.error(`County not found in ${opt.source}. Available: ${sources.map((s) => s.county).join(', ')}`); process.exit(1); }
  if (hasUnverified(source)) {
    console.error(`\n⚠️  ${source.county} still has VERIFY_* placeholders in its fieldMap.`);
    console.error(`   Run: node tools/discover-fields.js --url "${source.queryUrl}"`);
    console.error(`   then replace the VERIFY_* names in ${opt.source} and re-run.\n`);
    process.exit(1);
  }

  const zoningCodes = opt.zoning.split(',').map((s) => s.trim()).filter(Boolean);
  const where = buildZoningWhereClause(source.zoningField, zoningCodes);
  const config = { vacantOnly: opt.vacant, teardownImprovementCeiling: 25000, vacantLandUseCodes: ['VAC', 'VACANT', '0000', '1000'], minAcreage: 0, maxAcreage: 0, minEquityProxy: 0 };

  console.log(`Querying ${source.county}\n  ${source.queryUrl}\n  WHERE ${where}`);
  const rows = [];
  for await (const raw of queryArcgis({ queryUrl: source.queryUrl, where, pageSize: opt.pageSize, maxRecords: opt.max })) rows.push(raw);
  console.log(`Pulled ${rows.length} parcels.`);

  const leads = leadsFromFeatures(rows, source, config);
  writeFileSync(opt.out, JSON.stringify(leads, null, 2));
  console.log(`Wrote ${leads.length} Vector B leads -> ${opt.out}`);
}

if (process.argv[1] && process.argv[1].endsWith('pull-parcels.js')) {
  main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
}
