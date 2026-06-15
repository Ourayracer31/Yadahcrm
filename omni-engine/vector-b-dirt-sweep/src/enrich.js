/**
 * Normalization + enrichment for Vector B parcels.
 *
 * Takes a raw ArcGIS attribute bag, maps it onto the engine's normalized lead
 * shape via the per-county fieldMap, and derives the signals the Pain-Point
 * matching algorithm cares about: out-of-state ownership, vacant/tear-down
 * status, an assessed-equity proxy, and which strategic Play the parcel feeds.
 */

import { normalizeZoning } from './zoning.js';

function num(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(String(value).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function str(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/** Apply a county fieldMap to a raw attribute bag. */
function mapFields(raw, fieldMap) {
  const out = {};
  for (const [normalized, sourceField] of Object.entries(fieldMap || {})) {
    out[normalized] = raw[sourceField];
  }
  return out;
}

/**
 * Build a normalized, enriched lead from one raw parcel.
 * Returns the lead object (callers decide whether it passes the filters).
 */
export function buildLead(raw, source, config) {
  const m = mapFields(raw, source.fieldMap);
  const homeState = str(source.state).toUpperCase();
  const ownerMailingState = str(m.ownerMailingState).toUpperCase();

  const landValue = num(m.landValue);
  const improvementValue = num(m.improvementValue);
  const totalAssessedValue = num(m.totalAssessedValue) || landValue + improvementValue;
  const acreage = num(m.acreage);
  const landUse = normalizeZoning(m.landUse);
  const zoning = normalizeZoning(raw[source.zoningField]);

  const outOfStateOwner = Boolean(ownerMailingState && homeState && ownerMailingState !== homeState);

  const vacantByCode = (config.vacantLandUseCodes || []).some(
    (code) => landUse && landUse.startsWith(normalizeZoning(code)),
  );
  const teardownByValue = improvementValue > 0 && improvementValue <= config.teardownImprovementCeiling;
  const vacantOrTeardown = vacantByCode || improvementValue === 0 || teardownByValue;

  // Equity proxy: county assessment carries no mortgage data, so we approximate
  // "high equity" with land value on vacant dirt (no debt-bearing structure) and
  // total assessed value elsewhere. This is a screening signal, not a valuation.
  const equityProxy = vacantOrTeardown ? landValue : totalAssessedValue;

  const isTract = acreage >= 10 && acreage <= 40;
  const playTarget = isTract
    ? 'Pipeline Drought (Heavy Hitter tract)'
    : vacantOrTeardown
      ? 'Margin Squeeze (Infill/Duplex lot)'
      : 'Margin Squeeze (zoned, occupied - watchlist)';

  return {
    county: source.county,
    state: homeState,
    parcelId: str(m.parcelId),
    zoning,
    landUse,
    playTarget,
    situsAddress: str(m.situsAddress),
    situsCity: str(m.situsCity),
    ownerName: str(m.ownerName),
    ownerMailingAddress: str(m.ownerMailingAddress),
    ownerMailingCity: str(m.ownerMailingCity),
    ownerMailingState,
    ownerMailingZip: str(m.ownerMailingZip),
    outOfStateOwner,
    vacantOrTeardown,
    acreage,
    landValue,
    improvementValue,
    totalAssessedValue,
    equityProxy,
    skipTraceReady: Boolean(str(m.ownerName) && str(m.ownerMailingAddress)),
    sourceQueryUrl: source.queryUrl,
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Post-fetch filters that can't be pushed cleanly into the ArcGIS WHERE clause
 * (cross-field logic on derived values). Returns true if the lead is kept.
 */
export function passesFilters(lead, config) {
  if (config.vacantOnly && !lead.vacantOrTeardown) return false;
  if (config.outOfStateOnly && !lead.outOfStateOwner) return false;
  if (config.minAcreage > 0 && lead.acreage < config.minAcreage) return false;
  if (config.maxAcreage > 0 && lead.acreage > config.maxAcreage) return false;
  if (config.minEquityProxy > 0 && lead.equityProxy < config.minEquityProxy) return false;
  return true;
}
