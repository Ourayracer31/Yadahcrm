/**
 * MODULE 1 — Operator Briefing Pack.
 *
 * Before any contact is made, produce a one-page briefing for Travis. Ten fixed
 * sections, written the way a sharp number-two would brief a field operator:
 * what's the read, what's the pain, what's the angle, and - critically - what
 * NOT to say. The narrative voice matches the mission example.
 *
 * Everything routes through Module 9 (human-final-decision framing) and Module 8
 * (trust-first language) before it leaves this file.
 */

import { assertCompliantLanguage } from './language.js';
import { asSuggestion } from './decision.js';
import { generateOpener } from './scripts.js';

function pickContact(opp) {
  if (opp.builder?.displayName) return { type: 'Builder', name: opp.builder.displayName, phone: opp.builder.phone || null };
  if (opp.buyer?.displayName) return { type: 'Investor', name: opp.buyer.displayName, phone: opp.buyer.phone || null };
  if (opp.lot?.ownerName) return { type: 'Landowner', name: opp.lot.ownerName, phone: (opp.lot.ownerPhones || [])[0] || null };
  return { type: 'Contact', name: 'Unknown', phone: null };
}

/** Build the structured briefing object (the 10 required sections). */
export function buildBriefing(opp, { scores, composite, priority, fieldCheck, dealEval, contactMemory } = {}) {
  const contact = pickContact(opp);
  const b = opp.builder || {};
  const s = b.specSummary || {};
  const lot = opp.lot || {};
  const opener = generateOpener(opp, opp.builder ? 'builder' : opp.lot ? 'landowner' : 'investor');

  // 3. What pain may exist
  const painBits = [];
  if ((s.specsOverThreshold || 0) > 0) painBits.push(`${s.specsOverThreshold} spec(s) past the stale threshold`);
  if ((s.priceDrops || 0) > 0) painBits.push(`${s.priceDrops} price drop(s) (max ${s.maxPriceDropPct || 0}%)`);
  if ((s.medianDom || 0) >= 60) painBits.push(`median DOM ~${s.medianDom}`);
  if (lot.outOfStateOwner) painBits.push('absentee/out-of-state ownership');
  if (lot.vacantOrTeardown) painBits.push('idle, unbuilt dirt');
  const pain = painBits.length ? painBits.join('; ') : 'No acute pain confirmed yet - treat as discovery.';

  // 5. What Travis should NOT say
  const doNotSay = [
    'Do not lead with "I have land for you" or any pitch.',
    'Do not use pressure or hype language (see trust-first rules).',
    'Do not quote a price or imply you represent either side as an agent.',
  ];
  if (opp.play === 'Liquidity Bailout') doNotSay.push('Do not promise a buyer is lined up until BTR interest is confirmed.');

  // 7. Field-level concerns to verify
  const fieldConcerns = (fieldCheck?.verifyList && fieldCheck.verifyList.length)
    ? fieldCheck.verifyList
    : ['Confirm utilities, access, and zoning fit on the ground before committing time.'];

  // 8. Deal path if interest confirmed
  const dealPath = {
    'Created Chain (Land+Builder+Capital)': 'Option the landowner\'s lot (net-to-seller, full role disclosure), assign to the builder for a transparent finder fee, with the BTR investor pre-committed to the finished door(s) - one created chain, three parties.',
    'Margin Squeeze': 'Option the infill lot (net-to-seller), assign to the builder for a transparent finder fee; builder builds duplex on city pre-approved plans.',
    'Liquidity Bailout': 'Introduce the builder\'s aging specs to the confirmed BTR investor; transparent per-door finder fee at turnkey.',
    'Capital Preservation': 'Secure a 120-day option on the premium lot; builder markets build-to-suit; paid at retail closing.',
    'Pipeline Drought': 'Option the exurban tract; assign to the developer needing subdivision space for a transparent five-figure fee.',
  }[opp.play] || 'Confirm pain, confirm fit, then structure an option with full role disclosure.';

  // 10. Recommended next action
  const nextAction = dealEval?.status === 'kill'
    ? `Do not chase. ${dealEval.reasons[0] || ''}`.trim()
    : dealEval?.status === 'downgrade'
      ? `Proceed with caution - verify first: ${dealEval.reasons[0] || ''}`.trim()
      : `Make the call. Open with curiosity (see angle), listen for pain, book a follow-up if real.`;

  // Creation provenance (Module: synthesis). When present, this opportunity was
  // CREATED by combining People/Timing/Capital/Land - not discovered. Surface the
  // thesis, the conditions to make true, and the catalyst move.
  const creation = opp.synthesis ? {
    created: true,
    thesis: opp.synthesis.creationThesis,
    conditions: opp.synthesis.creationConditions || [],
    catalyst: opp.synthesis.catalyst,
    synthesisScore: opp.synthesis.synthesisScore,
    primitives: opp.synthesis.primitiveScores,
  } : null;

  const briefing = {
    contact,                                                   // 1
    whyMatters: opp.rationale || `${contact.name} sits at a ${opp.play} opportunity worth a conversation.`, // 2
    creation,                                                  // creation provenance (synthesis)
    pain,                                                      // 3
    likelyOpportunity: `${opp.play} - ${opp.fee?.note || 'structured option + transparent finder fee.'}`,   // 4
    doNotSay,                                                  // 5
    bestOpeningAngle: opener.text,                             // 6
    fieldConcerns,                                             // 7
    dealPath,                                                  // 8
    confidence: { composite: composite ?? null, priority: priority ?? null, operatorFit: scores?.operatorFit ?? null }, // 9
    nextAction,                                                // 10
    play: opp.play,
    scores: scores || null,
    dealStatus: dealEval?.status || 'proceed',
  };

  return asSuggestion(briefing);
}

