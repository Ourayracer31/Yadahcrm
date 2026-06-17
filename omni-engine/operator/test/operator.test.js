/**
 * Offline tests for the Operator Intelligence Layer. No network, no Apify.
 * Covers all 10 modules. Run: node test/operator.test.js
 */
import { checkLanguage, assertCompliantLanguage, scrubLanguage, BANNED_TERMS } from '../src/language.js';
import { scoreOpportunity, operatorFitScore, builderPainScore, OPERATOR_FIT_FLOOR } from '../src/scoring.js';
import { fieldRealityCheck } from '../src/fieldReality.js';
import { evaluateDeal } from '../src/dealKiller.js';
import { generateOpener } from '../src/scripts.js';
import { buildBriefing, renderBriefing } from '../src/briefing.js';
import { asSuggestion, applyDecision, assertNoAutoSend } from '../src/decision.js';
import { RelationshipMemory } from '../src/memory.js';
import { generateWarRoom, renderWarRoom } from '../src/warRoom.js';
import { buildDailyPlan } from '../src/dailyOps.js';
import { runOperatorLayer } from '../src/index.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

const DATE = new Date('2026-06-15');

// ---- fixtures ----
const chokedBuilder = {
  displayName: 'Squeezed Homes LLC', permitsPerYear: 12, healthStatus: 'Choked (sitting inventory)',
  specSummary: { activeSpecs: 5, specsOverThreshold: 3, priceDrops: 2, maxPriceDropPct: 6, medianDom: 92, staleAddresses: ['1 A St'] },
};
const goodInfillLot = {
  parcelId: 'INFILL1', zoning: 'R-3', situsAddress: '123 Vine', situsCity: 'KANSAS CITY', county: 'Jackson',
  ownerName: 'Jane Heir', ownerMailingState: 'CA', outOfStateOwner: true, vacantOrTeardown: true,
  acreage: 0.2, landValue: 60000, equityProxy: 60000, yearsHeld: 14,
  sewerAvailable: true, waterAvailable: true, access: 'paved', compsStrength: 'ok',
};
const buyer = { displayName: 'BTR Capital LLC', recentAcquisitions: 12, mailingState: 'TX' };

const marginMatch = {
  id: 'M1', play: 'Margin Squeeze', builderRef: chokedBuilder, lotRef: goodInfillLot,
  fee: { type: 'Assignment / Finder Fee', amount: 10000 }, score: 82,
  parties: { builder: 'Squeezed Homes LLC', lot: '123 Vine', parcelId: 'INFILL1' },
  rationale: 'Squeezed Homes is absorbing inventory; option R-3 infill lot.',
};
const bailoutMatch = {
  id: 'M2', play: 'Liquidity Bailout', builderRef: chokedBuilder, buyerRef: buyer,
  fee: { type: 'Finder Fee', amount: 15000 }, score: 90, parties: { builder: 'Squeezed Homes LLC', buyer: 'BTR Capital LLC', doors: 3 },
};

// === MODULE 8: Language ===
ok(checkLanguage('we should wholesale this').length === 1, 'detects banned "wholesale"');
ok(checkLanguage('classic motivated seller, cash buyer').length === 2, 'detects multi-word banned terms');
ok(checkLanguage('transparent finder fee, net-to-seller offer').length === 0, 'preferred terms pass clean');
let threwLang = false; try { assertCompliantLanguage('act fast investor special'); } catch { threwLang = true; }
ok(threwLang, 'assertCompliantLanguage throws on banned');
ok(scrubLanguage('lock it up now').clean.includes('secure an option'), 'scrub rewrites "lock it up"');
ok(BANNED_TERMS.includes('wholesale') && BANNED_TERMS.includes('investor special'), 'banned list complete');

// === MODULE 4: Field Reality ===
const fcGood = fieldRealityCheck(goodInfillLot);
ok(fcGood.buildable === true, 'clean lot is buildable');
const fcBad = fieldRealityCheck({ sewerAvailable: false, access: 'none', inFloodplain: true });
ok(fcBad.buildable === false, 'no-sewer + no-access + flood = unbuildable');
ok(fcBad.flags.some((f) => f.code === 'NO_SEWER'), 'flags NO_SEWER');
ok(fcBad.flags.some((f) => f.code === 'BAD_ACCESS'), 'flags BAD_ACCESS');
const fcUnverified = fieldRealityCheck({});
ok(fcUnverified.flags.some((f) => f.severity === 'verify'), 'empty lot yields verify flags, not assumed-good');
ok(fieldRealityCheck({ assumedUnits: 8, zonedMaxUnits: 4 }).flags.some((f) => f.code === 'DENSITY_UNREALISTIC'), 'catches unrealistic density');

