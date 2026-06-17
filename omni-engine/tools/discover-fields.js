#!/usr/bin/env node
/**
 * Discover & map county ArcGIS parcel fields.
 *
 * The county GIS servers only answer from a real browser/network (they 403 bots),
 * so the exact field names must be read on YOUR machine. Point this at a layer's
 * query URL and it fetches the layer metadata, lists every field, and proposes a
 * fieldMap for the vector actors. Run it locally (or have Claude in Chrome open
 * the printed `?f=json` URL and read the fields aloud).
 *
 * Usage:
 *   node tools/discover-fields.js --url https://host/.../MapServer/0/query
 *   node tools/discover-fields.js --url <layerUrl> --out fieldmap.json
 */

import { writeFileSync } from 'node:fs';

// Name patterns -> normalized engine field. First matching column wins.
const PATTERNS = {
  parcelId: /(parcel.*(id|num|nbr|_?no\b)|^pin$|^apn$|^parcel$|locator)/i,
  ownerName: /(owner.*name|^owner$|ownername|taxpayer|deed.*owner)/i,
  ownerMailingAddress: /(mail.*addr|owner.*addr|mailing|^addr_?m)/i,
  ownerMailingCity: /(mail.*city|owner.*city)/i,
  ownerMailingState: /(mail.*st(ate)?\b|owner.*state|mail_?st)/i,
  ownerMailingZip: /(mail.*zip|owner.*zip)/i,
  situsAddress: /(situs|site.?addr|prop.?addr|phys.?addr|^address$|location.?addr)/i,
  situsCity: /(situs.?city|site.?city|prop.?city)/i,
  zoning: /(zoning|^zone$|zone_?code|zoneclass|zone_?desc)/i,
  landUse: /(land.?use|use.?code|^use$|property.?class|class.?code|luc\b)/i,
  landValue: /(land.?val|^landv|land_?value)/i,
  improvementValue: /((improv|imprv|impr|imp|bldg|building).*val)/i,
  totalAssessedValue: /(total.?val|appraised|assessed.?val|tot_?val|market.?val)/i,
  acreage: /(^acre|acres?\b|gis_?acre|deed.?acre|calc.?acre|^acre_?)/i,
  saleDate: /(sale.?date|deed.?date|transfer.?date|sale_?dt)/i,
  salePrice: /(sale.?price|sale.?amt|sale_?pr|consideration|sale_?val)/i,
};

/** Propose a fieldMap from a list of field names (or {name} objects). */
export function suggestFieldMap(fields) {
  const names = (fields || []).map((f) => (typeof f === 'string' ? f : f && f.name)).filter(Boolean);
  const out = {};
  for (const [key, re] of Object.entries(PATTERNS)) {
    const hit = names.find((n) => re.test(n));
    if (hit) out[key] = hit;
  }
  return { fieldMap: out, allFields: names, missing: Object.keys(PATTERNS).filter((k) => !out[k]) };
}

/** Fetch an ArcGIS layer's metadata and return its field list. */
export async function fetchLayerFields(layerUrl) {
  const base = layerUrl.replace(/\/query\/?$/, '');
  const url = `${base}?f=json`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'OmniEngine-Discover/0.1' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const body = await res.json();
  if (body.error) throw new Error(`ArcGIS error: ${body.error.message}`);
  return { fields: body.fields || [], name: body.name, zoningField: (body.fields || []).map((f) => f.name).find((n) => /zoning|^zone/i.test(n)) };
}

async function main() {
  const args = process.argv.slice(2);
  let url, out;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url') url = args[++i];
    else if (args[i] === '--out') out = args[++i];
  }
  if (!url) { console.error('Usage: node tools/discover-fields.js --url <layerUrl> [--out fieldmap.json]'); process.exit(1); }

  console.log(`Reading ${url.replace(/\/query\/?$/, '')}?f=json …`);
  const { fields, name } = await fetchLayerFields(url);
  const suggestion = suggestFieldMap(fields);

  console.log(`\nLayer: ${name || '(unnamed)'} — ${fields.length} fields`);
  console.log('All fields:', suggestion.allFields.join(', '));
  console.log('\nSuggested fieldMap:');
  console.log(JSON.stringify(suggestion.fieldMap, null, 2));
  if (suggestion.missing.length) console.log('\n⚠️  Could not auto-map (set by hand):', suggestion.missing.join(', '));

  if (out) {
    writeFileSync(out, JSON.stringify({ queryUrl: url, zoningField: suggestion.fieldMap.zoning, fieldMap: suggestion.fieldMap }, null, 2));
    console.log(`\nWrote ${out}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('discover-fields.js')) {
  main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
}
