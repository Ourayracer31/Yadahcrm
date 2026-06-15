/**
 * Corporate-buyer (BTR) portfolio detection for Vector C.
 *
 * From a stream of single-family parcels we roll up ownership by normalized
 * entity name, keep entities that look like LLCs / corporations, and surface
 * those holding 5+ SFH with recent acquisitions - the Build-to-Rent buyers we
 * route Vector A's dead specs and Vector B's turnkey deals to.
 */

const ENTITY_HINTS = /\b(LLC|L\.?L\.?C|INC|CORP|CORPORATION|LP|L\.?P|LLP|HOLDINGS|CAPITAL|PROPERTIES|PROPERTY|INVESTMENTS?|REALTY|VENTURES?|GROUP|PARTNERS|HOMES|RENTALS?|TRUST|FUND|REIT|SFR|EQUITY)\b/;

/** Normalize an owner/entity name for grouping. */
export function normalizeEntity(name) {
  if (!name) return '';
  return String(name).toUpperCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Does the owner name look like a corporate entity (vs an individual)? */
export function looksCorporate(name) {
  return ENTITY_HINTS.test(normalizeEntity(name));
}

function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function str(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

/**
 * Roll up SFH parcels by corporate owner.
 * Returns a Map keyed by normalized entity name -> portfolio aggregate.
 */
export function aggregatePortfolios(parcels, { fieldMap, sfhLandUseCodes, now = new Date() }) {
  const byEntity = new Map();
  const sfhSet = sfhLandUseCodes.map((c) => normalizeEntity(c));

  for (const raw of parcels) {
    const ownerRaw = raw[fieldMap.ownerName];
    if (!looksCorporate(ownerRaw)) continue;

    const landUse = normalizeEntity(raw[fieldMap.landUse]);
    if (sfhSet.length && landUse && !sfhSet.some((c) => landUse.startsWith(c))) continue;

    const entity = normalizeEntity(ownerRaw);
    if (!entity) continue;
    if (!byEntity.has(entity)) {
      byEntity.set(entity, {
        entity,
        displayName: str(ownerRaw),
        mailingAddress: str(raw[fieldMap.ownerMailingAddress]),
        mailingState: str(raw[fieldMap.ownerMailingState]).toUpperCase(),
        totalHoldings: 0,
        recentAcquisitions: 0,
        parcels: [],
      });
    }
    const e = byEntity.get(entity);
    const saleDate = raw[fieldMap.saleDate] ? new Date(raw[fieldMap.saleDate]) : null;
    e.totalHoldings += 1;
    e.parcels.push({
      address: str(raw[fieldMap.situsAddress]),
      saleDate: saleDate && !Number.isNaN(saleDate.valueOf()) ? saleDate.toISOString().slice(0, 10) : '',
      salePrice: num(raw[fieldMap.salePrice]),
    });
  }
  return byEntity;
}

/**
 * Keep entities that bought >= minRecentBuys SFH inside the trailing window.
 * Returns BTR buyer records, sorted by recent acquisitions desc.
 */
export function filterBtrBuyers(byEntity, { windowMonths, minRecentBuys, now = new Date() }) {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - windowMonths);

  const buyers = [];
  for (const e of byEntity.values()) {
    const recent = e.parcels.filter((p) => p.saleDate && new Date(p.saleDate) >= cutoff);
    if (recent.length < minRecentBuys) continue;
    buyers.push({
      vector: 'C',
      entity: e.entity,
      displayName: e.displayName,
      mailingAddress: e.mailingAddress,
      mailingState: e.mailingState,
      totalHoldings: e.totalHoldings,
      recentAcquisitions: recent.length,
      recentParcels: recent,
      buyerProfile: 'Build-to-Rent portfolio investor',
      scrapedAt: now.toISOString(),
    });
  }
  return buyers.sort((a, b) => b.recentAcquisitions - a.recentAcquisitions);
}
