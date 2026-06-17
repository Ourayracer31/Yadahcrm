/**
 * Service-partner memory file template - engineers, surveyors, title companies,
 * attorneys, bankers/lenders, city/county contacts, brokers, and others.
 *
 * These are the people who hear about land and builder stress BEFORE anyone else.
 * The "Intel They Provide" section is what makes this a relationship-intelligence
 * system and not a rolodex: it captures what each partner can tip Travis to.
 */

import { field, renderPairs, section, trustLabel, renderConversation } from '../render.js';

// What each kind of partner tends to know first.
const INTEL_HINT = {
  Engineer: 'Knows where sewer/utilities are going before it is public.',
  Surveyor: 'Hears about land splits and sales before they list.',
  'Title Company': 'Sees who is selling and what is clouded in title.',
  Attorney: 'Handles estates, probate, and inherited ground.',
  'Banker/Lender': 'Knows which builders are under pressure or slowing down.',
  'City/County Contact': 'Knows zoning changes and entitlement shifts early.',
  Broker: 'Has pocket listings and off-market knowledge.',
  Other: 'Relationship-dependent intel.',
};

export function renderPartnerFile(contact, { conversationBlocks } = {}) {
  const ai = contact.aiRecommendations || {};
  const types = (contact.types && contact.types.length ? contact.types : [contact.type]).filter(Boolean);
  const role = contact.primaryType || types[0] || 'Other';

  const identity = renderPairs([
    ['Name', contact.name],
    ['Company', contact.company],
    ['Role', role],
    ['Phone', contact.phone],
    ['Email', contact.email],
    ['Location', contact.location],
    ['Contact type(s)', types],
    ['First contact date', contact.firstContactDate],
    ['Last contact date', contact.lastConversation || contact.lastContactDate],
    ['Relationship strength (1-10)', contact.relationshipStrength],
    ['Trust level', trustLabel(contact)],
  ]);

  const intel = renderPairs([
    ['What they know first', contact.intelType || INTEL_HINT[role] || INTEL_HINT.Other],
    ['Coverage area', contact.coverageArea],
    ['Tips provided to date', contact.tipsProvided],
    ['Reciprocity / how Travis helps them', contact.reciprocity],
    ['Reliability', contact.reliability],
  ]);

  const blocks = conversationBlocks && conversationBlocks.length
    ? conversationBlocks.join('\n\n')
    : (contact.interactions || []).map((e) => renderConversation(e, 'builder')).join('\n\n') || '_No conversations logged yet._';

  const aiRec = renderPairs([
    ['Best next contact angle', ai.bestNextAngle],
    ['Current relationship strategy', ai.relationshipStrategy],
    ['Suggested follow-up date', ai.suggestedFollowUpDate || contact.nextFollowUp],
    ['Suggested follow-up message', ai.suggestedFollowUpMessage],
    ['Do not say', ai.doNotSay],
    ['Listen for', ai.listenFor],
  ]);

  return [
    `# ${field(contact.name)}${contact.company ? ` — ${contact.company}` : ''}`,
    `\n_${role} (Service Partner) · ${trustLabel(contact)} · updated ${new Date().toISOString().slice(0, 10)}_\n`,
    section('Contact Identity', identity),
    section('Intel They Provide', intel),
    section('Conversation History', blocks),
    section('AI Recommendations', aiRec),
  ].join('\n');
}
