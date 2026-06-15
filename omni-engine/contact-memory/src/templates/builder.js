/**
 * Builder / Developer memory file template (per the addendum spec).
 * Renders from a rich contact record; missing fields stay blank (—).
 */

import { field, renderPairs, section, trustLabel, renderConversation } from '../render.js';

export function renderBuilderFile(contact, { conversationBlocks } = {}) {
  const co = contact.companyProfile || {};
  const pain = contact.painProfile || {};
  const want = contact.wants || {};
  const avoid = contact.avoids || {};
  const fit = contact.opportunityFit || {};
  const ai = contact.aiRecommendations || {};
  const types = (contact.types && contact.types.length ? contact.types : [contact.type]).filter(Boolean);

  const identity = renderPairs([
    ['Name', contact.name],
    ['Company', contact.company],
    ['Phone', contact.phone],
    ['Email', contact.email],
    ['Website', contact.website],
    ['Location', contact.location],
    ['Contact type(s)', types],
    ['First contact date', contact.firstContactDate],
    ['Last contact date', contact.lastConversation || contact.lastContactDate],
    ['Relationship strength (1-10)', contact.relationshipStrength],
    ['Trust level', trustLabel(contact)],
  ]);

  const company = renderPairs([
    ['Builder type', co.builderType],
    ['Annual permit range', co.annualPermitRange],
    ['Typical price point', co.typicalPricePoint],
    ['Product type', co.productType],
    ['Areas they build', co.areasTheyBuild],
    ['Municipalities they like', co.municipalitiesLike],
    ['Municipalities they avoid', co.municipalitiesAvoid],
    ['Preferred lot size', co.preferredLotSize],
    ['Preferred lot width', co.preferredLotWidth],
    ['Preferred zoning', co.preferredZoning],
    ['Preferred school districts', co.preferredSchoolDistricts],
    ['Typical buyer', co.typicalBuyer],
    ['Construction style', co.constructionStyle],
    ['Current subdivisions/projects', co.currentProjects],
  ]);

  const painProfile = renderPairs([
    ['Current inventory pressure', pain.inventoryPressure],
    ['Current lot pipeline', pain.lotPipeline],
    ['Spec homes sitting', pain.specsSitting],
    ['Need for paper lots', pain.needPaperLots],
    ['Need for finished lots', pain.needFinishedLots],
    ['Need for duplex/infill', pain.needDuplexInfill],
    ['Need for acreage/subdivision ground', pain.needAcreage],
    ['Capital constraints', pain.capitalConstraints],
    ['Bank/lender constraints', pain.lenderConstraints],
    ['Entitlement concerns', pain.entitlementConcerns],
    ['Labor constraints', pain.laborConstraints],
    ['Sales pace concerns', pain.salesPaceConcerns],
    ['What keeps them up at night', pain.keepsThemUpAtNight],
  ]);

  const wants = renderPairs([
    ['Ideal opportunity', want.idealOpportunity],
    ['Deal size', want.dealSize],
    ['Timeline', want.timeline],
    ['Must-have conditions', want.mustHaves],
    ['Deal breakers', want.dealBreakers],
    ['What would make them move fast', want.whatMakesThemMoveFast],
    ['What they told Travis directly', want.directQuotes],
  ]);

  const avoids = renderPairs([
    ['Retaining walls', avoid.retainingWalls],
    ['Long utility runs', avoid.longUtilityRuns],
    ['Septic', avoid.septic],
    ['No sewer', avoid.noSewer],
    ['Bad access', avoid.badAccess],
    ['Heavy grading', avoid.heavyGrading],
    ['Floodplain', avoid.floodplain],
    ['Political/zoning friction', avoid.politicalFriction],
    ['Certain cities/counties', avoid.citiesAvoid],
    ['Small lots', avoid.smallLots],
    ['Large tracts', avoid.largeTracts],
    ['Unknown entitlement risk', avoid.entitlementRisk],
    ['Other', avoid.other],
  ]);

  const blocks = conversationBlocks && conversationBlocks.length
    ? conversationBlocks.join('\n\n')
    : (contact.interactions || []).map((e) => renderConversation(e, 'builder')).join('\n\n') || '_No conversations logged yet._';

  const opportunityFit = renderPairs([
    ['Best fit opportunities', fit.bestFit],
    ['Current active matches', fit.activeMatches],
    ['Parcels to avoid', fit.parcelsToAvoid],
    ['Investors that may match', fit.investorsThatMatch],
    ['Landowners that may match', fit.landownersThatMatch],
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
    `\n_Builder / Developer · ${trustLabel(contact)} · updated ${new Date().toISOString().slice(0, 10)}_\n`,
    section('Contact Identity', identity),
    section('Company Profile', company),
    section('Builder Pain Profile', painProfile),
    section('What They Want', wants),
    section('What They Avoid', avoids),
    section('Conversation History', blocks),
    section('Opportunity Fit', opportunityFit),
    section('AI Recommendations', aiRec),
  ].join('\n');
}
