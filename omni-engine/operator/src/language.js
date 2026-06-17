/**
 * MODULE 8 — Trust-First Language Rules.
 *
 * The central language governor for the whole Omni-Engine. Every operator-facing
 * string (briefings, scripts, war-room copy, daily-ops lines) and every generated
 * instrument is meant to pass through here. It enforces two things:
 *   1. BANNED terms never appear (wholesaler vocabulary + hype/pressure phrases).
 *   2. PREFERRED, field-credible language is suggested in their place.
 *
 * This is deliberately stricter than the contract generator's local "no
 * Wholesale" guard - it is the superset the rest of the system defers to.
 */

/** Phrases that must never appear in any operator-facing output. */
export const BANNED_TERMS = [
  'wholesale', 'wholesaling', 'wholesaler',
  'motivated seller',
  'cash buyer',
  'deal blast',
  'lock it up',
  'off-market steal',
  'urgent opportunity',
  'act fast',
  'investor special',
];

/** The credible vocabulary Travis actually uses. */
export const PREFERRED_TERMS = [
  'option structure',
  'procurement role',
  'development fit',
  'builder pipeline',
  'field feasibility',
  'land solution',
  'inventory relief',
  'transparent finder fee',
  'net-to-seller offer',
  'construction path',
];

/** Banned -> preferred rewrite suggestions (best-effort, for `scrubLanguage`). */
export const REWRITES = {
  'wholesale': 'option structure',
  'wholesaling': 'option structure',
  'wholesaler': 'procurement finder',
  'motivated seller': 'landowner exploring options',
  'cash buyer': 'qualified builder/investor',
  'deal blast': 'targeted outreach',
  'lock it up': 'secure an option',
  'off-market steal': 'off-market land solution',
  'urgent opportunity': 'time-sensitive development fit',
  'act fast': 'worth a timely conversation',
  'investor special': 'build-to-rent fit',
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Return every banned-term hit in `text` (case-insensitive), with positions. */
export function checkLanguage(text) {
  const str = String(text ?? '');
  const violations = [];
  for (const term of BANNED_TERMS) {
    // `s?` catches simple plurals (wholesaler -> wholesalers, cash buyer -> cash buyers).
    const re = new RegExp(`\\b${escapeRegex(term)}s?\\b`, 'gi');
    let m;
    while ((m = re.exec(str)) !== null) {
      violations.push({ term, index: m.index, match: m[0] });
    }
  }
  return violations.sort((a, b) => a.index - b.index);
}

/** Throw if any banned term is present. Returns `text` unchanged when clean. */
export function assertCompliantLanguage(text, where = 'output') {
  const v = checkLanguage(text);
  if (v.length) {
    const terms = [...new Set(v.map((x) => `"${x.match}"`))].join(', ');
    throw new Error(`Trust-First language violation in ${where}: ${terms}. Use preferred vocabulary instead.`);
  }
  return text;
}

/**
 * Best-effort rewrite: replace banned terms with preferred substitutes.
 * Returns { clean, violations, changed }. Use for soft-correcting drafts; use
 * `assertCompliantLanguage` for the hard gate on final output.
 */
export function scrubLanguage(text) {
  let clean = String(text ?? '');
  const violations = checkLanguage(clean);
  for (const term of BANNED_TERMS) {
    const replacement = REWRITES[term] || '[redacted]';
    const re = new RegExp(`\\b${escapeRegex(term)}s?\\b`, 'gi');
    clean = clean.replace(re, (match) => {
      // preserve leading capitalization
      return /^[A-Z]/.test(match) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
    });
  }
  return { clean, violations, changed: violations.length > 0 };
}
