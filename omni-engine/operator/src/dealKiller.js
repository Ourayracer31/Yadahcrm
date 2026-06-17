/**
 * MODULE 7 — Deal Killer Logic.
 *
 * The system's job is to protect a 32-year operator from wasting time. This
 * evaluates an opportunity against the kill list and either KILLS it, DOWNGRADES
 * it, or lets it PROCEED. Every kill/downgrade carries a short, plain reason so
 * the War Room can show "Do not chase this - here's why."
 */

/**
 * @param {object} opp       normalized opportunity (play, builder, lot, buyer, fee, parties)
 * @param {object} scores    output of scoreOpportunity().scores
 * @param {object} fieldCheck output of fieldRealityCheck()
 * @param {object} contactMemory optional CRM record for authority/timeline cues
 * @returns {{ status:'kill'|'downgrade'|'proceed', reasons:string[], hardKill:boolean }}
 */
export function evaluateDeal(opp, scores = {}, fieldCheck = {}, contactMemory = {}) {
  const reasons = [];
  const downgrades = [];
  const lot = opp.lot || {};

  // ---- HARD KILLS ----
  // Seller wants retail-plus pricing.
  if (lot.sellerPriceExpectation === 'retail+' || lot.sellerPriceExpectation === 'retail-plus') {
    reasons.push('Seller wants retail-plus pricing - no option spread exists.');
  }
  // No real builder pain.
  if ((scores.builderPain || 0) < 4) {
    reasons.push('No real builder pain detected - nothing to solve, nothing to move.');
  }
  // No utility path.
  if (fieldCheck.flags?.some((f) => f.code === 'NO_SEWER' || f.code === 'NO_WATER')) {
    reasons.push('No viable utility path - sewer/water blocker on the dirt.');
  }
  // Parcel only works on paper / unbuildable.
  if (fieldCheck.buildable === false) {
    reasons.push('Parcel only works on paper - field reality says unbuildable as assumed.');
  }
  // Contact has no authority.
  if (contactMemory.authority === false || lot.contactHasAuthority === false) {
    reasons.push('Contact has no authority to sell/decide - wrong person.');
  }
  // Legal risk too high.
  if (lot.legalRisk === 'high' || opp.legalRisk === 'high') {
    reasons.push('Legal risk too high (title, probate, or entitlement exposure).');
  }

  // ---- DOWNGRADES (proceed-but-cautious) ----
  // Timeline too long.
  if ((lot.timelineMonths || 0) > 9) {
    downgrades.push('Timeline too long - capital/attention tied up beyond useful horizon.');
  }
  // Assignment path unclear.
  if (lot.assignmentPathClear === false || opp.assignmentPathClear === false) {
    downgrades.push('Assignment path unclear - confirm an end builder/investor before optioning.');
  }
  // Buyer demand theoretical (Liquidity Bailout with no confirmed buyer interest).
  if (opp.play === 'Liquidity Bailout' && opp.buyer && opp.buyer.confirmedInterest === false) {
    downgrades.push('Buyer demand is theoretical - BTR interest not yet confirmed.');
  }
  // Margins too thin.
  if ((scores.profitPotential || 0) <= 3) {
    downgrades.push('Margins too thin for the effort required.');
  }
  // Weak feasibility (soft) -> caution rather than kill.
  if ((scores.feasibility || 10) <= 4 && fieldCheck.buildable !== false) {
    downgrades.push('Feasibility is shaky - verify field concerns before spending real time.');
  }

  if (reasons.length) {
    return { status: 'kill', reasons, hardKill: true };
  }
  if (downgrades.length) {
    return { status: 'downgrade', reasons: downgrades, hardKill: false };
  }
  return { status: 'proceed', reasons: [], hardKill: false };
}
