/**
 * MODULE 10 — 30-Contact Daily Operating System.
 *
 * Travis's daily workflow: 30 contacts, split 10 builders / 10 landowners /
 * 5 investors-developers / 5 relationship follow-ups. Each contact card carries
 * the seven prep fields so he can pick up the phone cold-prepared. Success is not
 * just closings - the OS tracks the full activity funnel.
 */

import { asSuggestion } from './decision.js';
import { generateOpener } from './scripts.js';
import { assertCompliantLanguage } from './language.js';

const SPLIT = { builder: 10, landowner: 10, investor: 5, followUp: 5 };

/** Likely objection + response per audience (field-credible, never pushy). */
function objectionPlay(audience, opp) {
  if (audience === 'builder') {
    return {
      likelyObjection: '"We\'re fine on lots right now."',
      responseToObjection: 'Totally fair - I\'m not selling lots. I just track which builders are squeezed where, and I\'d rather know your real pinch point than guess. If it\'s not lots, what is it?',
      whatToListenFor: 'Hesitation on spec movement, a pause before "we\'re fine," any mention of a slow subdivision pocket.',
    };
  }
  if (audience === 'landowner') {
    return {
      likelyObjection: '"It\'s not for sale."',
      responseToObjection: 'Understood, and I\'m not asking you to list it. A lot of owners just don\'t know what could be built there - I work with builders who do. No pressure either way.',
      whatToListenFor: 'Curiosity about value/use, life changes (taxes, estate, distance), "what did you have in mind?"',
    };
  }
  return {
    likelyObjection: '"Send me the numbers."',
    responseToObjection: 'Nothing to send yet - I wanted to confirm your buy-box is still active before I bring you anything real. What\'s your current door target?',
    whatToListenFor: 'Active acquisition appetite, geography, turnkey vs. ground-up preference, capital readiness.',
  };
}

/** Build one contact card with the seven required prep fields. */
function buildCard(audience, opp, memory) {
  const contactName = opp.builder?.displayName || opp.lot?.ownerName || opp.buyer?.displayName || 'Contact';
  const mem = memory ? memory.get(contactName) : null;
  const opener = generateOpener(opp, audience);
  const ob = objectionPlay(audience, opp);

  const reasonForContact = audience === 'followUp'
    ? `Scheduled follow-up. Last spoke ${mem?.lastConversation || 'recently'}; known pain: ${mem?.currentPain || 'verify'}.`
    : (opp.briefing?.whyMatters || `${opp.play} opportunity worth a conversation.`);

  const card = {
    audience,
    contact: contactName,
    play: opp.play || (audience === 'followUp' ? 'Follow-up' : null),
    reasonForContact,                                  // 1
    openingLine: opener.text,                          // 2
    discoveryQuestion: opener.structure.fieldQuestion, // 3
    likelyObjection: ob.likelyObjection,               // 4
    responseToObjection: ob.responseToObjection,       // 5
    whatToListenFor: ob.whatToListenFor,               // 6
    followUpAction: audience === 'followUp'
      ? 'Advance the relationship: confirm pain, book next step, update trust level.'
      : 'If pain is real, book a follow-up and log it in relationship memory.', // 7
    operatorFit: opp.score?.scores?.operatorFit ?? null,
    composite: opp.score?.composite ?? null,
  };
  assertCompliantLanguage([card.openingLine, card.responseToObjection].join(' '), 'daily-ops card');
  return card;
}

/**
 * Build the day's 30-contact plan from scored opportunities + memory.
 * @param {object} params
 * @param {Array}  params.opportunities scored, live opportunities (from runOperatorLayer)
 * @param {RelationshipMemory} [params.memory]
 * @param {Date}   [params.date]
 */
export function buildDailyPlan({ opportunities = [], memory = null, date = new Date() } = {}) {
  const live = opportunities.filter((o) => o.dealEval.status !== 'kill' && !o.score.deprioritized);
  const byComposite = (a, b) => b.score.composite - a.score.composite;

  const builders = live.filter((o) => o.builder && o.lot).sort(byComposite);
  const builderConvos = live.filter((o) => o.builder).sort(byComposite);
  const landowners = live.filter((o) => o.lot).sort(byComposite);
  const investors = live.filter((o) => o.buyer).sort(byComposite);

  const cards = {
    builderConversations: builderConvos.slice(0, SPLIT.builder).map((o) => buildCard('builder', o, memory)),
    landownerConversations: landowners.slice(0, SPLIT.landowner).map((o) => buildCard('landowner', o, memory)),
    investorConversations: investors.slice(0, SPLIT.investor).map((o) => buildCard('investor', o, memory)),
    relationshipFollowUps: [],
  };

  // Follow-ups come from CRM memory's due list, wrapped as lightweight opportunities.
  if (memory) {
    const due = memory.dueFollowUps(date).slice(0, SPLIT.followUp);
    cards.relationshipFollowUps = due.map((c) => buildCard('followUp', {
      builder: c.type === 'builder' ? { displayName: c.name } : undefined,
      lot: c.type === 'landowner' ? { ownerName: c.name } : undefined,
      buyer: c.type === 'investor' ? { displayName: c.name } : undefined,
      play: 'Follow-up',
      briefing: { whyMatters: `Follow-up with ${c.name}.` },
    }, memory));
  }

  const targets = SPLIT;
  const counts = {
    builderConversations: cards.builderConversations.length,
    landownerConversations: cards.landownerConversations.length,
    investorConversations: cards.investorConversations.length,
    relationshipFollowUps: cards.relationshipFollowUps.length,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return asSuggestion({
    date: (date instanceof Date ? date : new Date(date)).toISOString().slice(0, 10),
    title: '30-CONTACT DAILY OPERATING SYSTEM',
    targets,
    counts,
    total,
    cards,
    kpiTracker: blankKpiTracker(),
  }, 'Daily 30-contact plan — suggested for Travis');
}

/** The activity funnel. Closings are the tip; the OS measures the whole pipeline. */
export function blankKpiTracker() {
  return {
    conversationsStarted: 0,
    realPainDiscovered: 0,
    followUpsBooked: 0,
    parcelsVerified: 0,
    buildersProfiled: 0,
    investorsConfirmed: 0,
    offersMade: 0,
    optionsSigned: 0,
    assignmentsClosed: 0,
  };
}
