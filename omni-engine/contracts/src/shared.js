/**
 * Shared helpers + compliance guards for the Honest-Broker contract generators.
 *
 * The mission has a hard rule: NEVER use the word "Wholesale" in generated
 * documents. `assertNoProhibitedTerms` enforces that at generation time so a bad
 * template or a bad data field can't slip the word into a signed instrument.
 */

const PROHIBITED = [/\bwholesale\b/i, /\bwholesaling\b/i, /\bwholesaler\b/i];

export const BROKER = {
  legalName: 'Manley Systems LLC',
  role: 'Procurement Finder',
};

export function assertNoProhibitedTerms(text) {
  for (const re of PROHIBITED) {
    if (re.test(text)) {
      throw new Error(`Compliance violation: prohibited term "${re}" found in generated document.`);
    }
  }
  return text;
}

export function money(value) {
  if (value === null || value === undefined || value === '') return '$_____________';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function clampOptionConsideration(value) {
  // Mission rule: a REAL option consideration between $50 and $100.
  const n = Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.min(100, Math.max(50, n));
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function field(value, fallback = '________________________') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}
