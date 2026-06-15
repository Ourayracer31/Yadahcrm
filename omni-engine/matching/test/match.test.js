/**
 * Offline tests for the Pain-Point matching engine. No network, no Apify.
 * Run: node test/match.test.js
 */
import { runMatches, groupByPlay } from '../src/match.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

const builders = [
  { displayName: 'Acme Build', permitsPerYear: 12, healthStatus: 'Selling out (fast absorption)',
    specSummary: { activeSpecs: 4, specsOverThreshold: 0, medianDom: 20 } },
  { displayName: 'Choked Co', permitsPerYear: 8, healthStatus: 'Choked (sitting inventory)',
    specSummary: { activeSpecs: 6, specsOverThreshold: 3, medianDom: 95 } },
  { displayName: 'Cautious Homes', permitsPerYear: 10, healthStatus: 'Building, low spec exposure',
    specSummary: { activeSpecs: 0, specsOverThreshold: 0, medianDom: 0 } },
  { displayName: 'Sallee Development', permitsPerYear: 40, healthStatus: 'Selling out (fast absorption)',
    heavyHitter: true, specSummary: { activeSpecs: 5, specsOverThreshold: 0, medianDom: 15 } },
];

const lots = [
  { parcelId: 'INFILL1', zoning: 'R-3', situsAddress: '123 Vine', vacantOrTeardown: true,
    acreage: 0.2, landValue: 60000, equityProxy: 60000 },
  { parcelId: 'PREMIUM1', zoning: 'R-3', situsAddress: '9 Maple', vacantOrTeardown: false,
    acreage: 0.3, totalAssessedValue: 250000, equityProxy: 250000 },
  { parcelId: 'TRACT1', zoning: 'AG', situsAddress: 'Rural Rd', vacantOrTeardown: true,
    acreage: 22, landValue: 200000, equityProxy: 200000 },
];

const buyers = [
  { displayName: 'BTR Capital LLC', recentAcquisitions: 12, mailingState: 'TX' },
];

const matches = runMatches({ builders, lots, buyers });
const byPlay = groupByPlay(matches);

// 1) Margin Squeeze: Acme (needs inventory) x INFILL1
ok(byPlay['Margin Squeeze']?.length >= 1, 'Margin Squeeze produced');
ok(byPlay['Margin Squeeze'][0].fee.amount === 10000, 'Margin Squeeze fee = $10k');
ok(byPlay['Margin Squeeze'].some((m) => m.parties.parcelId === 'INFILL1'), 'uses infill lot');

// 2) Liquidity Bailout: Choked Co (3 doors) x BTR buyer => $15k
const lb = byPlay['Liquidity Bailout']?.[0];
ok(lb, 'Liquidity Bailout produced');
ok(lb.fee.amount === 15000, 'Liquidity Bailout fee = $5k x 3 doors = $15k');
ok(lb.parties.buyer === 'BTR Capital LLC', 'routed to BTR buyer');

// 3) Capital Preservation: Cautious Homes x PREMIUM1 (120-day option)
const cp = byPlay['Capital Preservation']?.[0];
ok(cp, 'Capital Preservation produced');
ok(/120-day/.test(cp.fee.basis), 'Capital Preservation = 120-day option');
ok(cp.parties.parcelId === 'PREMIUM1', 'uses premium lot, not infill');

// 4) Pipeline Drought: Sallee (heavy hitter) x TRACT1, five-figure
const pd = byPlay['Pipeline Drought']?.[0];
ok(pd, 'Pipeline Drought produced');
ok(pd.fee.amount >= 10000, 'Pipeline Drought fee is five-figure');
ok(pd.parties.acres === 22, 'uses 22ac tract');

// negative: infill lot must NOT be offered as a tract
ok(!matches.some((m) => m.play === 'Pipeline Drought' && m.parties.parcelId === 'INFILL1'),
  'infill lot not used as tract');

// sorted by score desc
ok(matches.every((m, i) => i === 0 || matches[i - 1].score >= m.score), 'matches sorted by score');

console.log(`\nMATCHING TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
