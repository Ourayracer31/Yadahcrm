/**
 * End-to-end demo: sample vector data -> matching -> OPERATOR LAYER -> contracts.
 * Proves everything routes through the Operator Intelligence Layer.
 * Run: node test/demo.js
 */
import { runMatches } from '../../matching/src/match.js';
import { runOperatorLayer, renderWarRoom, renderBriefing, RelationshipMemory } from '../src/index.js';
import { generateDealPacket, dealFromMatch } from '../../contracts/src/index.js';
import { applyDecision } from '../src/decision.js';

const DATE = new Date('2026-06-15');

// --- Sample scraped data (what the three vectors would emit) ---
const builders = [
  { displayName: 'Squeezed Homes LLC', permitsPerYear: 12, healthStatus: 'Choked (sitting inventory)', metro: 'KANSAS CITY',
    specSummary: { activeSpecs: 5, specsOverThreshold: 3, priceDrops: 2, maxPriceDropPct: 6, medianDom: 92, staleAddresses: ['1 A St', '2 A St', '3 A St'] } },
  { displayName: 'Momentum Build Co', permitsPerYear: 18, healthStatus: 'Selling out (fast absorption)', metro: 'KANSAS CITY',
    specSummary: { activeSpecs: 3, specsOverThreshold: 0, priceDrops: 0, medianDom: 18 } },
  { displayName: 'Sallee Development', permitsPerYear: 40, healthStatus: 'Selling out (fast absorption)', heavyHitter: true, metro: 'CASS',
    specSummary: { activeSpecs: 4, specsOverThreshold: 0, medianDom: 22 } },
];
const lots = [
  { parcelId: 'INFILL1', zoning: 'R-3', situsAddress: '123 Vine St', situsCity: 'KANSAS CITY', county: 'Jackson',
    ownerName: 'Jane Heir', ownerMailingState: 'CA', outOfStateOwner: true, vacantOrTeardown: true, acreage: 0.2,
    landValue: 60000, equityProxy: 60000, yearsHeld: 14, sewerAvailable: true, waterAvailable: true, access: 'paved', compsStrength: 'ok' },
  { parcelId: 'INFILL2', zoning: 'R-3', situsAddress: '88 Troost', situsCity: 'KANSAS CITY', county: 'Jackson',
    ownerName: 'Holdover Trust', ownerMailingState: 'MO', vacantOrTeardown: true, acreage: 0.18,
    landValue: 55000, equityProxy: 55000, sewerAvailable: false, access: 'gravel' }, // no sewer -> should get killed
  { parcelId: 'TRACT1', zoning: 'AG', situsAddress: 'County Line Rd', situsCity: 'CASS', county: 'Cass',
    ownerName: 'Out-of-State Family LP', ownerMailingState: 'FL', outOfStateOwner: true, vacantOrTeardown: true,
    acreage: 22, landValue: 220000, equityProxy: 220000, yearsHeld: 30, sewerAvailable: true, access: 'paved' },
];
const buyers = [
  { displayName: 'BTR Capital LLC', totalHoldings: 40, recentAcquisitions: 12, mailingState: 'TX' },
];

// --- 1) MATCHING ---
const matches = runMatches({ builders, lots, buyers });
console.log(`Matching produced ${matches.length} raw matches.\n`);

// --- 2) RELATIONSHIP MEMORY (warm one contact) ---
const memory = new RelationshipMemory();
memory.upsert({ name: 'Squeezed Homes LLC', type: 'builder', trustLevel: 7, builds: 'duplexes/infill', buildsWhere: 'KCMO', authority: true });
memory.recordInteraction('Squeezed Homes LLC', { summary: 'Quick intro at supply yard', painLearned: 'specs aging on the east side', nextFollowUp: '2026-06-15' });

// --- 3) OPERATOR INTELLIGENCE LAYER (everything routes through here) ---
const result = runOperatorLayer({ matches, memory, date: DATE });

console.log(renderWarRoom(result.warRoom));
console.log(`\n[stats] ${JSON.stringify(result.stats)}\n`);
console.log('='.repeat(72));
console.log('TOP BRIEFING:\n');
const top = result.opportunities.find((o) => o.dealEval.status !== 'kill' && !o.score.deprioritized);
console.log(renderBriefing(top.briefing));

// --- 4) HUMAN DECISION -> CONTRACTS (only after Travis says "pursue") ---
// Contracts (Option + Assignment) are LAND instruments, so the contract step
// pursues the top live opportunity that actually involves a parcel.
console.log('\n' + '='.repeat(72));
const landDeal = result.opportunities.find((o) => o.dealEval.status !== 'kill' && !o.score.deprioritized && o.lot) || top;
const decided = applyDecision(landDeal.briefing, { action: 'pursue', note: 'Pain is real; field checks out', angleChosen: 'lot pipeline' });
console.log(`Travis decision on ${decided.contact.name} (${landDeal.play}): ${decided.decision.toUpperCase()} (angle: ${decided.angleChosen})`);

// find the underlying match for the pursued opportunity and build the contract packet
const top2 = landDeal;
const pursuedMatch = matches.find((m) => m.id === top2.id);
const deal = dealFromMatch(pursuedMatch, { seller: { name: top2.lot?.ownerName, netToSeller: top2.lot?.landValue }, assignee: { name: top2.builder?.displayName } });
const packet = generateDealPacket(deal);
console.log(`Generated contract packet for parcel ${deal.property.parcelId}:`);
console.log(`  - Option to Purchase: ${packet.option.markdown.length} chars`);
console.log(`  - Assignment & Finder's Fee: ${packet.assignment.markdown.length} chars`);
console.log(`  - Finder fee: $${deal.finderFee?.toLocaleString()} | Net to seller: $${deal.netToSeller?.toLocaleString()}`);

console.log('\nDEMO OK — vectors -> matching -> operator -> contracts, all clean.');
