#!/usr/bin/env node
/**
 * Auto-resolve county field maps — no hand-mapping.
 *
 * For every Vector B source in county-sources.json, this reads the live ArcGIS
 * layer, auto-detects the real column names, and writes them into the config in
 * place of the VERIFY_* placeholders. Run it once (or on a schedule) and the
 * scrape is configured with zero manual field work.
 *
 * Usage:
 *   node tools/auto-config.js                       # report only
 *   node tools/auto-config.js --write               # write resolved fields back
 *   node tools/auto-config.js --source config/county-sources.json --write
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { suggestFieldMap, fetchLayerFields } from './discover-fields.js';

const isPlaceholder = (v) => typeof v === 'string' && /^VERIFY_/.test(v);

/**
 * Pure: merge discovered field names into a source, replacing VERIFY_* and
 * filling gaps. Returns { source, resolved, stillMissing }.
 */
export function applyDiscovered(source, fields) {
  const { fieldMap: found } = suggestFieldMap(fields);
  const next = { ...source, fieldMap: { ...(source.fieldMap || {}) } };
  const resolved = [];

  // zoning field
  if ((isPlaceholder(next.zoningField) || !next.zoningField) && found.zoning) {
    next.zoningField = found.zoning;
    resolved.push(`zoningField=${found.zoning}`);
  }
  // fieldMap: fill placeholders and any keys we can detect
  const keys = new Set([...Object.keys(next.fieldMap), ...Object.keys(found)]);
  for (const k of keys) {
    if (k === 'zoning') continue; // zoning lives on zoningField
    if ((isPlaceholder(next.fieldMap[k]) || !next.fieldMap[k]) && found[k]) {
      next.fieldMap[k] = found[k];
      resolved.push(`${k}=${found[k]}`);
    }
  }
  const stillMissing = Object.entries(next.fieldMap)
    .filter(([, v]) => isPlaceholder(v))
    .map(([k]) => k)
    .concat(isPlaceholder(next.zoningField) ? ['zoningField'] : []);
  return { source: next, resolved, stillMissing };
}

async function main() {
  const args = process.argv.slice(2);
  let file = 'config/county-sources.json';
  let write = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source') file = args[++i];
    else if (args[i] === '--write') write = true;
  }

  const cfg = JSON.parse(readFileSync(file, 'utf8'));
  const sources = cfg.vectorB_dirtSweep?.sources || [];
  let anyChange = false;

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    process.stdout.write(`\n${src.county} … `);
    try {
      const { fields } = await fetchLayerFields(src.queryUrl);
      const { source: resolvedSrc, resolved, stillMissing } = applyDiscovered(src, fields);
      sources[i] = resolvedSrc;
      if (resolved.length) anyChange = true;
      console.log(`resolved ${resolved.length} field(s)${resolved.length ? ': ' + resolved.join(', ') : ''}`);
      if (stillMissing.length) console.log(`  ⚠️  still unmapped (this layer may not expose them): ${stillMissing.join(', ')}`);
    } catch (err) {
      console.log(`could not read live layer (${err.message}).`);
      console.log('  This usually means you are off the county network or behind a bot block — run from your own machine.');
    }
  }

  if (write && anyChange) {
    writeFileSync(file, JSON.stringify(cfg, null, 2));
    console.log(`\n✓ Wrote resolved field maps to ${file}.`);
  } else if (!write) {
    console.log('\n(report only — re-run with --write to save the resolved field maps.)');
  }
}

if (process.argv[1] && process.argv[1].endsWith('auto-config.js')) {
  main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
}
