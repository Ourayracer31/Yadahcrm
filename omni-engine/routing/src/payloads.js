/**
 * Webhook payload envelopes for n8n / CRM dashboards.
 *
 * Two invariants enforced here:
 *   1. INTERNAL ONLY — every payload is addressed to Travis's dashboard
 *      (`audience: 'travis-dashboard'`, `outreach: false`). This layer pushes
 *      intelligence into the CRM; it NEVER contacts a lead. `assertInternalOnly`
 *      throws on any payload that claims otherwise.
 *   2. TRUST-FIRST LANGUAGE — any human-readable text routed through here passes
 *      the operator language guard.
 */

import { assertCompliantLanguage } from '../../operator/src/language.js';

/** Wrap data in the standard n8n-friendly envelope (advisory, internal-only). */
export function envelope(event, channel, data, { date = new Date() } = {}) {
  const payload = {
    event,
    channel,
    source: 'omni-engine',
    audience: 'travis-dashboard', // dashboards/notifications for Travis only
    outreach: false,              // never auto-contacts a builder/landowner/investor
    advisory: true,               // recommendations only; Travis decides
    timestamp: (date instanceof Date ? date : new Date(date)).toISOString(),
    data,
  };
  return assertInternalOnly(payload);
}

/** Guard: refuse to emit any payload that would contact a lead. */
export function assertInternalOnly(payload) {
  if (payload.outreach !== false || payload.audience !== 'travis-dashboard') {
    throw new Error('Routing guard: this layer is internal-only (Travis dashboards). It must never auto-contact a lead.');
  }
  return payload;
}

const text = (s) => (s == null ? s : assertCompliantLanguage(String(s), 'routed payload'));

/** Compact, language-guarded projection of an opportunity for the dashboard. */
export function opportunityPayload(opp) {
  return {
    id: opp.id,
    origin: opp.origin || 'matched',
    play: opp.play,
    status: opp.dealEval?.status || 'proceed',
    priority: opp.score?.priority,
    composite: opp.score?.composite,
    operatorFit: opp.score?.scores?.operatorFit,
    contact: opp.briefing?.contact || null,
    parties: opp.parties || null,
    fee: opp.fee || null,
    whyMatters: text(opp.briefing?.whyMatters),
    bestOpeningAngle: text(opp.briefing?.bestOpeningAngle),
    nextAction: text(opp.briefing?.nextAction),
    fieldConcerns: opp.briefing?.fieldConcerns || [],
    creation: opp.synthesis ? {
      thesis: text(opp.synthesis.creationThesis),
      catalyst: text(opp.synthesis.catalyst),
      conditions: opp.synthesis.creationConditions || [],
      synthesisScore: opp.synthesis.synthesisScore,
    } : null,
    killReason: opp.dealEval?.status === 'kill' ? text(opp.dealEval.reasons?.[0]) : null,
  };
}