/** Render the briefing as a one-page plain-text brief in the operator's voice. */
export function renderBriefing(briefing) {
  const c = briefing.confidence || {};
  const creationLines = briefing.creation ? [
    `>> CREATED OPPORTUNITY (not discovered) — synthesis score ${briefing.creation.synthesisScore}/10`,
    `   Thesis: ${briefing.creation.thesis}`,
    `   Conditions to make true:`,
    ...briefing.creation.conditions.map((c) => `     - ${c}`),
    `   Catalyst: ${briefing.creation.catalyst}`,
  ] : [];

  const lines = [
    `OPERATOR BRIEFING — SUGGESTED FOR TRAVIS`,
    `(recommendation only; Travis decides contact, angle, and whether to pursue)`,
    ``,
    `1. CONTACT: ${briefing.contact.name} (${briefing.contact.type})${briefing.contact.phone ? ` — ☎ ${briefing.contact.phone}` : ''}`,
    `2. WHY THIS MATTERS: ${briefing.whyMatters}`,
    ...creationLines,
    `3. LIKELY PAIN: ${briefing.pain}`,
    `4. LIKELY OPPORTUNITY: ${briefing.likelyOpportunity}`,
    `5. DO NOT SAY:`,
    ...briefing.doNotSay.map((d) => `   - ${d}`),
    `6. BEST OPENING ANGLE:`,
    `   "${briefing.bestOpeningAngle}"`,
    `7. FIELD CONCERNS TO VERIFY:`,
    ...briefing.fieldConcerns.map((f) => `   - ${f}`),
    `8. DEAL PATH IF INTEREST CONFIRMED: ${briefing.dealPath}`,
    `9. CONFIDENCE: composite ${c.composite ?? 'n/a'} | priority ${c.priority ?? 'n/a'} | operator-fit ${c.operatorFit ?? 'n/a'}/10`,
    `10. RECOMMENDED NEXT ACTION: ${briefing.nextAction}`,
  ];
  const text = lines.join('\n');
  return assertCompliantLanguage(text, 'operator briefing');
}
