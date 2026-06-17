/**
 * The four strategic Plays, as pure predicates + fee math.
 *
 * Each play exposes:
 *   - `triggers(builder|lot|buyer)` helpers used by the matcher
 *   - `fee(...)` that returns the disclosed finder's-fee structure
 * Keeping these isolated means the matcher in match.js stays declarative and the
 * fee logic is unit-testable without any scraping.
 */

export const DEFAULT_PARAMS = {
  // Margin Squeeze (infill/duplex)
  infillFee: 10000,
  infillLotMin: 50000,
  infillLotMax: 70000,
  // Liquidity Bailout (spec choke)
  perDoorFee: 5000,
  // Capital Preservation (paper lot)
  optionDays: 120,
  // Pipeline Drought (heavy hitter tract)
  tractAcresMin: 15,
  tractFeeFloor: 10000, // "five-figure"
};

/** A lot is an infill/duplex target: density zoning, vacant/tear-down, in the buy band. */
export function isInfillLot(lot, p = DEFAULT_PARAMS) {
  if (!lot) return false;
  const inBand = lot.equityProxy === 0
    || (lot.landValue >= p.infillLotMin && lot.landValue <= p.infillLotMax);
  return Boolean(lot.vacantOrTeardown) && inBand && (lot.acreage || 0) < 10;
}

/** A lot is a heavy-hitter tract: 15+ acres of optionable dirt. */
export function isTract(lot, p = DEFAULT_PARAMS) {
  return Boolean(lot) && (lot.acreage || 0) >= p.tractAcresMin;
}

/** A lot is a premium build-to-suit lot: has structure value / not raw infill, sub-tract size. */
export function isPremiumLot(lot) {
  if (!lot) return false;
  return !lot.vacantOrTeardown && (lot.acreage || 0) < 10 && (lot.totalAssessedValue || 0) > 0;
}

/** Builder is choked by sitting inventory. */
export function isChoked(builder) {
  return Boolean(builder?.specSummary && builder.specSummary.specsOverThreshold > 0);
}

/** Builder is absorbing fast / needs affordable inventory. */
export function needsInventory(builder) {
  if (!builder) return false;
  return /selling out|fast absorption/i.test(builder.healthStatus || '')
    || (builder.specSummary && builder.specSummary.activeSpecs === 0 && (builder.permitsPerYear || 0) >= 5);
}

/** Builder is building but capital-shy (low spec exposure). */
export function isCapitalShy(builder) {
  return /low spec exposure/i.test(builder?.healthStatus || '');
}

/** Builder/developer is a heavy hitter (top of the mid-market band or flagged). */
export function isHeavyHitter(builder, p = DEFAULT_PARAMS) {
  return Boolean(builder?.heavyHitter) || (builder?.permitsPerYear || 0) >= 30;
}

export const FEES = {
  marginSqueeze: (p = DEFAULT_PARAMS) => ({
    type: 'Assignment / Finder Fee',
    amount: p.infillFee,
    basis: 'flat',
    note: 'Option infill R-3 lot, assign to builder for duplex on city pre-approved plans.',
  }),
  liquidityBailout: (doors, p = DEFAULT_PARAMS) => ({
    type: 'Finder Fee',
    amount: p.perDoorFee * Math.max(1, doors),
    basis: `${p.perDoorFee}/door x ${Math.max(1, doors)} door(s)`,
    note: 'Connect dead spec inventory to BTR investor; per-door turnkey finder fee.',
  }),
  capitalPreservation: (p = DEFAULT_PARAMS) => ({
    type: 'Option Contract (paid at retail closing)',
    amount: null,
    basis: `${p.optionDays}-day option, build-to-suit spread captured at closing`,
    note: 'Secure option on premium lot; builder markets build-to-suit; paid when retail buyer closes.',
  }),
  pipelineDrought: (lot, p = DEFAULT_PARAMS) => ({
    type: 'Assignment Fee',
    amount: Math.max(p.tractFeeFloor, Math.round((lot?.equityProxy || 0) * 0.1)),
    basis: 'five-figure assignment on exurban tract',
    note: 'Option 15+ ac tract; assign to developer needing subdivision space.',
  }),
};
