/**
 * Channel routing rules.
 *
 * Decides which CRM/n8n channel a routed event belongs to. Channels are logical
 * names; the router maps each to a concrete endpoint URL (with a `default`
 * fallback). This keeps "what" (classification) separate from "where" (config).
 */

export const CHANNELS = {
  HIGH_PRIORITY: 'highPriority',
  NEW_MATCHES: 'newMatches',
  FOLLOW_UPS: 'followUps',
  DEALS_TO_KILL: 'dealsToKill',
  DAILY_DIGEST: 'dailyDigest',
  DEFAULT: 'default',
};

/** Classify a scored opportunity into a channel. */
export function channelForOpportunity(opp) {
  const killed = opp.dealEval?.status === 'kill' || opp.score?.deprioritized;
  if (killed) return CHANNELS.DEALS_TO_KILL;
  if (opp.synthesis) return CHANNELS.NEW_MATCHES;       // created (synthesized) opportunities
  if (opp.score?.priority === 'high') return CHANNELS.HIGH_PRIORITY;
  return CHANNELS.DEFAULT;
}

/** Resolve a channel to its configured endpoint, falling back to default. */
export function endpointFor(channel, endpoints = {}) {
  return endpoints[channel] || endpoints[CHANNELS.DEFAULT] || null;
}
