/**
 * Opportunity Synthesis Engine - the combinator that CREATES opportunities.
 *
 * "The system must never assume opportunities are discovered. The objective is to
 *  create opportunities through the intelligent combination of people, timing,
 *  capital and land."
 *
 * Every output here is explicitly marked origin:'synthesized' / discovered:false
 * and carries a creation thesis, the conditions that must be made true, and the
 * single catalyst move Travis makes to bring it into being. These objects are
 * shaped to flow straight into the matching/operator pipeline (builderRef /
 * lotRef / buyerRef / fee / play / score), so the rest of the engine treats a
 * *created* opportunity exactly like any other - but it was never just "found."
 */

import { FEES, DEFAULT_PARAMS, needsInventory, isChoked, isHeavyHitter, isInfillLot, isTract, isPremiumLot } from '../../matching/src/plays.js';
import { peopleFit, timingAlignment, capitalReadiness, landViability, geoAligned } from './primitives.js';

export const SYNTHESIS_PRINCIPLE =
  'Opportunities are created, not discovered - by combining People, Timing, Capital and Land.';

/** Guard: an opportunity entering the pipeline must be a creation, never assumed-found. */
export function assertCreated(opp) {
  if (!opp || opp.origin !== 'synthesized' || opp.discovered !== false) {
    throw new Error('Synthesis violation: opportunities must be created (origin:"synthesized", discovered:false), never assumed discovered.');
  }
  return opp;
}

const clamp = (n, lo = 1, hi = 10) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Weighted synthesis score across the four primitives (capital weighted only when present). */
function synthesisScore({ people, timing, capital, land }, hasCapitalExit) {
  const w = hasCapitalExit
    ? { people: 3, timing: 3, capital: 2, land: 2 }
    : { people: 3, timing: 3, capital: 1, land: 3 };
  const total = people * w.people + timing * w.timing + capital * w.capital + land * w.land;
  const denom = w.people + w.timing + w.capital + w.land;
  return Math.round((total / denom) * 10) / 10;
}

function landownerName(lot) {
  return lot?.ownerName || 'the landowner';
}

/** Build the common creation envelope shared by every synthesized opportunity. */
function envelope({ id, play, builder, lot, buyer, fee, primitives, thesis, conditions, catalyst, hasCapitalExit }) {
  const score = synthesisScore(primitives, hasCapitalExit);
  return assertCreated({
    id,
    origin: 'synthesized',
    discovered: false,
    play,
    builderRef: builder || null,
    lotRef: lot || null,
    buyerRef: buyer || null,
    fee: fee || null,
    score: Math.round(score * 10), // 0-100 scale for downstream sorting
    rationale: thesis,
    parties: {
      builder: builder?.displayName,
      developer: play === 'Pipeline Drought' ? builder?.displayName : undefined,
      landowner: lot ? landownerName(lot) : undefined,
      buyer: buyer?.displayName,
      parcelId: lot?.parcelId,
    },
    synthesis: {
      principle: SYNTHESIS_PRINCIPLE,
      primitivesUsed: {
        people: [builder?.displayName, lot ? landownerName(lot) : null, buyer?.displayName].filter(Boolean),
        timingScore: primitives.timing,
        capital: buyer?.displayName || (builder ? `${builder.displayName} build-capacity` : null),
        land: lot?.parcelId || null,
      },
      primitiveScores: primitives,
      synthesisScore: score,
      creationThesis: thesis,
      creationConditions: conditions,
      catalyst,
    },
  });
}

/**
 * Create opportunities from raw vector output.
 * @returns {Array} synthesized, pipeline-ready opportunities sorted by synthesis score.
 */
