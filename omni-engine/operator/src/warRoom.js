/**
 * MODULE 6 — Daily War Room.
 *
 * Every morning, distill the whole engine into Travis's Daily Opportunity Board.
 * Only the best make it on. The board is opinionated: it names the single call to
 * make first, and it is willing to say "Do not chase this." Built from the scored
 * opportunities produced by index.js plus the relationship memory's due follow-ups.
 */

import { assertCompliantLanguage } from './language.js';
import { asSuggestion } from './decision.js';

function topN(arr, n, scoreFn) {
  return [...arr].sort((a, b) => scoreFn(b) - scoreFn(a)).slice(0, n);
}

/**
 * @param {object} params
 * @param {Array}  params.opportunities scored opportunities from runOperatorLayer()
 * @param {RelationshipMemory} [params.memory]
 * @param {Date}   [params.date]
 */
export function generateWarRoom({ opportunities = [], memory = null, date = new Date() } = {}) {
  const live = opportunities.filter((o) => o.dealEval.status !== 'kill' && !o.score.deprioritized);
  const killed = opportunities.filter((o) => o.dealEval.status === 'kill' || o.score.deprioritized);

  const comp = (o) => o.score.composite;

  // Builder stress signals: builder-anchored, sorted by builder pain then composite.
  const builderStress = topN(
    live.filter((o) => o.builder && (o.score.scores.builderPain || 0) >= 5),
    5,
    (o) => o.score.scores.builderPain * 10 + comp(o),
  );

  // Landowner opportunities: lot-anchored, sorted by landowner motivation.
  const landowner = topN(
    live.filter((o) => o.lot),
    5,
    (o) => o.score.scores.landownerMotivation * 10 + comp(o),
  );

  // Builder-land matches: opportunities that pair a builder with a lot.
  const builderLand = topN(
    live.filter((o) => o.builder && o.lot),
    5,
    comp,
  );

  // Investor matches: Liquidity Bailout with a buyer.
  const investor = topN(
    live.filter((o) => o.buyer),
    3,
    comp,
  );

  // Follow-ups due today (from CRM memory).
  const followUps = memory ? memory.dueFollowUps(date).map((c) => ({
    name: c.name, type: c.type, lastConversation: c.lastConversation, currentPain: c.currentPain, trustLevel: c.trustLevel,
  })) : [];

  // One high-value first call: the highest composite live opportunity.
  const firstCall = live.length ? topN(live, 1, comp)[0] : null;

  // Deals to kill / stop chasing, with the reason.
  const stopChasing = killed.slice(0, 8).map((o) => ({
    who: o.briefing.contact.name,
    play: o.play,
    reason: o.dealEval.reasons[0] || (o.score.deprioritized ? `Operator-fit ${o.score.scores.operatorFit}/10 - below the bar; not Travis's edge.` : 'Deprioritized.'),
  }));

  const board = asSuggestion({
    date: (date instanceof Date ? date : new Date(date)).toISOString().slice(0, 10),
    title: 'TRAVIS DAILY OPPORTUNITY BOARD',
    topBuilderStress: builderStress.map(summarize),
    topLandownerOpportunities: landowner.map(summarize),
    topBuilderLandMatches: builderLand.map(summarize),
    topInvestorMatches: investor.map(summarize),
    followUpsDueToday: followUps,
    firstCall: firstCall ? {
      who: firstCall.briefing.contact.name,
      play: firstCall.play,
      composite: firstCall.score.composite,
      why: firstCall.briefing.whyMatters,
      angle: firstCall.briefing.bestOpeningAngle,
    } : null,
    dealsToKill: stopChasing,
  }, 'Daily War Room — suggested priorities for Travis');

  return board;
}

function summarize(o) {
  return {
    who: o.briefing.contact.name,
    play: o.play,
    composite: o.score.composite,
    priority: o.score.priority,
    builderPain: o.score.scores.builderPain,
    landownerMotivation: o.score.scores.landownerMotivation,
    operatorFit: o.score.scores.operatorFit,
    nextAction: o.briefing.nextAction,
  };
}

/** Render the board as readable morning text. */
export function renderWarRoom(board) {
  const sec = (title, items, fmt) => [
    ``, title,
    ...(items.length ? items.map(fmt) : ['   (none today)']),
  ];
  const line = (o) => `   - ${o.who} | ${o.play} | composite ${o.composite} (${o.priority}) | fit ${o.operatorFit}/10`;

  const lines = [
    `=== ${board.title} — ${board.date} ===`,
    `(suggested priorities; Travis decides what to chase)`,
    ...sec('TOP 5 BUILDER STRESS SIGNALS:', board.topBuilderStress, line),
    ...sec('TOP 5 LANDOWNER OPPORTUNITIES:', board.topLandownerOpportunities, line),
    ...sec('TOP 5 BUILDER-LAND MATCHES:', board.topBuilderLandMatches, line),
    ...sec('TOP 3 INVESTOR MATCHES:', board.topInvestorMatches, line),
    ...sec('FOLLOW-UPS DUE TODAY:', board.followUpsDueToday, (c) => `   - ${c.name} (${c.type}) | last ${c.lastConversation || 'n/a'} | pain: ${c.currentPain || 'unknown'}`),
    ``,
    `ONE HIGH-VALUE CALL FIRST:`,
    board.firstCall
      ? `   >> ${board.firstCall.who} (${board.firstCall.play}, composite ${board.firstCall.composite})\n      Why: ${board.firstCall.why}\n      Open: "${board.firstCall.angle}"`
      : `   (no qualified call today)`,
    ...sec('DEALS TO KILL / STOP CHASING:', board.dealsToKill, (d) => `   x ${d.who} | ${d.play} — ${d.reason}`),
  ];
  const text = lines.join('\n');
  return assertCompliantLanguage(text, 'war room');
}
