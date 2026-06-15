/**
 * Zoning helpers for Vector B (The Dirt Sweep).
 *
 * The KC metro has no single zoning vocabulary - KCMO uses its 2011 Unified
 * Development Code districts (R-2.5, R-1.5, R-0.5, plus context-area overlays)
 * while KCK (Unified Government of Wyandotte County) uses R-2 / R-2.5 / R-3 /
 * R-4 / R-5. We normalize on prefix matching so a single target list of codes
 * works across both, and we build an ArcGIS WHERE clause to push the filter
 * server-side instead of dragging every parcel over the wire.
 */

/** Normalize a raw zoning value: upper-case, collapse whitespace, strip stray quotes. */
export function normalizeZoning(value) {
  if (value === null || value === undefined) return '';
  return String(value).toUpperCase().replace(/["']/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Does a parcel's zoning match any target code?
 * Prefix match so "R-3" also catches "R-3A"/"R-3 (PUD)" but not "R-30".
 */
export function zoningMatches(rawZoning, targetCodes) {
  const zoning = normalizeZoning(rawZoning);
  if (!zoning) return false;
  return targetCodes.some((code) => {
    const target = normalizeZoning(code);
    if (!target) return false;
    if (zoning === target) return true;
    // boundary-aware prefix: next char must be a non-digit so R-3 != R-30
    if (zoning.startsWith(target)) {
      const nextChar = zoning.charAt(target.length);
      return nextChar === '' || !/[0-9]/.test(nextChar);
    }
    return false;
  });
}

/**
 * Build an ArcGIS-friendly WHERE clause that pre-filters zoning server-side.
 * Uses UPPER(field) LIKE 'CODE%' OR ... so the heavy lifting happens on the
 * county's server. Falls back to '1=1' if the field/codes are missing.
 */
export function buildZoningWhereClause(zoningField, targetCodes) {
  if (!zoningField || !Array.isArray(targetCodes) || targetCodes.length === 0) {
    return '1=1';
  }
  const clauses = targetCodes
    .map((code) => normalizeZoning(code))
    .filter(Boolean)
    .map((code) => `UPPER(${zoningField}) LIKE '${escapeSql(code)}%'`);
  return clauses.length ? `(${clauses.join(' OR ')})` : '1=1';
}

/** Minimal SQL string escaping for the ArcGIS WHERE clause (single quotes). */
export function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}
