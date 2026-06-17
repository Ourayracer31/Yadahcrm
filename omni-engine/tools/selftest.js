#!/usr/bin/env node
/**
 * FULL-CHAIN SELF-TEST — proves the operational pipeline end to end:
 *   live-shaped ArcGIS ingestion (real pagination/retry code)
 *     -> Vector B enrichment
 *     -> synthesis (create opportunities)
 *     -> operator (score / field-check / kill / brief)
 *     -> follow-up board
 *     -> contract generation
 *     -> conversation logging into memory
 *   + the Apify REST client (real request building + response handling)
 *
 * By default it injects authentic-shaped transports (no network needed), so it
 * exercises the REAL code paths, not reimplementations. With `--live` it uses
 * real fetch against your configured county service + APIFY_TOKEN — run that on
 * YOUR machine to confirm real sockets.
 *
 * Run:  node tools/selftest.js          (proves the code path here)
 *       node tools/selftest.js --live   (proves real network on your machine)
 */

import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { queryArcgis, leadsFromFeatures } from './pull-parcels.js';
import { runSyncUrl, datasetItemsUrl, runActorAndGetItems } from './apify.js';
import { runSynthesis } from '../synthesis/src/index.js';
import { runOperatorLayer, renderWarRoom } from '../operator/src/index.js';
import { generateFollowUpBoard } from '../contact-memory/src/index.js';
import { generateDealPacket, dealFromMatch } from '../contracts/src/index.js';
import { logConversation } from '../conversation/src/logCall.js';

const LIVE = process.argv.includes('--live');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; console.log(`  ✗ FAIL: ${m}`); } };
const section = (s) => console.log(`\n=== ${s} ===`);

// Authentic ArcGIS responses: page 1 signals more (exceededTransferLimit), page 2 ends.
function mockArcgis() {
  const F = (a) => ({ attributes: a });
  const page1 = {
    exceededTransferLimit: true,
    features: [
      F({ OBJECTID: 1, PARCEL_ID: 'JA-001', OWNER_NAME: 'Jane Heir', MAIL_STATE: 'CA', SITUS_ADDR: '123 Vine St', SITUS_CITY: 'KANSAS CITY', ZONING: 'R-3', LAND_USE: 'VAC', LAND_VALUE: 60000, IMPR_VALUE: 0, ACRES: 0.2 }),
      F({ OBJECTID: 2, PARCEL_ID: 'JA-002', OWNER_NAME: 'Holdover Trust', MAIL_STATE: 'MO', SITUS_ADDR: '5 Oak Ave', SITUS_CITY: 'KANSAS CITY', ZONING: 'R-3', LAND_USE: 'RES', LAND_VALUE: 30000, IMPR_VALUE: 120000, ACRES: 0.15 }),
    ],
  };
  const page2 = {
    exceededTransferLimit: false,
    features: [
      F({ OBJECTID: 3, PARCEL_ID: 'JA-003', OWNER_NAME: 'Out-of-State LP', MAIL_STATE: 'FL', SITUS_ADDR: '88 Troost', SITUS_CITY: 'KANSAS CITY', ZONING: 'R-4', LAND_USE: 'VAC', LAND_VALUE: 65000, IMPR_VALUE: 0, ACRES: 0.18 }),
    ],
  };
  return async (url) => {
    const offset = Number(new URL(url).searchParams.get('resultOffset') || 0);
    const body = offset === 0 ? page1 : page2;
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  };
}

// Authentic Apify run-sync-get-dataset-items response: an array of items.
function mockApify(items) {
  return async (url, opts) => {
    ok(/run-sync-get-dataset-items/.test(url) && opts.method === 'POST', 'Apify client POSTs the run-sync endpoint');
    return { ok: true, status: 200, json: async () => items, text: async () => JSON.stringify(items) };
  };
}

