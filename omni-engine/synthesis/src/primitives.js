/**
 * The four primitives of a CREATED opportunity: People, Timing, Capital, Land.
 *
 * Governing principle: the system must never assume opportunities are discovered.
 * Opportunities do not exist until Travis combines these four primitives. This
 * module decomposes raw vector output into the four primitives and scores how
 * well a given combination *could* be made real (1-10 each). The combinator in
 * synthesize.js uses these to construct - not find - opportunities.
 */

import {
  needsInventory, isChoked, isCapitalShy, isHeavyHitter,
  isInfillLot, isTract, isPremiumLot, DEFAULT_PARAMS,
} from '../../matching/src/plays.js';

const clamp = (n, lo = 1, hi = 10) => Math.max(lo, Math.min(hi, Math.round(n)));

/** All location tokens a party declares (builder or lot), upper-cased. */
function geoTokens(x) {
  return [x?.metro, x?.situsCity, x?.county, x?.buildsWhere, x?.municipalityPreference]
    .filter(Boolean)
    .map((s) => String(s).toUpperCase());
}
function geoAligned(a, b) {
  const A = geoTokens(a);
  const B = geoTokens(b);
  if (!A.length || !B.length) return false;
  return A.some((x) => B.some((y) => x === y || x.includes(y) || y.includes(x)));
}

/**
 * PEOPLE: is there a real human need on the builder side, and do the parties fit?
 * A builder with no addressable need is not a person worth combining.
 */
export function peopleFit(builder, lot) {
  if (!builder) return 1;
  let score = 3;
  const hasNeed = needsInventory(builder) || isChoked(builder) || isCapitalShy(builder) || isHeavyHitter(builder);
  if (hasNeed) score += 3;
  if (lot && geoAligned(builder, lot)) score += 2;
  const product = String(builder.productType || builder.builds || '').toLowerCase();
  if (lot && isInfillLot(lot) && /(duplex|infill|multi|townhome|attached)/.test(product)) score += 2;
  return clamp(score);
}

/**
 * TIMING: the option is a timing instrument. The strongest creation pairs a
 * PATIENT seller (absentee, long-hold, idle dirt - no urgency to act) with an
 * URGENT builder (sitting specs / pipeline drought). Travis's option bridges the
 * two clocks. High patience + high urgency = the moment to create.
 */
export function timingAlignment(builder, lot) {
  let patience = 0;
  if (lot) {
    if (lot.outOfStateOwner) patience += 2;
    if ((lot.yearsHeld || 0) >= 10) patience += 2;
    if (lot.vacantOrTeardown) patience += 1; // idle dirt isn't on a clock
  }
  let urgency = 0;
  const s = builder?.specSummary || {};
  if ((s.specsOverThreshold || 0) >= 1) urgency += 2;
  if ((s.medianDom || 0) >= 60) urgency += 1;
  if (/selling out|fast absorption/i.test(builder?.healthStatus || '')) urgency += 2; // hungry for dirt now
  if ((builder?.permitsPerYear || 0) >= 5) urgency += 1;
  // Alignment rewards both clocks being live; either alone is weaker.
  const aligned = Math.min(5, patience) + Math.min(5, urgency);
  return clamp(aligned);
}

/**
 * CAPITAL: is there an exit/funding source ready? A BTR buyer's recent buying
 * appetite is the cleanest capital signal; absent that, the builder's own
 * build capacity + a retail exit is moderate capital.
 */
export function capitalReadiness(buyer, builder) {
  if (buyer) {
    const buys = buyer.recentAcquisitions || 0;
    if (buys >= 10) return 9;
    if (buys >= 5) return 7;
    return 5;
  }
  // No committed capital exit - builder self-funds against a retail exit.
  const capacity = builder?.permitsPerYear || 0;
  return clamp(4 + Math.min(3, Math.floor(capacity / 10)));
}

/**
 * LAND: a light pre-screen of buildable density potential. The operator layer's
 * Field Reality Check does the deep dive; here we only gate obvious non-starters
 * so synthesis doesn't construct on impossible dirt.
 */
export function landViability(lot, p = DEFAULT_PARAMS) {
  if (!lot) return 1;
  if (isInfillLot(lot, p)) return 8;
  if (isTract(lot, p)) return 7;
  if (isPremiumLot(lot)) return 6;
  if (lot.zoning) return 4;
  return 2;
}

/** Organize raw vector output into the four primitive pools. */
export function extractPrimitives({ builders = [], lots = [], buyers = [] }) {
  return {
    people: {
      builders,
      landowners: lots.map((l) => ({
        name: l.ownerName, absentee: !!l.outOfStateOwner, parcelId: l.parcelId,
        situsAddress: l.situsAddress, motivationHints: {
          outOfState: !!l.outOfStateOwner, longHold: (l.yearsHeld || 0) >= 10, idle: !!l.vacantOrTeardown,
        },
      })),
      investors: buyers,
    },
    land: lots,
    capital: [
      ...buyers.map((b) => ({ kind: 'btr-exit', name: b.displayName, appetite: b.recentAcquisitions || 0 })),
      ...builders.map((b) => ({ kind: 'build-capacity', name: b.displayName, capacity: b.permitsPerYear || 0 })),
    ],
    timing: { note: 'timing is relational - computed per combination via timingAlignment()' },
  };
}

export { geoAligned };
