/**
 * MODULE 9 — Human Final Decision.
 *
 * The AI recommends; Travis decides. This module enforces that posture in the
 * data itself: every actionable artifact is wrapped as a SUGGESTION awaiting a
 * human decision, never as an instruction to send. There is deliberately no
 * "auto-send" path anywhere in the operator layer - the only way an action
 * becomes "taken" is for Travis to record his decision via `applyDecision`.
 */

export const HUMAN_DECISIONS = Object.freeze([
  'who-gets-contacted',
  'what-angle',
  'is-pain-real',
  'is-trust-present',
  'worth-pursuing',
  'issue-offer',
  'walk-away',
]);

/**
 * Wrap any recommendation so it is unmistakably advisory.
 * Adds `decision: 'awaiting-travis'` and a human-readable label.
 */
export function asSuggestion(payload, label = 'Suggested angle for Travis') {
  return {
    ...payload,
    _advisory: true,
    decision: 'awaiting-travis',
    decisionLabel: label,
    autoSend: false,
  };
}

/** Guard: refuse to treat anything as auto-sendable. Throws if asked. */
export function assertNoAutoSend(artifact) {
  if (artifact && artifact.autoSend === true) {
    throw new Error('Human Final Decision violation: the operator layer never auto-sends. Travis must decide.');
  }
  return artifact;
}

/**
 * Record Travis's decision on a suggestion. This is the ONLY way a recommendation
 * transitions out of "awaiting-travis".
 * @param {object} suggestion  an asSuggestion()-wrapped artifact
 * @param {object} decision    { action: 'pursue'|'walk-away'|'hold', by, note, angleChosen, at }
 */
export function applyDecision(suggestion, decision = {}) {
  const valid = ['pursue', 'walk-away', 'hold'];
  if (!valid.includes(decision.action)) {
    throw new Error(`Invalid decision.action "${decision.action}" (expected ${valid.join('/')}).`);
  }
  return {
    ...suggestion,
    decision: decision.action,
    decidedBy: decision.by || 'Travis Manley',
    decidedAt: decision.at || new Date().toISOString(),
    operatorNote: decision.note || '',
    angleChosen: decision.angleChosen || null,
  };
}