export function runSynthesis({ builders = [], lots = [], buyers = [] } = {}, params = DEFAULT_PARAMS) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const created = [];
  let n = 0;

  const infillLots = lots.filter((l) => isInfillLot(l, p));
  const premiumLots = lots.filter((l) => isPremiumLot(l));
  const tracts = lots.filter((l) => isTract(l, p));
  const exitBuyers = buyers;

  for (const builder of builders) {
    const wantsInventory = needsInventory(builder) || isChoked(builder);

    // ---- PATTERN 1: De-risked CHAIN (Land + Builder + Capital) ----
    // The flagship creation: option idle land, assign to a builder who needs it,
    // with a BTR buyer pre-committed as the exit. None of the three initiated it.
    if (wantsInventory) {
      for (const lot of infillLots) {
        if (!geoAligned(builder, lot)) continue;
        for (const buyer of exitBuyers) {
          const primitives = {
            people: peopleFit(builder, lot),
            timing: timingAlignment(builder, lot),
            capital: capitalReadiness(buyer, builder),
            land: landViability(lot, p),
          };
          const doors = builder.specSummary?.specsOverThreshold || 1;
          const fee = {
            type: 'Created chain: Assignment + per-door exit',
            amount: (FEES.marginSqueeze(p).amount) + (FEES.liquidityBailout(doors, p).amount),
            basis: `$${FEES.marginSqueeze(p).amount} infill assignment + $${p.perDoorFee}/door BTR exit`,
            note: 'Option land, assign to builder, BTR buyer pre-commits the turnkey exit.',
          };
          created.push(envelope({
            id: `S${++n}`, play: 'Created Chain (Land+Builder+Capital)', builder, lot, buyer, fee, primitives,
            hasCapitalExit: true,
            thesis: `Create the deal: option ${landownerName(lot)}'s idle ${lot.zoning} lot at ${lot.situsAddress}, assign to ${builder.displayName} (needs inventory), with ${buyer.displayName} pre-committed as the build-to-rent exit. Three parties who never spoke, combined into one path.`,
            conditions: [
              `Secure an option on ${lot.parcelId} at a net-to-seller the spread supports.`,
              `Confirm ${builder.displayName} has a real pipeline gap in ${lot.situsCity || 'the area'}.`,
              `Confirm ${buyer.displayName} will take the finished door(s) (exit appetite real, not theoretical).`,
              `Pass field reality on ${lot.parcelId} (utilities, access, zoning fit).`,
            ],
            catalyst: 'Travis options the land first - the option is the timing bridge that lets the builder and the capital line up behind it.',
          }));
        }
      }
    }

    // ---- PATTERN 2: Margin Squeeze creation (Land + Builder, no committed capital) ----
    if (needsInventory(builder)) {
      for (const lot of infillLots) {
        if (!geoAligned(builder, lot)) continue;
        const primitives = {
          people: peopleFit(builder, lot),
          timing: timingAlignment(builder, lot),
          capital: capitalReadiness(null, builder),
          land: landViability(lot, p),
        };
        created.push(envelope({
          id: `S${++n}`, play: 'Margin Squeeze', builder, lot, fee: FEES.marginSqueeze(p), primitives,
          hasCapitalExit: false,
          thesis: `Create the deal: bridge ${landownerName(lot)}'s idle ${lot.zoning} dirt at ${lot.situsAddress} to ${builder.displayName}, who is absorbing inventory and short on lots. Option and assign for a duplex on city pre-approved plans.`,
          conditions: [
            `Option ${lot.parcelId} at net-to-seller that leaves an assignment spread.`,
            `Confirm ${builder.displayName}'s lot pipeline gap is real.`,
            `Verify duplex feasibility / pre-approved plan eligibility on the parcel.`,
          ],
          catalyst: 'Option the lot to create inventory the builder cannot source themselves fast enough.',
        }));
      }
    }

    // ---- PATTERN 3: Liquidity creation (Builder specs + Capital) ----
    if (isChoked(builder)) {
      const doors = builder.specSummary.specsOverThreshold;
      for (const buyer of exitBuyers) {
        const primitives = {
          people: peopleFit(builder, null),
          timing: timingAlignment(builder, null),
          capital: capitalReadiness(buyer, builder),
          land: 5, // existing built specs - land viability not the constraint
        };
        created.push(envelope({
          id: `S${++n}`, play: 'Liquidity Bailout', builder, buyer,
          fee: FEES.liquidityBailout(doors, p), primitives, hasCapitalExit: true,
          thesis: `Create the deal: connect ${builder.displayName}'s ${doors} aging spec(s) to ${buyer.displayName}'s build-to-rent capital. Relieve the builder's carry, fill the investor's door target - a combination neither was working on.`,
          conditions: [
            `Confirm ${buyer.displayName}'s door target matches the product/price.`,
            `Confirm ${builder.displayName} will move at a number that still works turnkey.`,
            `Confirm the spec condition/location fit the BTR box.`,
          ],
          catalyst: 'Introduce the aging inventory to the capital before the builder discounts it at retail.',
        }));
      }
    }

    // ---- PATTERN 4: Pipeline Drought creation (Tract + heavy hitter) ----
    if (isHeavyHitter(builder, p)) {
      for (const lot of tracts) {
        const primitives = {
          people: peopleFit(builder, lot),
          timing: timingAlignment(builder, lot),
          capital: capitalReadiness(null, builder),
          land: landViability(lot, p),
        };
        created.push(envelope({
          id: `S${++n}`, play: 'Pipeline Drought', builder, lot,
          fee: FEES.pipelineDrought(lot, p), primitives, hasCapitalExit: false,
          thesis: `Create the deal: option ${landownerName(lot)}'s patiently-held ${lot.acreage}-ac tract at ${lot.situsAddress} and bring it to ${builder.displayName}, who needs subdivision space. Patient land, urgent developer, combined via the option.`,
          conditions: [
            `Option the tract long enough to assign (developer due-diligence window).`,
            `Confirm ${builder.displayName}'s subdivision appetite + geography.`,
            `Verify entitlement path, utilities, and access on ${lot.acreage} acres.`,
          ],
          catalyst: 'Tie up the tract under option so the developer can move without the holding risk.',
        }));
      }
    }

    // ---- PATTERN 5: Capital Preservation creation (Premium lot + capital-shy builder) ----
    if (/low spec exposure/i.test(builder.healthStatus || '')) {
      for (const lot of premiumLots) {
        if (!geoAligned(builder, lot)) continue;
        const primitives = {
          people: peopleFit(builder, lot),
          timing: timingAlignment(builder, lot),
          capital: capitalReadiness(null, builder),
          land: landViability(lot, p),
        };
        created.push(envelope({
          id: `S${++n}`, play: 'Capital Preservation', builder, lot,
          fee: FEES.capitalPreservation(p), primitives, hasCapitalExit: false,
          thesis: `Create the deal: secure a ${p.optionDays}-day option on the premium lot at ${lot.situsAddress} so ${builder.displayName} can market it build-to-suit without risking cash on raw dirt. Paid at retail closing.`,
          conditions: [
            `Secure a ${p.optionDays}-day option at a price the build-to-suit spread supports.`,
            `Confirm ${builder.displayName} will market build-to-suit on it.`,
            `Verify lot premium is supported by comps and school/zoning fit.`,
          ],
          catalyst: 'Hold the lot under option so the builder carries no dirt risk until a retail buyer brings the bank.',
        }));
      }
    }
  }

  return created.sort((a, b) => b.synthesis.synthesisScore - a.synthesis.synthesisScore);
}
