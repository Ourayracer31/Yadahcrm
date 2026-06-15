/**
 * Omni-Engine Pain-Point Matching engine.
 *
 * Pure, deterministic routing of scraped leads into the four strategic Plays.
 * Input is the three vectors' outputs; output is a ranked list of match objects,
 * each naming the parties, the Play, and the disclosed fee structure — ready for
 * the contract generator and the n8n/CRM router.
 *
 *   Vector A -> builders[]   (health roster)
 *   Vector B -> lots[]       (dirt leads)
 *   Vector C -> buyers[]     (BTR buyer list)
 */

import {
  DEFAULT_PARAMS, FEES,
  isInfillLot, isTract, isPremiumLot,
  isChoked, needsInventory, isCapitalShy, isHeavyHitter,
} from './plays.js';

function lotMetro(lot) {
  return (lot.situsCity || lot.county || '').toString().toUpperCase();
}

function builderMetro(builder) {
  return (builder.metro || builder.county || '').toString().toUpperCase();
}

/** Loose geo-affinity: if both sides declare a metro/county, prefer same-area pairs. */
function geoCompatible(a, b) {
  if (!a || !b) return true;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Build matches for all four plays.
 * @returns {Array} match objects sorted by score (confidence/value) desc.
 */
export function runMatches({ builders = [], lots = [], buyers = [] }, params = DEFAULT_PARAMS) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const matches = [];
  let id = 0;

  const infillLots = lots.filter((l) => isInfillLot(l, p));
  const tracts = lots.filter((l) => isTract(l, p));
  const premiumLots = lots.filter((l) => isPremiumLot(l));

  for (const builder of builders) {
    // 1) MARGIN SQUEEZE — builder needs affordable inventory + infill lot.
    if (needsInventory(builder)) {
      for (const lot of infillLots) {
        if (!geoCompatible(builderMetro(builder), lotMetro(lot))) continue;
        matches.push({
          id: `M${++id}`,
          play: 'Margin Squeeze',
          parties: { builder: builder.displayName, lot: lot.situsAddress, parcelId: lot.parcelId },
          fee: FEES.marginSqueeze(p),
          score: 70 + (builder.permitsPerYear || 0),
          rationale: `${builder.displayName} is absorbing inventory; option ${lot.zoning} infill lot at ${lot.situsAddress} and assign for duplex.`,
          lotRef: lot,
          builderRef: builder,
        });
      }
    }

    // 2) LIQUIDITY BAILOUT — choked builder + BTR buyer.
    if (isChoked(builder)) {
      const doors = builder.specSummary.specsOverThreshold;
      for (const buyer of buyers) {
        matches.push({
          id: `M${++id}`,
          play: 'Liquidity Bailout',
          parties: { builder: builder.displayName, buyer: buyer.displayName, doors },
          fee: FEES.liquidityBailout(doors, p),
          score: 85 + doors + Math.min(20, buyer.recentAcquisitions || 0),
          rationale: `${builder.displayName} has ${doors} stale spec(s); route to BTR buyer ${buyer.displayName} (${buyer.recentAcquisitions} buys/24mo).`,
          builderRef: builder,
          buyerRef: buyer,
        });
      }
    }

    // 3) CAPITAL PRESERVATION — capital-shy builder + premium build-to-suit lot.
    if (isCapitalShy(builder)) {
      for (const lot of premiumLots) {
        if (!geoCompatible(builderMetro(builder), lotMetro(lot))) continue;
        matches.push({
          id: `M${++id}`,
          play: 'Capital Preservation',
          parties: { builder: builder.displayName, lot: lot.situsAddress, parcelId: lot.parcelId },
          fee: FEES.capitalPreservation(p),
          score: 60,
          rationale: `${builder.displayName} won't risk cash on dirt; secure ${p.optionDays}-day option on ${lot.situsAddress} for build-to-suit.`,
          lotRef: lot,
          builderRef: builder,
        });
      }
    }

    // 4) PIPELINE DROUGHT — heavy hitter + exurban tract.
    if (isHeavyHitter(builder, p)) {
      for (const lot of tracts) {
        matches.push({
          id: `M${++id}`,
          play: 'Pipeline Drought',
          parties: { developer: builder.displayName, tract: lot.situsAddress, parcelId: lot.parcelId, acres: lot.acreage },
          fee: FEES.pipelineDrought(lot, p),
          score: 90 + (lot.acreage || 0),
          rationale: `${builder.displayName} needs subdivision space; option ${lot.acreage}-ac tract at ${lot.situsAddress} and assign.`,
          lotRef: lot,
          builderRef: builder,
        });
      }
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

/** Convenience: group matches by play for dashboard routing. */
export function groupByPlay(matches) {
  return matches.reduce((acc, m) => {
    (acc[m.play] = acc[m.play] || []).push(m);
    return acc;
  }, {});
}
