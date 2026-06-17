/**
 * FOLLOW-UP ENGINE - generates /daily/travis-follow-up-board.md.
 *
 * Built from the operator layer's scored opportunities + relationship memory. It
 * is opinionated: it nominates ONE most-important first call, lists warm
 * relationships to nurture, opportunities to revisit, deals to kill (with reasons)
 * and new matches found - and it carries the Field Reality Rule: "Would Travis
 * believe this works after standing on the property?" If not, it is downgraded.
 */

import { assertCompliantLanguage } from '../../operator/src/language.js';

/** Field Reality Rule gate: would Travis believe it after standing on the dirt? */
export function wouldTravisBelieveIt(opp) {
  const fc = opp.fieldCheck;
  if (!fc) return true; // no land leg (e.g. spec->buyer) - not a dirt question
  return fc.buildable !== false;
}

function contactBlock(o) {
  return {
    name: o.briefing?.contact?.name || o.parties?.builder || o.parties?.landowner || 'Contact',
    type: o.briefing?.contact?.type || 'Contact',
    phone: o.briefing?.contact?.phone || null,                       // the primary contact's OWN phone
    landownerName: o.lot?.ownerName || null,
    landownerPhone: o.briefing?.contact?.type === 'Landowner' ? null : (o.lot?.ownerPhones || [])[0] || null,
    play: o.play,
    composite: o.score?.composite,
    angle: o.briefing?.bestOpeningAngle,
    nextAction: o.briefing?.nextAction,
    desiredOutcome: o.play === 'Liquidity Bailout' ? 'Confirm BTR exit interest'
      : o.lot ? 'Confirm pain + option the dirt' : 'Confirm pain, book next step',
  };
}

/**
 * @param {object} params
 * @param {Array} params.opportunities operator-scored opportunities
 * @param {RelationshipMemory} [params.memory]
 * @param {Date} [params.date]
 * @returns {{ board, markdown }}
 */
export function generateFollowUpBoard({ opportunities = [], memory = null, date = new Date() } = {}) {
  const day = (date instanceof Date ? date : new Date(date)).toISOString().slice(0, 10);

  const live = opportunities
    .filter((o) => o.dealEval?.status !== 'kill' && !o.score?.deprioritized)
    .filter((o) => wouldTravisBelieveIt(o))
    .sort((a, b) => (b.score?.composite || 0) - (a.score?.composite || 0));

  const killed = opportunities.filter((o) => o.dealEval?.status === 'kill' || o.score?.deprioritized);

  // Must contact today: top live + memory follow-ups due.
  const mustContact = live.slice(0, 5).map(contactBlock);
  const due = memory ? memory.dueFollowUps(date) : [];

  // Warm relationships to nurture: warm/trusted contacts NOT already due today.
  const dueNames = new Set(due.map((c) => c.name));
  const warm = memory
    ? memory.all().filter((c) => (c.trustLevel || 0) >= 4 && (c.trustLevel || 0) <= 8 && !dueNames.has(c.name)).slice(0, 5)
    : [];

  // Opportunities to revisit: downgraded (not killed) deals worth another look.
  const revisit = opportunities.filter((o) => o.dealEval?.status === 'downgrade').slice(0, 5).map(contactBlock);

  // New matches found (synthesized chains rank first).
  const newMatches = live
    .filter((o) => o.synthesis)
    .slice(0, 5)
    .map((o) => ({
      builder: o.parties?.builder || o.parties?.developer,
      landowner: o.parties?.landowner,
      investor: o.parties?.buyer,
      why: o.synthesis?.creationThesis || o.rationale,
      confidence: o.synthesis?.synthesisScore ?? o.score?.composite,
    }));

  const firstCall = live[0] ? contactBlock(live[0]) : null;

  const board = { date: day, mustContact, warm, revisit, killed, newMatches, firstCall };
  const markdown = renderBoard(board);
  return { board, markdown };
}

function bullets(items, fmt) {
  return items.length ? items.map(fmt).join('\n') : '_None today._';
}

function renderBoard(b) {
  const md = [
    `# Travis Follow-Up Board — ${b.date}`,
    `\n_Suggested priorities. Travis decides who to call, what to say, and whether to walk away._\n`,

    `## Must Contact Today\n`,
    bullets(b.mustContact, (c) => [
      `- **${c.name}** (${c.type})${c.phone ? ` — ☎ ${c.phone}` : ''} — ${c.play}`,
      ...(c.landownerPhone ? [`  - Landowner ${c.landownerName || ''} ☎ ${c.landownerPhone}`] : []),
      `  - Reason: ${c.nextAction}`,
      `  - Suggested opening line: "${c.angle}"`,
      `  - Desired outcome: ${c.desiredOutcome}`,
    ].join('\n')),

    `\n## Warm Relationships To Nurture\n`,
    bullets(b.warm, (c) => `- **${c.name}** (${c.type}) — last spoke ${c.lastConversation || 'n/a'}\n  - Soft follow-up idea: check in on ${c.currentPain || 'their current pipeline'}; no ask.`),

    `\n## Opportunities To Revisit\n`,
    bullets(b.revisit, (c) => `- **${c.name}** — ${c.play}\n  - Why now may be the time: ${c.nextAction}`),

    `\n## Deals To Kill\n`,
    bullets(b.killed, (o) => `- **${o.briefing?.contact?.name || 'Contact'}** — ${o.play}\n  - Reason to stop chasing: ${o.dealEval?.reasons?.[0] || (o.score?.deprioritized ? `Operator-fit ${o.score.scores.operatorFit}/10 - not Travis's edge.` : 'Deprioritized.')}`),

    `\n## New Matches Found\n`,
    bullets(b.newMatches, (m) => [
      `- Builder: ${m.builder || '—'}`,
      `  - Landowner: ${m.landowner || '—'}`,
      `  - Investor: ${m.investor || '—'}`,
      `  - Why this may fit: ${m.why}`,
      `  - Confidence score: ${m.confidence ?? '—'}`,
    ].join('\n')),

    `\n## First Call Recommendation\n`,
    b.firstCall
      ? `**Call ${b.firstCall.name} first** (${b.firstCall.play}, composite ${b.firstCall.composite}).${b.firstCall.phone ? `\n- ☎ ${b.firstCall.phone}` : ''}${b.firstCall.landownerPhone ? `\n- Landowner ${b.firstCall.landownerName || ''} ☎ ${b.firstCall.landownerPhone}` : ''}\n- Open: "${b.firstCall.angle}"\n- Desired outcome: ${b.firstCall.desiredOutcome}`
      : `_No qualified first call today._`,
  ].join('\n');

  return assertCompliantLanguage(md, 'follow-up board');
}
