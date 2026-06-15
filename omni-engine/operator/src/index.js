/**
 * OPERATOR INTELLIGENCE LAYER — orchestrator.
 *
 * "AI finds the conversations worth having. Travis creates the opportunity."
 *
 * This is the layer everything else runs through. It takes the raw output of the
 * three vectors and the matching engine and turns each match into a fully
 * prepared, scored, field-checked, killed-or-kept, briefed opportunity - then
 * assembles the Daily War Room and the 30-Contact OS on top. Nothing here is
 * auto-sent; every artifact is advisory (Module 9).
 *
 * Pipeline position:
 *   Vector A/B/C  ->  matching/  ->  [ operator/ ]  ->  contracts/ + n8n/CRM
 */

export * as language from './language.js';
export * as scoring from './scoring.js';
export * as decision from './decision.js';
export { fieldRealityCheck } from './fieldReality.js';
export { evaluateDeal } from './dealKiller.js';
export { buildBriefing, renderBriefing } from './briefing.js';
export { generateOpener, generateOpenerSet } from './scripts.js';
export { RelationshipMemory, blankContact } from './memory.js';
export { generateWarRoom, renderWarRoom } from './warRoom.js';
export { buildDailyPlan, blankKpiTracker } from './dailyOps.js';

import { scoreOpportunity } from './scoring.js';
import { fieldRealityCheck } from './fieldReality.js';
import { evaluateDeal } from './dealKiller.js';
import { buildBriefing } from './briefing.js';
import { generateOpenerSet } from './scripts.js';
import { generateWarRoom } from './warRoom.js';
import { buildDailyPlan } from './dailyOps.js';

/** Normalize a matching-engine match into the operator layer's opportunity shape. */
function toOpportunity(match) {
  return {
    id: match.id,
    play: match.play,
    builder: match.builderRef || null,
    lot: match.lotRef || null,
    buyer: match.buyerRef || null,
    fee: match.fee || null,
    rationale: match.rationale || '',
    parties: match.parties || {},
    baseScore: match.score ?? null,
  };
}

/**
 * Run the full Operator Intelligence Layer.
 *
 * @param {object} input
 * @param {Array}  input.matches  output of matching/runMatches()
 * @param {RelationshipMemory} [input.memory]
 * @param {Date}   [input.date]
 * @returns {{ opportunities, warRoom, dailyPlan, stats }}
 */
export function runOperatorLayer({ matches = [], memory = null, date = new Date() } = {}) {
  const opportunities = [];

  for (const match of matches) {
    const opp = toOpportunity(match);

    // 1) Field reality on the dirt (if any).
    const fieldCheck = opp.lot ? fieldRealityCheck(opp.lot) : { flags: [], severityScore: 0, buildable: true, verifyList: [] };

    // 2) CRM memory for the primary contact (drives trust-path score + authority).
    const primaryName = opp.builder?.displayName || opp.buyer?.displayName || opp.lot?.ownerName;
    const contactMemory = memory ? memory.get(primaryName) : null;

    // 3) Pain-first scoring (Operator Fit gates).
    const score = scoreOpportunity(opp, { contactMemory, fieldCheck });

    // 4) Deal-killer evaluation.
    const dealEval = evaluateDeal(opp, score.scores, fieldCheck, contactMemory || {});

    // 5) Briefing + reverse-selling scripts (advisory, language-guarded).
    const briefing = buildBriefing(opp, { ...score, fieldCheck, dealEval, contactMemory });
    const scripts = generateOpenerSet(opp);

    opportunities.push({ ...opp, fieldCheck, score, dealEval, briefing, scripts });
  }

  // Rank: live first by composite; killed/deprioritized sink.
  opportunities.sort((a, b) => {
    const ak = a.dealEval.status === 'kill' || a.score.deprioritized ? 1 : 0;
    const bk = b.dealEval.status === 'kill' || b.score.deprioritized ? 1 : 0;
    if (ak !== bk) return ak - bk;
    return b.score.composite - a.score.composite;
  });

  const warRoom = generateWarRoom({ opportunities, memory, date });
  const dailyPlan = buildDailyPlan({ opportunities, memory, date });

  const stats = {
    total: opportunities.length,
    live: opportunities.filter((o) => o.dealEval.status !== 'kill' && !o.score.deprioritized).length,
    killed: opportunities.filter((o) => o.dealEval.status === 'kill').length,
    deprioritized: opportunities.filter((o) => o.score.deprioritized && o.dealEval.status !== 'kill').length,
    downgraded: opportunities.filter((o) => o.dealEval.status === 'downgrade').length,
  };

  return { opportunities, warRoom, dailyPlan, stats };
}
