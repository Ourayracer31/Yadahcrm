#!/usr/bin/env node
/**
 * "Just make it work." One command that gets Travis to a real board with the
 * least possible effort:
 *   1. ensure .env exists
 *   2. best-effort pull REAL county parcels (no account needed; works on his net)
 *   3. run the daily pipeline
 *   4. print the phone digest + where the board is
 *   5. tell him the ONE next step, in plain language
 *
 * Never crashes: if the network/accounts aren't there, it falls back to the
 * bundled sample data so he still sees a working board.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDigest } from '../notify/src/notify.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...x) => join(ROOT, ...x);
const run = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });

console.log('\n🏗️  Omni-Engine — getting your board ready…\n');

// 1) .env
if (!existsSync(p('.env')) && existsSync(p('.env.example'))) {
  copyFileSync(p('.env.example'), p('.env'));
  console.log('• Created .env (all keys optional — fill in later for phone numbers & alerts).');
}

// 2) best-effort REAL data (no account needed — just your network)
let gotRealData = false;
try {
  console.log('• Looking for real Kansas City parcel data…');
  run('node', ['tools/auto-config.js', '--source', 'config/county-sources.json', '--write']);
  for (const county of ['Jackson (KCMO)', 'Wyandotte (KCK)']) {
    const tmp = p('samples', `lots-${county.replace(/[^A-Za-z]/g, '')}.json`);
    const r = run('node', ['tools/pull-parcels.js', '--source', 'config/county-sources.json', '--county', county, '--vacant', '--max', '500', '--out', tmp]);
    if (r.status === 0 && existsSync(tmp) && statSync(tmp).size > 5) {
      try { if (JSON.parse(readFileSync(tmp, 'utf8')).length > 0) gotRealData = true; } catch { /* ignore */ }
    }
  }
  if (gotRealData) {
    // merge whatever pulled into samples/lots.json
    run('node', ['-e', `import('node:fs').then(fs=>{const files=fs.readdirSync('samples').filter(f=>/^lots-.*\\.json$/.test(f));const all=files.flatMap(f=>{try{return JSON.parse(fs.readFileSync('samples/'+f))}catch{return[]}});if(all.length)fs.writeFileSync('samples/lots.json',JSON.stringify(all,null,2));});`]);
    console.log('  ✓ Pulled real parcels from the county.');
  } else {
    console.log('  · No live county data reachable right now — using sample data so you can see how it looks.');
    console.log('    (On your own computer/network this pulls real KC parcels automatically.)');
  }
} catch {
  console.log('  · Using sample data for now.');
}

// 3) run the pipeline
console.log('• Building today\'s board…');
const daily = run('node', ['runner/src/daily.js', '--config', 'config/omni.config.example.json']);
if (daily.status !== 0) {
  console.error('\n✗ Something went wrong building the board:\n', (daily.stderr || daily.stdout || '').slice(-800));
  process.exit(1);
}

// 4) show the digest
const boardPath = p('out', 'board.json');
if (existsSync(boardPath)) {
  try { console.log('\n' + formatDigest(JSON.parse(readFileSync(boardPath, 'utf8'))) + '\n'); } catch { /* ignore */ }
}
console.log(`📋 Your full board: ${p('daily', 'travis-follow-up-board.md')}`);

// 5) the ONE next step
const buildersAreSample = (() => {
  try { return JSON.parse(readFileSync(p('samples', 'builders.json'), 'utf8')).some((b) => /Squeezed Homes|Momentum Build|Sallee Development/.test(b.displayName)); } catch { return true; }
})();

console.log('\n──────────────────────────────────────────────');
if (buildersAreSample) {
  console.log('👉 ONE THING to make these REAL deals: tell it the builders you know.');
  console.log('   Run:  npm run add-builder      (20 seconds each — no files to edit)');
  console.log('   You know who\'s building and who\'s squeezed; that\'s the spark it needs.');
} else {
  console.log('👉 You\'re live. To get phone numbers on the board, add a skip-trace key to .env.');
  console.log('   To get this on your phone each morning, set NOTIFY_CHANNEL=telegram in .env.');
}
console.log('   To run this every morning by itself:  node tools/daemon.js --at 06:00');
console.log('──────────────────────────────────────────────\n');
