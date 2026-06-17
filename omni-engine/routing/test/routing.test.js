/**
 * Offline tests for the n8n / webhook routing layer. No real network -
 * a recording mock transport is injected. Run: node test/routing.test.js
 */
import { routeToCrm, channelForOpportunity, CHANNELS, endpointFor, assertInternalOnly, dispatch } from '../src/index.js';
import { runSynthesis } from '../../synthesis/src/index.js';
import { runOperatorLayer } from '../../operator/src/index.js';
import { generateFollowUpBoard } from '../../contact-memory/src/index.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

// recording transport
function mockTransport() {
  const calls = [];
  const fn = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return { ok: true, status: 200 }; };
  fn.calls = calls;
  return fn;
}

// === channel classification ===
ok(channelForOpportunity({ dealEval: { status: 'kill' } }) === CHANNELS.DEALS_TO_KILL, 'killed -> dealsToKill');
ok(channelForOpportunity({ score: { deprioritized: true } }) === CHANNELS.DEALS_TO_KILL, 'deprioritized -> dealsToKill');
ok(channelForOpportunity({ synthesis: {}, score: { priority: 'high' } }) === CHANNELS.NEW_MATCHES, 'synthesized -> newMatches');
ok(channelForOpportunity({ score: { priority: 'high' } }) === CHANNELS.HIGH_PRIORITY, 'high priority -> highPriority');
ok(channelForOpportunity({ score: { priority: 'low' } }) === CHANNELS.DEFAULT, 'low -> default');
ok(endpointFor('missing', { default: 'D' }) === 'D', 'unknown channel falls back to default endpoint');

// === internal-only guard ===
let threw = false; try { assertInternalOnly({ outreach: true, audience: 'lead' }); } catch { threw = true; }
ok(threw, 'assertInternalOnly blocks outreach payloads');
ok(assertInternalOnly({ outreach: false, audience: 'travis-dashboard' }).advisory === undefined, 'internal payload passes');

// === dispatch retry/backoff (no real waiting) ===
let attempts = 0;
const flaky = async () => { attempts += 1; if (attempts < 3) throw new Error('boom'); return { ok: true, status: 200 }; };
const r = await dispatch('http://x', { a: 1 }, { transport: flaky, sleepFn: async () => {}, maxRetries: 4 });
ok(r.status === 'sent' && r.attempts === 3, 'dispatch retries then succeeds on 3rd attempt');
const r2 = await dispatch('http://x', {}, { transport: async () => { throw new Error('down'); }, sleepFn: async () => {}, maxRetries: 3 });
ok(r2.status === 'failed' && r2.attempts === 3, 'dispatch reports failure after max retries');
const r3 = await dispatch('http://x', {}, { dryRun: true });
ok(r3.status === 'skipped', 'dryRun skips sending');
const r4 = await dispatch(null, {}, {});
ok(r4.status === 'skipped' && r4.reason === 'no-endpoint', 'no endpoint -> skipped');

// === end-to-end routing of a real synthesized run ===
const builders = [
  { displayName: 'Squeezed Homes LLC', permitsPerYear: 12, healthStatus: 'Choked (sitting inventory)', metro: 'KANSAS CITY',
    specSummary: { activeSpecs: 5, specsOverThreshold: 3, priceDrops: 2, medianDom: 92 } },
  { displayName: 'Sallee Development', permitsPerYear: 40, healthStatus: 'Selling out (fast absorption)', heavyHitter: true, metro: 'CASS',
    specSummary: { activeSpecs: 4, specsOverThreshold: 0, medianDom: 22 } },
];
const lots = [
  { parcelId: 'INFILL1', zoning: 'R-3', situsAddress: '123 Vine', situsCity: 'KANSAS CITY', county: 'Jackson',
    ownerName: 'Jane Heir', outOfStateOwner: true, vacantOrTeardown: true, acreage: 0.2, landValue: 60000, equityProxy: 60000, yearsHeld: 14, sewerAvailable: true, access: 'paved' },
  { parcelId: 'INFILL2', zoning: 'R-3', situsAddress: '88 Troost', situsCity: 'KANSAS CITY', county: 'Jackson',
    ownerName: 'Holdover Trust', vacantOrTeardown: true, acreage: 0.18, landValue: 55000, equityProxy: 55000, sewerAvailable: false, access: 'gravel' },
  { parcelId: 'TRACT1', zoning: 'AG', situsAddress: 'County Line Rd', situsCity: 'CASS', county: 'Cass',
    ownerName: 'Family LP', outOfStateOwner: true, vacantOrTeardown: true, acreage: 22, landValue: 220000, equityProxy: 220000, yearsHeld: 30, sewerAvailable: true, access: 'paved' },
];
const buyers = [{ displayName: 'BTR Capital LLC', recentAcquisitions: 12, mailingState: 'TX' }];

const created = runSynthesis({ builders, lots, buyers });
const opResult = runOperatorLayer({ matches: created });
const board = generateFollowUpBoard({ opportunities: opResult.opportunities, date: new Date('2026-06-15') });

const transport = mockTransport();
const endpoints = {
  default: 'https://n8n.example/webhook/omni',
  highPriority: 'https://n8n.example/webhook/hot',
  dealsToKill: 'https://n8n.example/webhook/kill',
  dailyDigest: 'https://n8n.example/webhook/digest',
};
const { manifest, stats } = await routeToCrm({
  operatorResult: opResult, board,
  config: { endpoints, transport, sleepFn: async () => {} },
});

ok(stats.total >= opResult.opportunities.length + 2, 'routed per-opportunity + warroom + board events');
ok(manifest.every((m) => m.status === 'sent'), 'all events dispatched');
ok(manifest.some((m) => m.event === 'warroom.daily') && manifest.some((m) => m.event === 'board.daily'), 'warroom + board events present');
ok(manifest.some((m) => m.event === 'firstcall.recommended'), 'first-call alert routed');

// every payload is internal-only + advisory + never outreach
ok(transport.calls.every((c) => c.body.outreach === false && c.body.audience === 'travis-dashboard' && c.body.advisory === true),
  'every routed payload is internal-only, advisory, no outreach');

// kill events routed to the kill channel
const killCall = transport.calls.find((c) => c.body.data && c.body.data.status === 'kill');
ok(killCall && /webhook\/kill/.test(killCall.url), 'killed opportunity routed to dealsToKill endpoint');

// dryRun sends nothing
const t2 = mockTransport();
const dry = await routeToCrm({ operatorResult: opResult, board, config: { endpoints, transport: t2, dryRun: true, sleepFn: async () => {} } });
ok(t2.calls.length === 0 && dry.stats.skipped === dry.stats.total, 'dryRun routes nothing over the wire');

console.log(`\nROUTING TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
