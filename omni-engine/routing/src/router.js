/**
 * The routing layer - turns operator-layer output + the daily board into a set
 * of internal-only webhook events and dispatches them to the configured n8n /
 * CRM endpoints.
 *
 * Event types:
 *   opportunity.routed    - one per opportunity, channeled by priority/status
 *   warroom.daily         - the daily War Room digest
 *   board.daily           - the Travis Follow-Up Board (markdown + structured)
 *   firstcall.recommended - the single first call to make
 *
 * Everything emitted is advisory + internal (Travis dashboards). Nothing here
 * contacts a lead.
 */

import { channelForOpportunity, endpointFor, CHANNELS } from './channels.js';
import { envelope, opportunityPayload } from './payloads.js';
import { dispatch } from './dispatch.js';

/**
 * @param {object} params
 * @param {object} params.operatorResult output of operator/runOperatorLayer()
 * @param {object} [params.board]        output of contact-memory/generateFollowUpBoard()
 * @param {object} params.config         { endpoints, dryRun, minComposite, transport, maxRetries, sleepFn, logger }
 * @returns {Promise<{ manifest, stats }>}
 */
export async function routeToCrm({ operatorResult = {}, board = null, config = {} } = {}) {
  const {
    endpoints = {}, dryRun = false, minComposite = 0,
    transport, maxRetries, sleepFn, logger, date = new Date(),
  } = config;

  const opts = { transport, maxRetries, dryRun, sleepFn, logger };
  const manifest = [];

  const send = async (event, channel, data) => {
    const endpoint = endpointFor(channel, endpoints);
    const payload = envelope(event, channel, data, { date });
    const result = await dispatch(endpoint, payload, opts);
    manifest.push({ event, channel, endpoint, status: result.status, attempts: result.attempts, error: result.error });
    return result;
  };

  // 1) Per-opportunity events (filtered by composite floor, except kills which
  //    we always surface so Travis sees what to stop chasing).
  for (const opp of operatorResult.opportunities || []) {
    const killed = opp.dealEval?.status === 'kill' || opp.score?.deprioritized;
    if (!killed && (opp.score?.composite || 0) < minComposite) continue;
    const channel = channelForOpportunity(opp);
    await send('opportunity.routed', channel, opportunityPayload(opp));
  }

  // 2) War Room daily digest.
  if (operatorResult.warRoom) {
    await send('warroom.daily', CHANNELS.DAILY_DIGEST, {
      date: operatorResult.warRoom.date,
      firstCall: operatorResult.warRoom.firstCall || null,
      counts: operatorResult.stats || null,
      dealsToKill: operatorResult.warRoom.dealsToKill || [],
    });
  }

  // 3) Daily Follow-Up Board.
  if (board) {
    await send('board.daily', CHANNELS.DAILY_DIGEST, {
      date: board.board?.date,
      markdown: board.markdown,
      mustContact: board.board?.mustContact || [],
      newMatches: board.board?.newMatches || [],
    });
    // 4) First-call alert (high-priority channel).
    if (board.board?.firstCall) {
      await send('firstcall.recommended', CHANNELS.HIGH_PRIORITY, board.board.firstCall);
    }
  }

  const stats = manifest.reduce((acc, m) => {
    acc.total += 1;
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, { total: 0 });

  return { manifest, stats };
}
