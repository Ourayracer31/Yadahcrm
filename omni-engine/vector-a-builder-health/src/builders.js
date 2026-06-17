/**
 * Builder aggregation + health classification for Vector A.
 *
 * Goal: from a stream of raw building permits, find MID-MARKET builders
 * (5-50 permits/yr), drop the national mega-builders, and - once spec-listing
 * signals are attached - classify whether each builder is "choked" by sitting
 * inventory or "selling out" of subdivisions. That classification is what the
 * Pain-Point matching engine routes on.
 */

/** Normalize a builder/applicant name for grouping (handles LLC/INC noise, casing). */
export function normalizeBuilderName(name) {
  if (!name) return '';
  return String(name)
    .toUpperCase()
    .replace(/[.,]/g, ' ')
    .replace(/\b(LLC|L\.?L\.?C|INC|INCORPORATED|CO|COMPANY|CORP|CORPORATION|LP|LTD|HOMES|HOMES?BUILDERS?|CONSTRUCTION|BUILDERS?|DEVELOPMENT|DEV|GROUP)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Is this one of the national mega-builders we explicitly exclude? */
export function isMegaBuilder(name, excludes) {
  const norm = normalizeBuilderName(name);
  return excludes.some((ex) => {
    const exNorm = normalizeBuilderName(ex);
    return exNorm && norm.includes(exNorm);
  });
}

/**
 * Group raw permits by builder and count those inside the trailing window.
 * Returns a Map keyed by normalized builder name.
 */
export function aggregatePermits(permits, { fieldMap, windowMonths, now = new Date() }) {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - windowMonths);
  const byBuilder = new Map();

  for (const raw of permits) {
    const rawName = raw[fieldMap.builderName];
    const norm = normalizeBuilderName(rawName);
    if (!norm) continue;

    const issued = raw[fieldMap.issueDate] ? new Date(raw[fieldMap.issueDate]) : null;
    if (issued && !Number.isNaN(issued.valueOf()) && issued < cutoff) continue;

    if (!byBuilder.has(norm)) {
      byBuilder.set(norm, { builderName: norm, displayName: String(rawName).trim(), permitCount: 0, permits: [] });
    }
    const entry = byBuilder.get(norm);
    entry.permitCount += 1;
    entry.permits.push({
      address: raw[fieldMap.address] ? String(raw[fieldMap.address]).trim() : '',
      issueDate: issued ? issued.toISOString().slice(0, 10) : '',
      permitType: fieldMap.permitType ? raw[fieldMap.permitType] : undefined,
    });
  }
  return byBuilder;
}

/**
 * Keep only mid-market builders: annualized permit count within [min,max] and
 * not a mega-builder. windowMonths is used to annualize the raw count.
 */
export function filterMidMarket(byBuilder, { minPerYear, maxPerYear, windowMonths, megaExcludes }) {
  const years = windowMonths / 12;
  const kept = [];
  for (const entry of byBuilder.values()) {
    if (isMegaBuilder(entry.displayName, megaExcludes)) continue;
    const perYear = years > 0 ? entry.permitCount / years : entry.permitCount;
    if (perYear < minPerYear || perYear > maxPerYear) continue;
    kept.push({ ...entry, permitsPerYear: Math.round(perYear * 10) / 10 });
  }
  return kept;
}

/**
 * Attach spec-inventory health and derive the suggested Play.
 * `specSummary` is the output of summarizeSpecs() for this builder (may be null).
 */
export function classifyHealth(builder, specSummary, { staleDomDays }) {
  const s = specSummary || { activeSpecs: 0, specsOverThreshold: 0, priceDrops: 0, medianDom: 0 };
  let status;
  let suggestedPlay;

  if (s.specsOverThreshold > 0) {
    status = 'Choked (sitting inventory)';
    // Dead specs -> connect to Vector C BTR buyers.
    suggestedPlay = 'Liquidity Bailout (offload specs to BTR investors)';
  } else if (s.activeSpecs > 0 && s.medianDom > 0 && s.medianDom < staleDomDays) {
    status = 'Selling out (fast absorption)';
    // Moving fast and needs more dirt -> infill / build-to-suit / tracts.
    suggestedPlay = 'Margin Squeeze or Pipeline Drought (feed more dirt)';
  } else if (s.activeSpecs === 0 && builder.permitsPerYear >= 5) {
    status = 'Building, low spec exposure';
    suggestedPlay = 'Capital Preservation (paper-lot build-to-suit)';
  } else {
    status = 'Watchlist';
    suggestedPlay = 'Monitor';
  }

  return {
    ...builder,
    specSummary: s,
    healthStatus: status,
    suggestedPlay,
  };
}