// === MODULE 3: Scoring ===
ok(builderPainScore(chokedBuilder) >= 8, 'choked builder high pain');
const scored = scoreOpportunity({ play: 'Margin Squeeze', builder: chokedBuilder, lot: goodInfillLot, fee: { amount: 10000 } }, { fieldCheck: fcGood });
ok(scored.scores.builderPain >= 8, 'opportunity carries builder pain');
ok(scored.scores.landownerMotivation >= 7, 'absentee + idle + long-hold = high motivation');
ok(scored.scores.operatorFit >= OPERATOR_FIT_FLOOR, 'Margin Squeeze meets operator-fit floor');
ok(scored.priority === 'high' || scored.priority === 'medium', 'reasonable priority bucket');
const lowFit = scoreOpportunity({ play: 'Liquidity Bailout', builder: { specSummary: {} }, fee: { amount: 5000 } }, { fieldCheck: { buildable: false, severityScore: 10, flags: [] } });
ok(lowFit.deprioritized === true, 'low operator-fit deprioritizes');

// === MODULE 7: Deal Killer ===
const killNoPain = evaluateDeal({ play: 'Margin Squeeze', lot: goodInfillLot }, { builderPain: 2, profitPotential: 7 }, fcGood, {});
ok(killNoPain.status === 'kill' && /no real builder pain/i.test(killNoPain.reasons.join(' ')), 'kills when no builder pain');
const killUtil = evaluateDeal({ lot: { } }, { builderPain: 8 }, fcBad, {});
ok(killUtil.status === 'kill', 'kills on unbuildable/no-utility');
const proceed = evaluateDeal({ play: 'Margin Squeeze', lot: goodInfillLot }, { builderPain: 8, profitPotential: 7, feasibility: 9 }, fcGood, {});
ok(proceed.status === 'proceed', 'clean deal proceeds');
const downgrade = evaluateDeal({ play: 'Margin Squeeze', lot: { ...goodInfillLot, timelineMonths: 12 } }, { builderPain: 8, profitPotential: 7, feasibility: 9 }, fcGood, {});
ok(downgrade.status === 'downgrade' && /timeline/i.test(downgrade.reasons.join(' ')), 'downgrades on long timeline');
ok(killNoPain.reasons.length > 0, 'every kill carries a reason');

// === MODULE 2: Scripts ===
const opener = generateOpener({ play: 'Margin Squeeze', builder: chokedBuilder, lot: goodInfillLot }, 'builder');
ok(/specs/i.test(opener.text) && /reading it wrong/i.test(opener.text), 'builder opener is observation+humility');
ok(!/i have a (land|deal)/i.test(opener.text), 'opener is not a pitch');
ok(opener.structure.observation && opener.structure.fieldQuestion && opener.structure.noPressure, 'opener has 5-beat structure');
let threwScript = false;
try { assertCompliantLanguage(generateOpener({ play: 'Margin Squeeze', builder: chokedBuilder }, 'builder').text); } catch { threwScript = true; }
ok(!threwScript, 'generated opener passes language guard');

// === MODULE 1: Briefing ===
const sc = scoreOpportunity({ play: 'Margin Squeeze', builder: chokedBuilder, lot: goodInfillLot, fee: { amount: 10000 } }, { fieldCheck: fcGood });
const de = evaluateDeal({ play: 'Margin Squeeze', builder: chokedBuilder, lot: goodInfillLot }, sc.scores, fcGood, {});
const brief = buildBriefing(
  { play: 'Margin Squeeze', builder: chokedBuilder, lot: goodInfillLot, fee: { amount: 10000, note: 'duplex assign' }, rationale: 'test' },
  { ...sc, fieldCheck: fcGood, dealEval: de });
