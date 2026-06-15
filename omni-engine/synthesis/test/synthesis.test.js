/**
 * Offline tests for the Opportunity Synthesis Engine. No network.
 * Run: node test/synthesis.test.js
 */
import { runSynthesis, assertCreated, SYNTHESIS_PRINCIPLE } from '../src/synthesize.js';
import { peopleFit, timingAlignment, capitalReadiness, landViability, extractPrimitives } from '../src/primitives.js';
import { runOperatorLayer, renderBriefing } from '../../operator/src/index.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

const builders = [
  { displayName: 'Squeezed Homes LLC', permitsPerYear: 12, healthStatus: 'Choked (sitting inventory)', metro: 'KANSAS CITY',
    productType: 'duplex/infill', specSummary: { activeSpecs: 5, specsOverThreshold: 3, priceDrops: 2, medianDom: 92 } },
  { displayName: 'Momentum Build Co', permitsPerYear: 18, healthStatus: 'Selling out (fast absorption)', metro: 'KANSAS CITY',
    productType: 'duplex', specSummary: { activeSpecs: 3, specsOverThreshold: 0, medianDom: 18 } },
  { displayName: 'Sallee Development', permitsPerYear: 40, healthStatus: 'Selling out (fast absorption)', heavyHitter: true, metro: 'CASS',
    specSummary: { activeSpecs: 4, specsOverThreshold: 0, medianDom: 22 } },
];
const lots = [
  { parcelId: 'INFILL1', zoning: 'R-3', situsAddress: '123 Vine', situsCity: 'KANSAS CITY', county: 'Jackson',
    ownerName: 'Jane Heir', ownerMailingState: 'CA', outOfStateOwner: true, vacantOrTeardown: true, acreage: 0.2,
    landValue: 60000, equityProxy: 60000, yearsHeld: 14 },
  { parcelId: 'TRACT1', zoning: 'AG', situsAddress: 'County Line Rd', situsCity: 'CASS', county: 'Cass',
    ownerName: 'Family LP', ownerMailingState: 'FL', outOfStateOwner: true, vacantOrTeardown: true, acreage: 22,
    landValue: 220000, equityProxy: 220000, yearsHeld: 30 },
];
const buyers = [{ displayName: 'BTR Capital LLC', recentAcquisitions: 12, mailingState: 'TX' }];

// === primitive scorers ===
ok(peopleFit(builders[0], lots[0]) >= 8, 'people fit high for needy builder + fitting infill lot');
ok(timingAlignment(builders[0], lots[0]) >= 7, 'timing aligns patient absentee land + urgent choked builder');
ok(capitalReadiness(buyers[0]) === 9, 'BTR buyer w/ 12 buys = capital 9');
ok(capitalReadiness(null, builders[0]) < 9, 'no committed exit = lower capital');
ok(landViability(lots[0]) === 8 && landViability(lots[1]) === 7, 'land viability: infill 8, tract 7');

// === extractPrimitives organizes the four pools ===
const prim = extractPrimitives({ builders, lots, buyers });
ok(prim.people.builders.length === 3 && prim.people.landowners.length === 2 && prim.people.investors.length === 1, 'primitives split People correctly');
ok(prim.land.length === 2, 'Land pool');
ok(prim.capital.some((c) => c.kind === 'btr-exit') && prim.capital.some((c) => c.kind === 'build-capacity'), 'Capital pool has exit + capacity');

// === core synthesis ===
const created = runSynthesis({ builders, lots, buyers });
ok(created.length > 0, 'synthesis creates opportunities');

// every opportunity is CREATED, never discovered
ok(created.every((o) => o.origin === 'synthesized' && o.discovered === false), 'all opportunities are created (never discovered)');
created.forEach((o) => assertCreated(o)); // throws if any violate
let threwDisc = false;
try { assertCreated({ origin: 'matched', discovered: true }); } catch { threwDisc = true; }
ok(threwDisc, 'assertCreated rejects a "discovered" opportunity');

// flagship chain present: Land + Builder + Capital
const chain = created.find((o) => o.play === 'Created Chain (Land+Builder+Capital)');
ok(chain, 'creates the de-risked 3-party chain');
ok(chain.synthesis.primitivesUsed.people.length === 3, 'chain combines three people (builder, landowner, buyer)');
ok(chain.fee.amount === 25000, 'chain fee = $10k assignment + $5k x 3 doors = $25k, got ' + chain.fee?.amount);
ok(/option .*idle/i.test(chain.synthesis.creationThesis), 'chain thesis describes creation');
ok(chain.synthesis.creationConditions.length >= 3, 'chain lists conditions to make true');
ok(/option/i.test(chain.synthesis.catalyst), 'chain names a catalyst (the option bridge)');

// tract creation -> Pipeline Drought for the heavy hitter
const tract = created.find((o) => o.play === 'Pipeline Drought');
ok(tract && tract.lotRef.parcelId === 'TRACT1', 'creates tract opportunity for heavy hitter');

// sorted by synthesis score desc
ok(created.every((o, i) => i === 0 || created[i - 1].synthesis.synthesisScore >= o.synthesis.synthesisScore), 'sorted by synthesis score');
ok(SYNTHESIS_PRINCIPLE.includes('created, not discovered'), 'principle is explicit');

// === created opportunities flow THROUGH the operator layer ===
const result = runOperatorLayer({ matches: created });
ok(result.opportunities.length === created.length, 'operator layer processes created opportunities');
const liveCreated = result.opportunities.find((o) => o.synthesis && o.dealEval.status !== 'kill' && !o.score.deprioritized);
ok(liveCreated, 'at least one live created opportunity survives operator scoring');
const brief = renderBriefing(liveCreated.briefing);
ok(/CREATED OPPORTUNITY \(not discovered\)/.test(brief), 'briefing surfaces creation provenance');
ok(/Catalyst:/.test(brief) && /Conditions to make true/.test(brief), 'briefing shows catalyst + conditions');

console.log(`\nSYNTHESIS TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
