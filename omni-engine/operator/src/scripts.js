/**
 * MODULE 2 — Reverse Selling Script Engine.
 *
 * Never pushy. Every opener is built from field credibility and curiosity, in a
 * fixed five-beat structure:
 *   1. Observation   - something real we noticed
 *   2. Humility      - "tell me if I'm reading this wrong"
 *   3. Field question- a question only a builder would ask
 *   4. No pressure   - explicitly nothing to sell
 *   5. Reveal        - leave room for them to surface the pain
 *
 * Output is routed through the Trust-First language guard before it is returned.
 */

import { assertCompliantLanguage } from './language.js';

function firstName(name) {
  if (!name) return 'there';
  const clean = String(name).replace(/\b(LLC|INC|CORP|CO|HOMES|BUILDERS?|CONSTRUCTION|DEVELOPMENT|GROUP|LP)\b/gi, '').trim();
  return clean.split(/\s+/)[0] || 'there';
}

/** Builder-side opener (Margin Squeeze / Liquidity Bailout / Capital Preservation). */
function builderOpener(opp) {
  const b = opp.builder || {};
  const s = b.specSummary || {};
  const stale = s.specsOverThreshold || 0;
  const drops = s.priceDrops || 0;

  const observation = stale > 0
    ? `I noticed a couple of your specs have been sitting a while${drops ? ` with a price adjustment or two` : ''} - but you're still pulling permits.`
    : `I've been watching your permit activity in the area and it looks like you're moving.`;

  const humility = `Tell me if I'm reading it wrong.`;

  const fieldQuestion = stale > 0
    ? `Between finished specs and your lot pipeline, which one's the bigger pressure right now?`
    : `Are lots or finished inventory the tighter constraint for you this season?`;

  const noPressure = `I'm not pitching you anything - just trying to understand where the squeeze is.`;
  const reveal = `If there's a pocket where the dirt isn't keeping up, that's usually where I can be useful.`;

  return { observation, humility, fieldQuestion, noPressure, reveal };
}

/** Landowner-side opener (never pressure; curiosity + service). */
function landownerOpener(opp) {
  const lot = opp.lot || {};
  const observation = lot.vacantOrTeardown
    ? `I came across your parcel${lot.situsAddress ? ` on ${lot.situsAddress}` : ''} - looks like it's been sitting unbuilt for a while.`
    : `I came across your property${lot.situsAddress ? ` on ${lot.situsAddress}` : ''} while looking at where new construction could fit.`;
  const humility = `I might be off here.`;
  const fieldQuestion = `Have you ever looked at what could actually be built on it, or is it just something you've held onto?`;
  const noPressure = `No agenda - I'm not a broker and there's nothing to list.`;
  const reveal = `If you ever wanted to understand its development fit, I work with builders who need exactly this kind of ground.`;
  return { observation, humility, fieldQuestion, noPressure, reveal };
}

/** Investor/developer-side opener (BTR buyer). */
function investorOpener(opp) {
  const buyer = opp.buyer || {};
  const observation = `Looks like you've been steadily adding single-family doors in the metro${buyer.recentAcquisitions ? ` (${buyer.recentAcquisitions} in the last couple years)` : ''}.`;
  const humility = `Correct me if your buy-box has shifted.`;
  const fieldQuestion = `Are you still looking for turnkey doors, or more focused on build-to-rent ground-up right now?`;
  const noPressure = `Nothing to send you today.`;
  const reveal = `I occasionally have builder inventory that needs a home before it ages - wanted to know if that's still your lane.`;
  return { observation, humility, fieldQuestion, noPressure, reveal };
}

/**
 * Generate a reverse-selling opener for an opportunity.
 * @param {object} opp normalized opportunity
 * @param {'builder'|'landowner'|'investor'} [audience] override; inferred from play if omitted
 * @returns {{ audience, structure, text }}
 */
export function generateOpener(opp, audience) {
  const inferred = audience
    || (opp.play === 'Pipeline Drought' || opp.play === 'Margin Squeeze' ? 'builder'
      : opp.play === 'Liquidity Bailout' ? 'builder'
        : 'builder');

  let parts;
  if (inferred === 'landowner') parts = landownerOpener(opp);
  else if (inferred === 'investor') parts = investorOpener(opp);
  else parts = builderOpener(opp);

  const text = [parts.observation, parts.humility, parts.fieldQuestion, parts.noPressure, parts.reveal]
    .filter(Boolean)
    .join(' ');

  assertCompliantLanguage(text, 'reverse-selling script');
  return { audience: inferred, structure: parts, text };
}

/** Convenience: generate openers for both sides of a builder<->land match. */
export function generateOpenerSet(opp) {
  return {
    builder: generateOpener(opp, 'builder'),
    landowner: opp.lot ? generateOpener(opp, 'landowner') : null,
    investor: opp.buyer ? generateOpener(opp, 'investor') : null,
  };
}