async function run() {
  console.log(`\nOMNI-ENGINE FULL-CHAIN SELF-TEST ${LIVE ? '(LIVE network)' : '(injected transport — real code paths)'}`);

  // ---- 1. Apify REST client: URL construction + run path ----
  section('1. Apify integration');
  ok(runSyncUrl('manley~vector-b', 'TKN').includes('/acts/manley~vector-b/run-sync-get-dataset-items?token=TKN'), 'run-sync URL built correctly');
  ok(runSyncUrl('manley/vector-b', 'TKN').includes('manley~vector-b'), 'username/actor normalized to username~actor');
  ok(datasetItemsUrl('ds123', 'TKN').includes('/datasets/ds123/items') && datasetItemsUrl('ds123', 'TKN').includes('clean=true'), 'dataset-items URL built correctly');
  const builders = await runActorAndGetItems('manley~vector-a', { permitSource: {} }, { token: 'TKN', fetchImpl: mockApify([
    { displayName: 'Squeezed Homes LLC', permitsPerYear: 12, healthStatus: 'Choked (sitting inventory)', metro: 'KANSAS CITY', specSummary: { activeSpecs: 5, specsOverThreshold: 3, priceDrops: 2, medianDom: 92 } },
  ]) });
  ok(Array.isArray(builders) && builders[0].displayName === 'Squeezed Homes LLC', 'Apify client returns dataset items');

  // ---- 2. Live-shaped ArcGIS ingestion (REAL pagination/retry + enrichment) ----
  section('2. ArcGIS ingestion (Vector B)');
  const source = {
    county: 'Jackson (KCMO)', state: 'MO', queryUrl: 'https://example/MapServer/0/query', zoningField: 'ZONING',
    fieldMap: { parcelId: 'PARCEL_ID', ownerName: 'OWNER_NAME', ownerMailingState: 'MAIL_STATE', situsAddress: 'SITUS_ADDR', situsCity: 'SITUS_CITY', landUse: 'LAND_USE', landValue: 'LAND_VALUE', improvementValue: 'IMPR_VALUE', acreage: 'ACRES' },
  };
  const rows = [];
  for await (const r of queryArcgis({ queryUrl: source.queryUrl, where: "UPPER(ZONING) LIKE 'R-3%'", pageSize: 2, maxRecords: 0, fetchImpl: mockArcgis(), sleepImpl: async () => {} })) rows.push(r);
  ok(rows.length === 3, `paginated across pages, pulled ${rows.length} parcels`);
  const lots = leadsFromFeatures(rows, source, { vacantOnly: false, teardownImprovementCeiling: 25000, vacantLandUseCodes: ['VAC'], minAcreage: 0, maxAcreage: 0, minEquityProxy: 0 });
  ok(lots.length === 3 && lots[0].outOfStateOwner === true && lots[0].vacantOrTeardown === true, 'enriched leads (out-of-state + vacant derived from raw fields)');

  // ---- 3. Ingested data -> synthesis -> operator -> board ----
  section('3. Intelligence chain on ingested data');
  const buyers = [{ displayName: 'BTR Capital LLC', recentAcquisitions: 12, mailingState: 'TX' }];
  const created = runSynthesis({ builders, lots, buyers });
  ok(created.length > 0 && created.every((o) => o.origin === 'synthesized' && o.discovered === false), 'synthesis CREATED opportunities (never discovered)');
  const result = runOperatorLayer({ matches: created });
  ok(result.opportunities.length === created.length && result.stats.live >= 1, `operator scored ${result.opportunities.length} opps, ${result.stats.live} live, ${result.stats.killed} killed`);
  const board = generateFollowUpBoard({ opportunities: result.opportunities, date: new Date('2026-06-16') });
  ok(/Travis Follow-Up Board/.test(board.markdown) && board.board.firstCall, `board built; first call: ${board.board.firstCall?.name}`);
  const wr = renderWarRoom(result.warRoom);
  ok(/STOP CHASING/.test(wr), 'war room includes deal-killer section');

  // ---- 4. Contract generation from a real match ----
  section('4. Contract generation');
  const landDeal = result.opportunities.find((o) => o.lot && o.dealEval.status !== 'kill' && !o.score.deprioritized);
  ok(landDeal, 'a land-based opportunity survived to contract stage');
  if (landDeal) {
    const match = created.find((m) => m.id === landDeal.id);
    const deal = dealFromMatch(match, { seller: { name: landDeal.lot.ownerName, netToSeller: landDeal.lot.landValue }, assignee: { name: landDeal.builder?.displayName } });
    const packet = generateDealPacket(deal);
    ok(/Buyer Disclosure of Role/.test(packet.option.markdown) && /100% of all closing costs/.test(packet.option.markdown), 'Option to Purchase has mandated clauses');
    ok(/As-Is Field Professional/.test(packet.assignment.markdown) && /Double-Signature Title Directive/.test(packet.assignment.markdown), 'Assignment has As-Is + Double-Signature clauses');
    ok(!/wholesale/i.test(packet.option.markdown + packet.assignment.markdown), 'no prohibited "wholesale" language');
  }

  // ---- 5. Conversation -> memory (append-only) ----
  section('5. Conversation capture');
  const root = mkdtempSync(join(tmpdir(), 'omni-selftest-'));
  const r = await logConversation({ contactName: 'Squeezed Homes LLC', type: 'builder', transcript: 'Three specs sitting 70+ days, short on lots, follow up next week.', root, memoryPath: join(root, 'crm.json'), now: new Date('2026-06-16'), heuristic: true });
  ok(existsSync(join(root, r.relPath)) && r.nextFollowUp === '2026-06-23', `logged + filed (${r.relPath}), follow-up ${r.nextFollowUp}`);
  ok(/Conversation History/.test(readFileSync(join(root, r.relPath), 'utf8')), 'conversation rendered into memory file');

  // ---- 6. LIVE network (only with --live, on a reachable machine) ----
  if (LIVE) {
    section('6. LIVE network');
    try {
      const cfg = JSON.parse(readFileSync('config/county-sources.json', 'utf8'));
      const src = cfg.vectorB_dirtSweep.sources[0];
      const liveRows = [];
      for await (const r2 of queryArcgis({ queryUrl: src.queryUrl, where: '1=1', pageSize: 3, maxRecords: 3 })) liveRows.push(r2);
      ok(liveRows.length > 0, `LIVE county query returned ${liveRows.length} rows from ${src.county}`);
    } catch (err) {
      ok(false, `LIVE county query failed: ${err.message} (run on a machine that can reach the county network)`);
    }
    if (process.env.APIFY_TOKEN) {
      try {
        const res = await fetch(`https://api.apify.com/v2/users/me?token=${process.env.APIFY_TOKEN}`);
        ok(res.ok, `LIVE Apify token valid (HTTP ${res.status})`);
      } catch (err) { ok(false, `LIVE Apify check failed: ${err.message}`); }
    } else {
      console.log('  (skipping live Apify check — set APIFY_TOKEN to test)');
    }
  }

  console.log(`\n${'='.repeat(60)}\nSELF-TEST: ${pass} passed, ${fail} failed${LIVE ? '' : '  (run with --live on your machine to test real network)'}`);
  process.exit(fail ? 1 : 0);
}

run().catch((err) => { console.error('\nSELF-TEST CRASHED:', err.stack || err.message); process.exit(1); });