ok(brief.contact.name === 'Squeezed Homes LLC', 'briefing identifies contact');
ok(Array.isArray(brief.doNotSay) && brief.doNotSay.length >= 3, 'briefing has What-NOT-to-say');
ok(brief.bestOpeningAngle && brief.fieldConcerns.length >= 1, 'briefing has angle + field concerns');
ok(brief._advisory === true && brief.decision === 'awaiting-travis', 'briefing is advisory (human-final)');
const briefText = renderBriefing(brief);
ok(/DO NOT SAY/.test(briefText) && /RECOMMENDED NEXT ACTION/.test(briefText), 'rendered briefing has all sections');

// === MODULE 9: Human Final Decision ===
const sug = asSuggestion({ x: 1 });
ok(sug.decision === 'awaiting-travis' && sug.autoSend === false, 'asSuggestion marks advisory');
ok(assertNoAutoSend(sug) === sug, 'assertNoAutoSend passes advisory artifact');
let threwAuto = false; try { assertNoAutoSend({ autoSend: true }); } catch { threwAuto = true; }
ok(threwAuto, 'assertNoAutoSend blocks auto-send');
const decided = applyDecision(sug, { action: 'pursue', note: 'real pain', angleChosen: 'lot pipeline' });
ok(decided.decision === 'pursue' && decided.decidedBy === 'Travis Manley', 'applyDecision records Travis decision');
let threwDec = false; try { applyDecision(sug, { action: 'bogus' }); } catch { threwDec = true; }
ok(threwDec, 'applyDecision rejects invalid action');

// === MODULE 5: Relationship Memory ===
const mem = new RelationshipMemory();
mem.upsert({ name: 'Squeezed Homes LLC', type: 'builder', trustLevel: 7, builds: 'duplexes', buildsWhere: 'KCMO' });
ok(mem.get('squeezed homes llc').trustLevel === 7, 'memory upsert + case-insensitive get');
mem.recordInteraction('Squeezed Homes LLC', { summary: 'talked specs', painLearned: '3 stale specs', nextFollowUp: '2026-06-15' });
ok(mem.get('Squeezed Homes LLC').conversationCount === 1, 'interaction increments count');
ok(mem.get('Squeezed Homes LLC').currentPain === '3 stale specs', 'interaction records pain');
ok(mem.dueFollowUps(DATE).length === 1, 'dueFollowUps surfaces due contact');
ok(mem.dueFollowUps(new Date('2026-06-14')).length === 0, 'follow-up not due yet before date');

// === MODULES 6 + 10 + orchestrator ===
mem.upsert({ name: 'Squeezed Homes LLC', authority: true });
const result = runOperatorLayer({ matches: [marginMatch, bailoutMatch], memory: mem, date: DATE });
ok(result.opportunities.length === 2, 'orchestrator processes all matches');
ok(result.stats.live >= 1, 'at least one live opportunity');
ok(result.warRoom._advisory === true, 'war room is advisory');
ok(result.warRoom.firstCall && result.warRoom.firstCall.who, 'war room names a first call');
ok(Array.isArray(result.warRoom.dealsToKill), 'war room has deals-to-kill section');
const wrText = renderWarRoom(result.warRoom);
ok(/ONE HIGH-VALUE CALL FIRST/.test(wrText) && /STOP CHASING/.test(wrText), 'war room renders all sections');

// Daily plan split + KPI tracker
const plan = result.dailyPlan;
ok(plan.targets.builder === 10 && plan.targets.landowner === 10 && plan.targets.investor === 5 && plan.targets.followUp === 5, '30-contact split is 10/10/5/5');
ok(plan.cards.relationshipFollowUps.length === 1, 'follow-up card pulled from memory');
const card = plan.cards.builderConversations[0];
ok(card && card.openingLine && card.discoveryQuestion && card.likelyObjection && card.responseToObjection && card.whatToListenFor && card.followUpAction && card.reasonForContact, 'daily-ops card has all 7 prep fields');
ok('conversationsStarted' in plan.kpiTracker && 'assignmentsClosed' in plan.kpiTracker, 'KPI tracker present');

// language guard holds across the whole rendered surface
let leak = false;
for (const o of result.opportunities) {
  if (checkLanguage(renderBriefing(o.briefing)).length) leak = true;
}
ok(!leak, 'no banned language leaks into any rendered briefing');

console.log(`\nOPERATOR LAYER TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
