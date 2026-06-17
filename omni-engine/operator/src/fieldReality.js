/**
 * MODULE 4 — Field Reality Check.
 *
 * "Never assume a parcel is valuable just because zoning looks good." Before any
 * land opportunity is recommended, run it through the construction gauntlet a
 * 32-year operator would run in his head: utilities, access, grading, flood,
 * detention, shape, political friction, schools, comps, price and density.
 *
 * Honest-broker rule: where we don't have the data, we DON'T assume good - we
 * emit a "verify in field" concern. Absence of evidence is not buildability.
 */

const SEV = { hard: 4, high: 3, medium: 2, soft: 1, verify: 1 };

function add(flags, code, label, severity, note) {
  flags.push({ code, label, severity, weight: SEV[severity] ?? 1, note });
}

/**
 * @param {object} lot - Vector B lead, optionally enriched with field attributes:
 *   sewerAvailable, waterAvailable, utilityDistanceFt, access ('paved'|'gravel'|'none'),
 *   floodZone / inFloodplain, detentionRequired, parcelShapeRegular, retainingWallRisk,
 *   zoningFriction / politicalFriction, schoolDistrict / targetSchoolDistrict,
 *   compsStrength ('weak'|'ok'|'strong'), askingPrice, assumedUnits, zonedMaxUnits.
 * @returns {{ flags, severityScore, buildable, verifyList }}
 */
export function fieldRealityCheck(lot = {}) {
  const flags = [];

  // --- Utilities (the #1 deal killer for infill/tracts) ---
  if (lot.sewerAvailable === false) add(flags, 'NO_SEWER', 'No sewer service', 'hard', 'Septic or main extension required - can kill density economics.');
  else if (lot.sewerAvailable === undefined) add(flags, 'SEWER_UNVERIFIED', 'Sewer availability unverified', 'verify', 'Confirm sanitary sewer tap location and capacity.');

  if (lot.waterAvailable === false) add(flags, 'NO_WATER', 'No public water', 'high', 'Water main extension or well required.');
  if ((lot.utilityDistanceFt || 0) > 300) add(flags, 'LONG_UTILITY_RUN', `Long utility run (~${lot.utilityDistanceFt} ft)`, 'high', 'Extension cost may exceed lot margin.');

  // --- Access ---
  if (lot.access === 'none' || lot.hasRoadFrontage === false) add(flags, 'BAD_ACCESS', 'No legal road access', 'hard', 'Easement/frontage problem - verify recorded access.');
  else if (lot.access === 'gravel') add(flags, 'POOR_ACCESS', 'Unimproved (gravel) access', 'soft', 'May trigger road improvement requirement.');
  else if (lot.access === undefined) add(flags, 'ACCESS_UNVERIFIED', 'Access unverified', 'verify', 'Confirm legal, all-weather access.');

  // --- Grading / walls / drainage ---
  if (lot.retainingWallRisk) add(flags, 'RETAINING_WALL', 'Retaining wall risk', 'medium', 'Topography may force walls - check slope and cut/fill.');
  if (lot.detentionRequired) add(flags, 'DETENTION', 'Stormwater detention required', 'medium', 'Detention eats usable area; verify with city.');

  // --- Flood ---
  const inFlood = lot.inFloodplain === true || (lot.floodZone && /^(A|AE|AO|V)/i.test(String(lot.floodZone)));
  if (inFlood) add(flags, 'FLOODPLAIN', `Floodplain (${lot.floodZone || 'mapped'})`, 'high', 'Fill, LOMR, or buildable-area loss likely.');

  // --- Parcel geometry ---
  if (lot.parcelShapeRegular === false) add(flags, 'ODD_SHAPE', 'Odd parcel shape', 'soft', 'Yield/setback efficiency may suffer.');

  // --- Political / zoning friction ---
  if (lot.zoningFriction || lot.politicalFriction) add(flags, 'ZONING_FRICTION', 'Political/zoning friction', 'high', 'Neighborhood or council opposition risk - verify before optioning.');

  // --- School district mismatch (matters for retail absorption) ---
  if (lot.targetSchoolDistrict && lot.schoolDistrict && lot.schoolDistrict !== lot.targetSchoolDistrict) {
    add(flags, 'SCHOOL_MISMATCH', `School district mismatch (${lot.schoolDistrict})`, 'soft', 'Off the preferred district - may soften comps.');
  }

  // --- Comps ---
  if (lot.compsStrength === 'weak') add(flags, 'WEAK_COMPS', 'Weak comparable sales', 'medium', 'Exit price thin - confirm retail support.');

  // --- Price / density reality ---
  if (lot.askingPrice && lot.landValue && lot.askingPrice > lot.landValue * 1.25) {
    add(flags, 'OVERPRICED', 'Asking well above assessed land value', 'medium', 'Dirt may be overpriced for an option spread.');
  }
  if (lot.assumedUnits && lot.zonedMaxUnits && lot.assumedUnits > lot.zonedMaxUnits) {
    add(flags, 'DENSITY_UNREALISTIC', 'Density assumption exceeds zoning', 'high', 'Pro-forma assumes more units than zoning allows.');
  }

  const severityScore = flags.reduce((sum, f) => sum + f.weight, 0);
  const hasHardBlocker = flags.some((f) => f.severity === 'hard');
  const buildable = !hasHardBlocker && severityScore < 8;
  const verifyList = flags.filter((f) => f.severity === 'verify' || f.severity === 'high' || f.severity === 'hard').map((f) => f.label);

  return { flags, severityScore, buildable, verifyList };
}
