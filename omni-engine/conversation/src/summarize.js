/**
 * Turn a raw conversation (notes or a transcript) into the structured fields the
 * relationship memory stores. Two paths:
 *
 *   - summarizeWithClaude(): uses Claude (claude-opus-4-8 by default) with a
 *     constrained JSON schema. Best quality; needs ANTHROPIC_API_KEY.
 *   - extractHeuristic(): pure, offline, deterministic rule-based extraction.
 *     No key, no network - works the moment you install, and is what the tests
 *     exercise.
 *
 * summarizeConversation() picks Claude when a key is present and falls back to
 * the heuristic on any error, so logging a call never fails for lack of setup.
 */

const FIELDS = ['summary', 'painLearned', 'opportunity', 'objections', 'personal', 'followUpPromised', 'nextAction', 'nextFollowUpDate'];

function sentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function firstMatch(sents, re) {
  return sents.find((s) => re.test(s)) || '';
}

/** Parse a follow-up date from natural language, relative to `now`. Returns ISO date or ''. */
export function parseFollowUpDate(text, now = new Date()) {
  const t = String(text || '').toLowerCase();
  const base = new Date(now);
  const iso = (d) => d.toISOString().slice(0, 10);

  // explicit ISO or M/D[/Y]
  const isoM = t.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoM) return iso(new Date(Number(isoM[1]), Number(isoM[2]) - 1, Number(isoM[3])));
  const mdM = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (mdM) {
    let y = mdM[3] ? Number(mdM[3]) : base.getFullYear();
    if (y < 100) y += 2000;
    return iso(new Date(y, Number(mdM[1]) - 1, Number(mdM[2])));
  }
  // "in N day/week/month(s)"
  const inM = t.match(/\bin\s+(a|an|one|two|three|four|\d+)\s+(day|week|month)s?\b/);
  if (inM) {
    const words = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };
    const n = words[inM[1]] ?? Number(inM[1]) ?? 1;
    const d = new Date(base);
    if (inM[2] === 'day') d.setDate(d.getDate() + n);
    else if (inM[2] === 'week') d.setDate(d.getDate() + n * 7);
    else d.setMonth(d.getMonth() + n);
    return iso(d);
  }
  if (/\btomorrow\b/.test(t)) { const d = new Date(base); d.setDate(d.getDate() + 1); return iso(d); }
  if (/\bnext week\b/.test(t)) { const d = new Date(base); d.setDate(d.getDate() + 7); return iso(d); }
  if (/\bnext month\b/.test(t)) { const d = new Date(base); d.setMonth(d.getMonth() + 1); return iso(d); }
  // weekday name -> next occurrence
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayM = t.match(/\b(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (dayM) {
    const target = days.indexOf(dayM[1]);
    const d = new Date(base);
    let delta = (target - d.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    d.setDate(d.getDate() + delta);
    return iso(d);
  }
  return '';
}

/** Deterministic, offline extraction. Returns the full field set. */
export function extractHeuristic(transcript, { now = new Date() } = {}) {
  const sents = sentences(transcript);
  const text = sents.join(' ');

  const summary = sents.slice(0, 2).join(' ').slice(0, 240) || text.slice(0, 240);
  const painLearned = firstMatch(sents, /\b(sitting|aging|stale|short on|no sewer|price drop|slow|behind|problem|struggl|need|tight|cash|lender|can'?t|won'?t|stuck|pressure|squeez)/i);
  // Prefer a land/deal sentence; fall back to spec/build mentions.
  const opportunity = firstMatch(sents, /\b(lot|lots|land|dirt|parcel|duplex|infill|option|acre|tract|subdivision)\b/i)
    || firstMatch(sents, /\b(spec|specs|build|building)\b/i);
  const objections = firstMatch(sents, /\b(but|not sure|won'?t|can'?t|concerned|worried|expensive|too (high|much|low)|hesitant|nervous)/i);
  const followUpPromised = firstMatch(sents, /\b(i'?ll|i will|i'?m going to|promised|send you|get you|circle back)/i);
  const nextAction = firstMatch(sents, /\b(follow up|send|call|bring|check|next|schedule|meet|visit)/i) || 'Follow up to confirm pain and next step.';
  const nextFollowUpDate = parseFollowUpDate(transcript, now);

  return { summary, painLearned, opportunity, objections, personal: '', followUpPromised, nextAction, nextFollowUpDate };
}

/** Claude-powered structured extraction. Needs ANTHROPIC_API_KEY. */
export async function summarizeWithClaude(transcript, { contactName = 'the contact', kind = 'builder', now = new Date(), model } = {}) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const MODEL = model || process.env.OMNI_MODEL || 'claude-opus-4-8';
  const today = now.toISOString().slice(0, 10);

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: Object.fromEntries(FIELDS.map((f) => [f, { type: 'string' }])),
    required: FIELDS,
  };

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [
      'You extract structured intel from a real-estate operator\'s conversation notes for Travis Manley\'s CRM.',
      'Be faithful and concise; do not invent facts. Use trust-first language and never use the words "wholesale", "motivated seller", "cash buyer", or hype/pressure phrasing.',
      `Today is ${today}. For nextFollowUpDate output an ISO date (YYYY-MM-DD) if a follow-up time is implied, otherwise an empty string.`,
      'Leave any field you cannot support from the notes as an empty string.',
    ].join(' '),
    messages: [{
      role: 'user',
      content: `Contact: ${contactName} (${kind}).\n\nConversation notes / transcript:\n"""\n${transcript}\n"""\n\nExtract the fields.`,
    }],
    output_config: { format: { type: 'json_schema', schema } },
  });

  const text = (response.content.find((b) => b.type === 'text') || {}).text || '{}';
  const obj = JSON.parse(text);
  const out = {};
  for (const f of FIELDS) out[f] = typeof obj[f] === 'string' ? obj[f] : '';
  return out;
}

/**
 * Summarize, preferring Claude when configured. Falls back to the heuristic on
 * any error (missing key, network, parse) so capture never fails.
 * @returns {{ fields, engine }} engine is 'claude' | 'heuristic'
 */
export async function summarizeConversation(transcript, opts = {}) {
  const wantClaude = !opts.heuristic && process.env.ANTHROPIC_API_KEY;
  if (wantClaude) {
    try {
      return { fields: await summarizeWithClaude(transcript, opts), engine: 'claude' };
    } catch (err) {
      if (opts.onFallback) opts.onFallback(err);
    }
  }
  return { fields: extractHeuristic(transcript, opts), engine: 'heuristic' };
}
