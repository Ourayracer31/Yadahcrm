/**
 * Offline tests for the daily runner. No network. Writes to a temp dir.
 * Run: node test/runner.test.js
 */
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDailyPipeline } from '../src/pipeline.js';
import { loadJson, writeArtifacts, loadInputs, loadMemory } from '../src/io.js';
import { renderWarRoom } from '../../operator/src/index.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const tmp = mkdtempSync(join(tmpdir(), 'omni-runner-'));

const builders = [
  { displayName: 'Squeezed Homes LLC', permitsPerYear: 12, healthStatus: 'Choked (sitting inventory)', metro: 'KANSAS CITY', specSummary: { activeSpecs: 5, specsOverThreshold: 3, priceDrops: 2, medianDom: 92 } },
  { displayName: 'Sallee Development', permitsPerYear: 40, healthStatus: 'Selling out (fast absorption)', heavyHitter: true, metro: 'CASS', specSummary: { activeSpecs: 4, specsOverThreshold: 0, medianDom: 22 } },
];
const lots = [
  { parcelId: 'INFILL1', zoning: 'R-3', situsAddress: '123 Vine', situsCity: 'KANSAS CITY', county: 'Jackson', ownerName: 'Jane Heir', outOfStateOwner: true, vacantOrTeardown: true, acreage: 0.2, landValue: 60000, equityProxy: 60000, yearsHeld: 14, sewerAvailable: true, access: 'paved' },
  { parcelId: 'TRACT1', zoning: 'AG', situsAddress: 'County Line Rd', situsCity: 'CASS', county: 'Cass', ownerName: 'Family LP', outOfStateOwner: true, vacantOrTeardown: true, acreage: 22, landValue: 220000, equityProxy: 220000, yearsHeld: 30, sewerAvailable: true, access: 'paved' },
];
const buyers = [{ displayName: 'BTR Capital LLC', recentAcquisitions: 12, mailingState: 'TX' }];

// === pipeline ===
const r = runDailyPipeline({ builders, lots, buyers, date: new Date('2026-06-15') });
ok(r.created.length > 0, 'pipeline creates opportunities');
ok(r.operatorResult.opportunities.length === r.created.length, 'operator processes all created opps');
ok(r.board.markdown && /# Travis Follow-Up Board/.test(r.board.markdown), 'board produced');
ok(r.operatorResult.stats.live >= 1, 'at least one live opportunity');
ok(renderWarRoom(r.operatorResult.warRoom).includes('FIRST'), 'war room renders');

// empty inputs -> graceful (no crash, zero opportunities)
const empty = runDailyPipeline({ builders: [], lots: [], buyers: [] });
ok(empty.created.length === 0 && empty.operatorResult.opportunities.length === 0, 'empty inputs handled gracefully');

// === io: load + write ===
writeFileSync(join(tmp, 'builders.json'), JSON.stringify(builders));
writeFileSync(join(tmp, 'lots.json'), JSON.stringify(lots));
writeFileSync(join(tmp, 'buyers.json'), JSON.stringify(buyers));
const inputs = loadInputs({ inputs: { builders: 'builders.json', lots: 'lots.json', buyers: 'buyers.json' } }, tmp);
ok(inputs.builders.length === 2 && inputs.lots.length === 2 && inputs.buyers.length === 1, 'loadInputs reads all three');
ok(loadJson(join(tmp, 'missing.json'), []).length === 0, 'loadJson returns fallback for missing file');

const mem = loadMemory({ memory: null }, tmp);
ok(mem.all().length === 0, 'loadMemory with no path = empty in-memory store');

const outDir = join(tmp, 'out');
const files = writeArtifacts(outDir, {
  warRoomText: renderWarRoom(r.operatorResult.warRoom),
  warRoom: r.operatorResult.warRoom,
  briefingsText: 'briefs',
  dailyPlan: r.operatorResult.dailyPlan,
  opportunities: r.operatorResult.opportunities,
  board: r.board,
});
ok(files.length >= 6, 'writeArtifacts wrote the artifact set');
ok(existsSync(join(outDir, 'war-room.txt')) && existsSync(join(outDir, 'board.md')) && existsSync(join(outDir, 'opportunities.json')), 'key artifacts on disk');
ok(/Travis Follow-Up Board/.test(readFileSync(join(outDir, 'board.md'), 'utf8')), 'board.md content correct');

console.log(`\nRUNNER TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
