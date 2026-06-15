/**
 * Landowner memory file template (per the addendum spec).
 */

import { field, renderPairs, section, trustLabel, renderConversation } from '../render.js';

export function renderLandownerFile(contact, { conversationBlocks } = {}) {
  const prop = contact.propertyProfile || {};
  const own = contact.ownershipProfile || {};
  const mot = contact.motivationProfile || {};
  const deal = contact.dealStructure || {};
  const fit = contact.fit || {};
  const ai = contact.aiRecommendations || {};

  const identity = renderPairs([
    ['Name', contact.name],
    ['Phone', contact.phone],
    ['Email', contact.email],
    ['Mailing address', contact.mailingAddress],
    ['Property address', contact.propertyAddress],
    ['Parcel number', contact.parcelId],
    ['County', contact.county],
    ['First contact date', contact.firstContactDate],
    ['Last contact date', contact.lastConversation || contact.lastContactDate],
    ['Relationship strength (1-10)', contact.relationshipStrength],
    ['Trust level', trustLabel(contact)],
  ]);

  const property = renderPairs([
    ['Acreage', prop.acreage],
    ['Zoning', prop.zoning],
    ['Current use', prop.currentUse],
    ['Utilities', prop.utilities],
    ['Sewer', prop.sewer],
    ['Water', prop.water],
    ['Road frontage', prop.roadFrontage],
    ['Access', prop.access],
    ['Floodplain', prop.floodplain],
    ['Topography', prop.topography],
    ['Nearby development', prop.nearbyDevelopment],
    ['Highest potential use', prop.highestPotentialUse],
    ['Known issues', prop.knownIssues],
  ]);

  const ownership = renderPairs([
    ['Years owned', own.yearsOwned],
    ['Owner type', own.ownerType],
    ['Out-of-state owner', own.outOfState],
    ['Family-owned', own.familyOwned],
    ['Heirs involved', own.heirsInvolved],
    ['Mortgage status if known', own.mortgageStatus],
    ['Tax issues if known', own.taxIssues],
    ['Current use', own.currentUse],
    ['Emotional attachment', own.emotionalAttachment],
    ['Reason they may sell', own.reasonMaySell],
    ['Reason they may not sell', own.reasonMayNotSell],
  ]);

  const motivation = renderPairs([
    ['Motivation score (1-10)', mot.motivationScore],
    ['Desired outcome', mot.desiredOutcome],
    ['Price expectations', mot.priceExpectations],
    ['Timing', mot.timing],
    ['Needs cash now', mot.needsCashNow],
    ['Wants legacy preserved', mot.wantsLegacy],
    ['Wants partial sale', mot.wantsPartialSale],
    ['Wants option structure', mot.wantsOption],
    ['Wants full sale', mot.wantsFullSale],
    ['Needs education', mot.needsEducation],
    ['Decision makers involved', mot.decisionMakers],
  ]);

  const dealStructure = renderPairs([
    ['Straight purchase', deal.straightPurchase],
    ['Option agreement', deal.option],
    ['Partial acreage sale', deal.partialAcreage],
    ['Phased closing', deal.phasedClosing],
    ['Builder assignment', deal.builderAssignment],
    ['Build-to-suit', deal.buildToSuit],
    ['Developer assignment', deal.developerAssignment],
    ['Seller carry', deal.sellerCarry],
    ['Joint venture', deal.jointVenture],
    ['Not viable', deal.notViable],
  ]);

  const blocks = conversationBlocks && conversationBlocks.length
    ? conversationBlocks.join('\n\n')
    : (contact.interactions || []).map((e) => renderConversation(e, 'landowner')).join('\n\n') || '_No conversations logged yet._';

  const fitSection = renderPairs([
    ['Builders this may fit', fit.builders],
    ['Developers this may fit', fit.developers],
    ['Investors this may fit', fit.investors],
    ['Why it fits', fit.whyFits],
    ['Why it may fail', fit.whyMayFail],
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
    `# ${field(contact.name)}${contact.propertyAddress ? ` — ${contact.propertyAddress}` : ''}`,
    `\n_Landowner · ${trustLabel(contact)} · updated ${new Date().toISOString().slice(0, 10)}_\n`,
    section('Contact Identity', identity),
    section('Property Profile', property),
    section('Ownership Profile', ownership),
    section('Motivation Profile', motivation),
    section('Deal Structure Possibilities', dealStructure),
    section('Conversation History', blocks),
    section('Builder / Developer Fit', fitSection),
    section('AI Recommendations', aiRec),
  ].join('\n');
}
