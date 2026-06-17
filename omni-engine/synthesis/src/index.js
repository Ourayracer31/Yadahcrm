/**
 * Opportunity Synthesis Engine - public entry point.
 *
 * Pipeline position (the creation step that feeds the operator layer):
 *   Vector A/B/C  ->  [ synthesis/ ]  ->  operator/  ->  contracts/ + n8n/CRM
 *
 * Use runSynthesis() to CREATE opportunities from raw vector output. The results
 * are shaped to drop straight into operator/runOperatorLayer({ matches }) - a
 * created opportunity carries the same builderRef/lotRef/buyerRef/fee/play/score
 * surface a match does, plus a `synthesis` block (thesis, conditions, catalyst,
 * scores) and the origin:'synthesized' / discovered:false guarantee.
 */

export { runSynthesis, assertCreated, SYNTHESIS_PRINCIPLE } from './synthesize.js';
export {
  extractPrimitives, peopleFit, timingAlignment, capitalReadiness, landViability,
} from './primitives.js';

import { runSynthesis } from './synthesize.js';

/**
 * Convenience: create opportunities and split them into a War-Room-friendly
 * shape (top creations + the four primitive pools used).
 */
export function createOpportunities(vectors, params) {
  const opportunities = runSynthesis(vectors, params);
  return {
    opportunities,
    count: opportunities.length,
    topCreation: opportunities[0] || null,
  };
}
