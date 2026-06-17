/**
 * Generate committable EXAMPLE memory files into contact-memory/examples/ so the
 * template output is documented. Uses fictional contacts (no real PII).
 * Run: node test/make-examples.js
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ContactFileStore } from '../src/store.js';
import { blankRichContact, generateFollowUpBoard, RelationshipMemory } from '../src/index.js';
import { runSynthesis } from '../../synthesis/src/index.js';
import { runOperatorLayer } from '../../operator/src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', 'examples');
const store = new ContactFileStore(root);

store.write(blankRichContact({
  name: 'Marcus Vance', company: 'Vance Built LLC', type: 'Builder', phone: '816-555-0142',
  email: 'marcus@vancebuilt.example', location: 'Kansas City, MO', firstContactDate: '2026-05-20', relationshipStrength: 7,
  companyProfile: { builderType: 'Mid-market infill/duplex', annualPermitRange: '12-18/yr', typicalPricePoint: '$240k-$320k',
    productType: 'Duplex + small-lot SFH', areasTheyBuild: 'East KCMO, Independence', municipalitiesLike: 'KCMO',
    municipalitiesAvoid: 'Outlying code-heavy suburbs', preferredLotSize: '4,000-7,000 sf', preferredZoning: 'R-2.5 / R-3',
    constructionStyle: 'Slab, pre-approved plans', currentProjects: '2 east-side duplex pairs' },
  painProfile: { inventoryPressure: 'Moderate - 3 specs aging', specsSitting: '3 over 70 DOM', needDuplexInfill: 'Yes - actively',
    needFinishedLots: 'Short 4-6 lots', capitalConstraints: 'Won\'t tie cash in raw dirt', keepsThemUpAtNight: 'Lots drying up east side' },
  wants: { idealOpportunity: 'Optioned R-3 infill on pre-approved plans', dealSize: '$50k-$70k dirt', timeline: '30-60 days',
    mustHaves: 'Sewer at site, paved access', dealBreakers: 'No sewer, floodplain', whatMakesThemMoveFast: 'Duplex-ready lot with a clean path' },
  avoids: { noSewer: 'Hard no', septic: 'Avoid', floodplain: 'Avoid', longUtilityRuns: 'Avoid', politicalFriction: 'Avoid' },
  interactions: [
    { at: '2026-05-20', method: 'In person', summary: 'Met at supply yard; talked east-side pipeline', painLearned: 'Specs aging, lots thin', opportunity: 'Infill R-3 option', nextAction: 'Watch for east-side R-3 dirt' },
    { at: '2026-06-05', method: 'Call', summary: 'Confirmed he wants duplex-ready lots', painLearned: 'Down to ~4 lots', followUpPromised: 'Send when a clean R-3 shows', nextAction: 'Bring first qualifying parcel' },
  ],
  aiRecommendations: { bestNextAngle: 'Ask which east-side pocket is tightest before bringing dirt', relationshipStrategy: 'Trusted - keep feeding precise fits, never volume',
    listenFor: 'Which subdivision is drying up first', doNotSay: 'Avoid any pitch language; no pressure.' },
}));

store.write(blankRichContact({
  name: 'Eleanor Pratt', type: 'Landowner', propertyAddress: '4412 Tracy Ave', parcelId: 'JK-INFILL-0098', county: 'Jackson',
  mailingAddress: 'San Diego, CA', firstContactDate: '2026-06-02', relationshipStrength: 4,
  propertyProfile: { acreage: '0.19', zoning: 'R-3', currentUse: 'Vacant (former teardown)', sewer: 'Available at street',
    water: 'Available', roadFrontage: '50 ft', access: 'Paved', floodplain: 'No (Zone X)', highestPotentialUse: 'Duplex' },
  ownershipProfile: { yearsOwned: 14, ownerType: 'Individual (inherited)', outOfState: true, familyOwned: true, heirsInvolved: 'Possibly a sibling',
    emotionalAttachment: 'Low - never lived here', reasonMaySell: 'Out of state, paying taxes on idle dirt', reasonMayNotSell: 'Unsure of value' },
  motivationProfile: { motivationScore: 8, desiredOutcome: 'Clean exit, no hassle', priceExpectations: 'Unknown - needs education',
    timing: 'Flexible', wantsOption: 'Open if explained', needsEducation: 'Yes - what can be built' },
  dealStructure: { option: 'Strong fit', builderAssignment: 'Yes', straightPurchase: 'Possible', sellerCarry: 'Not needed' },
  fit: { builders: 'Vance Built LLC', whyFits: 'R-3, sewer at street, paved access - duplex-ready', whyMayFail: 'Price expectations untested' },
  interactions: [
    { at: '2026-06-02', method: 'Call', summary: 'Cold intro; she was curious not defensive', caresAbout: 'No hassle, fair treatment', timingDiscussed: 'Flexible', objections: '"Not sure it\'s for sale"', nextAction: 'Send a plain explainer on development fit' },
  ],
  aiRecommendations: { bestNextAngle: 'Educate on what R-3 allows; no pressure, service-first', relationshipStrategy: 'Warm slowly - she needs understanding before any number',
    suggestedFollowUpMessage: 'Share what could be built and how an option works, with full role disclosure', listenFor: 'Whether a sibling/heir shares the decision', doNotSay: 'No pressure, no urgency language.' },
}));

// Example daily board from a synthesized run.
const builders = [{ displayName: 'Vance Built LLC', permitsPerYear: 14, healthStatus: 'Selling out (fast absorption)', metro: 'KANSAS CITY', productType: 'duplex/infill', specSummary: { activeSpecs: 3, specsOverThreshold: 0, medianDom: 25 } }];
const lots = [{ parcelId: 'JK-INFILL-0098', zoning: 'R-3', situsAddress: '4412 Tracy Ave', situsCity: 'KANSAS CITY', county: 'Jackson', ownerName: 'Eleanor Pratt', outOfStateOwner: true, vacantOrTeardown: true, acreage: 0.19, landValue: 60000, equityProxy: 60000, yearsHeld: 14, sewerAvailable: true, access: 'paved' }];
const created = runSynthesis({ builders, lots, buyers: [] });
const opResult = runOperatorLayer({ matches: created });
const memory = new RelationshipMemory();
memory.upsert({ name: 'Vance Built LLC', type: 'builder', trustLevel: 7 });
const { markdown } = generateFollowUpBoard({ opportunities: opResult.opportunities, memory, date: new Date('2026-06-15') });
store.writeFollowUpBoard(markdown, new Date('2026-06-15'));

console.log('Example contact files + daily board written to contact-memory/examples/');
