/**
 * n8n / webhook routing layer - public entry point.
 *
 * Final box in the pipeline: pushes operator intelligence + the daily board into
 * Travis's CRM dashboards.
 *
 *   ... -> operator/ + contact-memory/  ->  [ routing/ ]  ->  n8n / CRM dashboards
 *
 * Internal-only by construction: every event is advisory and addressed to the
 * Travis dashboard; the layer never auto-contacts a builder/landowner/investor.
 */

export { routeToCrm } from './router.js';
export { CHANNELS, channelForOpportunity, endpointFor } from './channels.js';
export { envelope, opportunityPayload, assertInternalOnly } from './payloads.js';
export { dispatch } from './dispatch.js';
