/**
 * Investor (Build-to-Rent / portfolio buyer) memory file template.
 * Follows the same intake discipline as the builder/landowner files.
 */

import { field, renderPairs, section, trustLabel, renderConversation } from '../render.js';

export function renderInvestorFile(contact, { conversationBlocks } = {}) {
  const buy = contact.buyBox || {};
  const cap = contact.capitalProfile || {};
  const fit = contact.opportunityFit || {};
  const ai = contact.aiRecommendations || {};
  const types = (contact.types && contact.types.length ? contact.types : [contact.type]).filter(Boolean);

  const identity = renderPairs([
    ['Name', contact.name],
    ['Company', contact.company],
    ['Phone', contact.phone],
    ['Email', contact.email],
    ['Mailing/HQ', contact.location || contact.mailingAddress],
    ['Contact type(s)', types],
    ['First contact date', contact.firstContactDate],
    ['Last contact date', contact.lastConversation || contact.lastContactDate],
    ['Relationship strength (1-10)', contact.relationshipStrength],
    ['Trust level', trustLabel(contact)],
  ]);

  const buyBox = renderPairs([
    ['Strategy', buy.strategy || 'Build-to-Rent / portfolio'],
    ['Door target', buy.doorTarget],
    ['Homes bought (24 mo)', buy.recentAcquisitions],
    ['Total holdings', buy.totalHoldings],
    ['Price band', buy.priceBand],
    ['Markets', buy.markets],
    ['Product type', buy.productType],
    ['Turnkey vs ground-up', buy.turnkeyVsGroundUp],
    ['Avoids', buy.avoids],
  ]);

  const capital = renderPairs([
    ['Capital readiness', cap.readiness],
    ['Funding source', cap.fundingSource],
    ['Confirmed appetite', cap.confirmedAppetite],
    ['Decision speed', cap.decisionSpeed],
  ]);

  const blocks = conversationBlocks && conversationBlocks.length
    ? conversationBlocks.join('\n\n')
    : (contact.interactions || []).map((e) => renderConversation(e, 'builder')).join('\n\n') || '_No conversations logged yet._';

  const opportunityFit = renderPairs([
    ['Builders whose specs may fit', fit.builders],
    ['Active matches', fit.activeMatches],
    ['Deals to avoid', fit.avoid],
  ]);

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
    `\n_Investor · ${trustLabel(contact)} · updated ${new Date().toISOString().slice(0, 10)}_\n`,
    section('Contact Identity', identity),
    section('Buy Box', buyBox),
    section('Capital Profile', capital),
    section('Conversation History', blocks),
    section('Opportunity Fit', opportunityFit),
    section('AI Recommendations', aiRec),
  ].join('\n');
}
