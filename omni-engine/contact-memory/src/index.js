/**
 * Contact Memory + Relationship Intelligence System - public entry point.
 *
 * Extends the operator layer's in-memory RelationshipMemory (Module 5) into a
 * permanent, file-based system: a markdown memory file per contact under the
 * mandated /contacts/** folders, append-only conversation history, and a daily
 * /daily/travis-follow-up-board.md. Reuses the operator layer's trust-first
 * language guard and field-reality logic - it is built for development
 * problem-solving and trust, never spam.
 */

export { CONTACT_TYPES, FOLDERS, primaryTypeOf, folderForType, templateForType, fileNameFor, pathForContact } from './classify.js';
export { ContactFileStore } from './store.js';
export { generateFollowUpBoard, wouldTravisBelieveIt } from './followUpBoard.js';
export { trustLabel } from './render.js';
export { RelationshipMemory } from '../../operator/src/memory.js';

import { ContactFileStore } from './store.js';
import { generateFollowUpBoard } from './followUpBoard.js';

/** A rich contact record: operator memory fields + the structured intake profiles. */
export function blankRichContact(seed = {}) {
  return {
    name: seed.name || '',
    company: seed.company || null,
    types: seed.types || (seed.type ? [seed.type] : []),
    primaryType: seed.primaryType || null,
    phone: seed.phone || null,
    email: seed.email || null,
    website: seed.website || null,
    location: seed.location || null,
    mailingAddress: seed.mailingAddress || null,
    propertyAddress: seed.propertyAddress || null,
    parcelId: seed.parcelId || null,
    county: seed.county || null,
    firstContactDate: seed.firstContactDate || null,
    lastConversation: seed.lastConversation || null,
    nextFollowUp: seed.nextFollowUp || null,
    relationshipStrength: seed.relationshipStrength ?? seed.trustLevel ?? null,
    trustLevel: seed.trustLevel ?? null,
    // structured profiles (all optional; blanks render as em dashes)
    companyProfile: seed.companyProfile || {},
    painProfile: seed.painProfile || {},
    wants: seed.wants || {},
    avoids: seed.avoids || {},
    propertyProfile: seed.propertyProfile || {},
    ownershipProfile: seed.ownershipProfile || {},
    motivationProfile: seed.motivationProfile || {},
    dealStructure: seed.dealStructure || {},
    buyBox: seed.buyBox || {},
    capitalProfile: seed.capitalProfile || {},
    opportunityFit: seed.opportunityFit || {},
    fit: seed.fit || {},
    aiRecommendations: seed.aiRecommendations || {},
    interactions: seed.interactions || [],
  };
}

/**
 * Derive AI Recommendations for a contact from a live operator opportunity, so
 * each memory file's guidance stays in sync with the engine's current read.
 */
export function aiRecommendationsFromOpportunity(opp) {
  if (!opp) return {};
  return {
    bestNextAngle: opp.briefing?.bestOpeningAngle || null,
    relationshipStrategy: opp.dealEval?.status === 'proceed'
      ? 'Advance: confirm pain, then structure the option with full role disclosure.'
      : opp.dealEval?.status === 'downgrade'
        ? 'Hold/verify: resolve the flagged concern before investing time.'
        : 'Do not chase right now.',
    suggestedFollowUpDate: opp.nextFollowUp || null,
    suggestedFollowUpMessage: opp.scripts?.builder?.text || opp.briefing?.bestOpeningAngle || null,
    doNotSay: (opp.briefing?.doNotSay || []).join(' '),
    listenFor: opp.play === 'Liquidity Bailout' ? 'Door target, turnkey appetite, capital readiness.'
      : opp.lot ? 'Lot pipeline gaps, what they avoid on the dirt, real timing.'
        : 'Where the real squeeze is.',
  };
}

/**
 * One-shot sync: write/refresh every contact's memory file and the daily board
 * from the operator-layer result and the relationship memory.
 *
 * @param {object} params
 * @param {object} params.operatorResult output of operator/runOperatorLayer()
 * @param {RelationshipMemory} params.memory
 * @param {string} [params.root] output root (defaults to cwd)
 * @param {Date} [params.date]
 * @returns {{ filesWritten, board }}
 */
export function syncContactMemory({ operatorResult, memory, root = process.cwd(), date = new Date() } = {}) {
  const store = new ContactFileStore(root);

  // Index opportunities by primary contact name for AI-recommendation enrichment.
  const byContact = new Map();
  for (const o of operatorResult?.opportunities || []) {
    const name = o.briefing?.contact?.name;
    if (name && !byContact.has(name)) byContact.set(name, o);
  }

  // Write a file for every known contact, enriched with the engine's current read.
  const contacts = (memory?.all() || []).map((c) => {
    const rich = blankRichContact(c);
    rich.interactions = c.interactions || [];
    const opp = byContact.get(c.name);
    if (opp) rich.aiRecommendations = { ...aiRecommendationsFromOpportunity(opp), ...(c.aiRecommendations || {}) };
    return rich;
  });

  const filesWritten = store.writeAll(contacts);

  const { board, markdown } = generateFollowUpBoard({ opportunities: operatorResult?.opportunities || [], memory, date });
  const boardPaths = store.writeFollowUpBoard(markdown, date);

  return { filesWritten, board, boardMarkdown: markdown, boardPaths };
}
