/**
 * MODULE 3 — Pain-First Scoring.
 *
 * Every opportunity is scored by PAIN before profit. Seven 1-10 sub-scores feed
 * a composite, but the gate is the Operator Fit Score: "is this the kind of
 * problem Travis can uniquely solve because of 32 years of construction
 * experience?" If Operator Fit < 7 the opportunity is deprioritized, no matter
 * how fat the spread looks.
 *
 * All scores are deterministic functions of the scraped/derived signals so the
 * same inputs always rank the same way (and so they are unit-testable).
 */

export const OPERATOR_FIT_FLOOR = 7;

const clamp = (n, lo = 1, hi = 10) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Builder under stress = worth a conversation. Two addressable pains: choke + drought. */
export function builderPainScore(builder) {
  if (!builder) return 1;
  const s = builder.specSummary || {};
  let score = 1;
  // (a) Inventory-choke pain: stale specs + price drops dominate.
  score += Math.min(5, (s.specsOverThreshold || 0) * 2);
  score += Math.min(2, (s.priceDrops || 0));            // discounting = pressure
  if ((s.medianDom || 0) >= 60) score += 1;
  // (b) Pipeline-drought pain: a fast-absorbing builder is hungry for dirt - that
  //     is real, addressable pain Travis can solve by feeding lots, not just a
  //     "healthy" signal. Likewise a builder running low on spec exposure wants
  //     to keep the pipeline full without risking cash on raw dirt.
  if (/selling out|fast absorption/i.test(builder.healthStatus || '')) score += 4;
  else if (/low spec exposure/i.test(builder.healthStatus || '')) score += 3;
  // Still pulling permits means squeezed, not dead - that is the addressable kind.
  if ((builder.permitsPerYear || 0) >= 5) score += 1;
  return clamp(score);
}

/** Landowner motivation, read WITHOUT pressure cues: absentee, idle dirt, equity, hold time. */
export function landownerMotivationScore(lot) {
  if (!lot) return 1;
  let score = 2;
  if (lot.outOfStateOwner) score += 3;
  if (lot.vacantOrTeardown) score += 2;
  if ((lot.yearsHeld || 0) >= 10) score += 2; // long-term holder
  if ((lot.equityProxy || 0) >= 50000) score += 1;
  return clamp(score);
}

/** Timing: how acute is the pressure right now. */
export function timingScore(builder, lot) {
  let score = 4;
  const dom = builder?.specSummary?.medianDom || 0;
  if (dom >= 90) score += 3;
  else if (dom >= 60) score += 2;
  if ((builder?.specSummary?.specsOverThreshold || 0) >= 3) score += 1;
  if (lot?.vacantOrTeardown) score += 1; // idle dirt, no carrying urgency working against us
  return clamp(score);
}

/** Feasibility = inverse of field-reality severity (see fieldReality.js). */
export function feasibilityScore(fieldCheck) {
  if (!fieldCheck) return 5; // unknown -> middling, must verify
  return clamp(10 - (fieldCheck.severityScore || 0));
}

/** Trust path: warm relationship beats cold. Reads from CRM memory if present. */
export function trustPathScore(contactMemory) {
  if (!contactMemory) return 3; // cold contact
  if (typeof contactMemory.trustLevel === 'number') return clamp(contactMemory.trustLevel);
  const conversations = contactMemory.conversationCount || 0;
  return clamp(3 + Math.min(6, conversations * 2));
}

/** Profit potential from the disclosed fee structure. */
export function profitPotentialScore(fee) {
  if (!fee) return 5;
  if (fee.amount === null || fee.amount === undefined) return 6; // e.g. paid-at-closing spread
  const amt = fee.amount;
  if (amt >= 25000) return 10;
  if (amt >= 15000) return 9;
  if (amt >= 10000) return 7;
  if (amt >= 5000) return 5;
  return clamp(Math.round(amt / 2000));
}

/**
 * Operator Fit: does this need Travis's construction judgment specifically?
 * Plays that hinge on feasibility translation (infill duplex, build-to-suit,
 * tract entitlement) score high; pure matchmaking scores lower. Real builder
 * pain and field complexity both raise fit, because that is where 32 years pays.
 */
export function operatorFitScore({ play, builder, fieldCheck }) {
  const base = {
    'Margin Squeeze': 8,
    'Capital Preservation': 8,
    'Pipeline Drought': 8,
    'Liquidity Bailout': 6,
  }[play] ?? 5;

  let score = base;
  const pain = builderPainScore(builder);
  if (pain >= 7) score += 1;            // stress Travis can move
  const flags = fieldCheck?.flags?.length || 0;
  if (flags >= 2 && (fieldCheck?.buildable ?? true)) score += 1; // nuanced but workable = his edge
  if (fieldCheck && fieldCheck.buildable === false) score -= 2;  // unbuildable = no edge, just risk
  return clamp(score);
}

/**
 * Score a full opportunity. Returns all seven scores, a composite, the
 * deprioritize flag (operatorFit < floor), and a priority bucket.
 */
export function scoreOpportunity(opp, { contactMemory, fieldCheck } = {}) {
  const scores = {
    builderPain: builderPainScore(opp.builder),
    landownerMotivation: landownerMotivationScore(opp.lot),
    timing: timingScore(opp.builder, opp.lot),
    feasibility: feasibilityScore(fieldCheck),
    trustPath: trustPathScore(contactMemory),
    profitPotential: profitPotentialScore(opp.fee),
    operatorFit: operatorFitScore({ play: opp.play, builder: opp.builder, fieldCheck }),
  };

  // Pain-first weighting: pain + fit + feasibility outweigh raw profit.
  const composite = Math.round(
    (scores.builderPain * 2 +
      scores.landownerMotivation * 1.5 +
      scores.timing * 1 +
      scores.feasibility * 1.5 +
      scores.trustPath * 1 +
      scores.profitPotential * 1 +
      scores.operatorFit * 2) /
      10 * 10,
  ) / 10;

  const deprioritized = scores.operatorFit < OPERATOR_FIT_FLOOR;
  let priority;
  if (deprioritized) priority = 'deprioritized';
  else if (composite >= 7.5) priority = 'high';
  else if (composite >= 5.5) priority = 'medium';
  else priority = 'low';

  return { scores, composite, deprioritized, priority };
}
