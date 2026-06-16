#!/usr/bin/env node
/**
 * Add a builder you know — in ~20 seconds, no JSON. Your field knowledge (who's
 * building, who's squeezed) is the spark the engine is designed around. The first
 * time you add one, the bundled sample builders are cleared so your real list
 * starts clean.
 *
 * Run: npm run add-builder     (or: node tools/add-builder.js)
 */

import { createInterface } from 'node:readline/promises';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILDERS = join(ROOT, 'samples', 'builders.json');
const SAMPLE_NAMES = ['Squeezed Homes LLC', 'Momentum Build Co', 'Sallee Development'];

/** Turn plain answers into a builder record (honest fields from the operator). */
export function buildBuilderRecord({ name, area, product, situation, specsSitting }) {
  const metro = String(area || '').toUpperCase();
  let healthStatus, specSummary;
  if (situation === 'choked') {
    const n = Math.max(1, Number(specsSitting) || 1);
    healthStatus = 'Choked (sitting inventory)';
    specSummary = { activeSpecs: n, specsOverThreshold: n, priceDrops: 0, medianDom: 70 };
  } else if (situation === 'hungry') {
    healthStatus = 'Selling out (fast absorption)';
    specSummary = { activeSpecs: 3, specsOverThreshold: 0, medianDom: 20 };
  } else {
    healthStatus = 'Building, low spec exposure';
    specSummary = { activeSpecs: 0, specsOverThreshold: 0, medianDom: 0 };
  }
  return { displayName: String(name).trim(), metro, productType: String(product || '').trim() || 'mixed', permitsPerYear: 12, healthStatus, specSummary, addedBy: 'travis' };
}

/** Append a builder, clearing the bundled samples the first time. Returns the new list. */
export function appendBuilder(file, record) {
  let list = [];
  if (existsSync(file)) { try { list = JSON.parse(readFileSync(file, 'utf8')); } catch { list = []; } }
  const isSampleOnly = list.length > 0 && list.every((b) => SAMPLE_NAMES.includes(b.displayName));
  if (isSampleOnly) list = [];
  // de-dupe by name
  list = list.filter((b) => b.displayName.toUpperCase() !== record.displayName.toUpperCase());
  list.push(record);
  writeFileSync(file, JSON.stringify(list, null, 2));
  return list;
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q) => (await rl.question(q)).trim();

  console.log('\nAdd a builder you know (Ctrl-C to stop):\n');
  const name = await ask('  Builder / company name: ');
  if (!name) { console.log('No name — nothing added.'); rl.close(); return; }
  const area = await ask('  What area do they build? (e.g. KCMO, Olathe): ');
  const product = await ask('  What do they build? (e.g. duplex, infill, single-family): ');
  console.log('  Right now, which is most true?');
  console.log('    1) Specs sitting unsold (choked)');
  console.log('    2) Selling fast, short on lots (hungry for dirt)');
  console.log('    3) Building, won\'t risk cash on raw dirt');
  const choice = await ask('  Pick 1, 2, or 3: ');
  const situation = choice === '1' ? 'choked' : choice === '3' ? 'cautious' : 'hungry';
  let specsSitting = 0;
  if (situation === 'choked') specsSitting = await ask('  Roughly how many specs sitting 60+ days? ');

  const record = buildBuilderRecord({ name, area, product, situation, specsSitting });
  const list = appendBuilder(BUILDERS, record);
  console.log(`\n✓ Added ${record.displayName} (${record.healthStatus}). You now have ${list.length} builder(s).`);
  console.log('  Run  npm start  to rebuild your board with them.\n');

  const again = await ask('Add another? (y/N): ');
  rl.close();
  if (/^y/i.test(again)) { const { spawnSync } = await import('node:child_process'); spawnSync('node', [join(ROOT, 'tools', 'add-builder.js')], { stdio: 'inherit' }); }
}

if (process.argv[1] && process.argv[1].endsWith('add-builder.js')) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
