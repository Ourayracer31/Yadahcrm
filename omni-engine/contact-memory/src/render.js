/**
 * Shared rendering helpers for contact memory files.
 *
 * Honest-intake rule: unknown fields render as an em dash, never a guess. A memory
 * file is a living intake form - blanks are prompts for Travis to fill from the
 * field, not invitations for the system to fabricate.
 */

import { assertCompliantLanguage } from '../../operator/src/language.js';

export const BLANK = '—';

export function field(v) {
  if (v === null || v === undefined || v === '') return BLANK;
  if (Array.isArray(v)) return v.length ? v.join(', ') : BLANK;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

/** Render a labeled section from [label, value] pairs as a markdown bullet list. */
export function renderPairs(pairs) {
  return pairs.map(([label, value]) => `- ${label}: ${field(value)}`).join('\n');
}

export function section(title, body) {
  return `## ${title}\n\n${body}\n`;
}

/** Map a numeric strength (1-10) or explicit label to the Cold/Warm/Trusted/Strategic scale. */
export function trustLabel(contact) {
  if (contact.trustLevelLabel) return contact.trustLevelLabel;
  const n = typeof contact.relationshipStrength === 'number' ? contact.relationshipStrength
    : (typeof contact.trustLevel === 'number' ? contact.trustLevel : null);
  if (n === null) return 'Cold';
  if (n <= 3) return 'Cold';
  if (n <= 6) return 'Warm';
  if (n <= 8) return 'Trusted';
  return 'Strategic';
}

/**
 * Render one conversation entry as an append-only dated block.
 * `kind` selects builder- vs landowner-flavored fields; unknown fields are omitted
 * (not blanked) so the log stays readable.
 */
export function renderConversation(entry, kind = 'builder') {
  const at = (entry.at || entry.date || '').slice(0, 10) || 'undated';
  const rows = [];
  const push = (label, val) => { if (val !== undefined && val !== null && val !== '') rows.push(`- ${label}: ${val}`); };
  push('Method', entry.method || entry.channel);
  push('Summary', entry.summary);
  push('Pain discovered', entry.painLearned || entry.pain);
  if (kind === 'landowner') {
    push('What they care about', entry.caresAbout);
    push('Price discussed', entry.priceDiscussed);
    push('Timing discussed', entry.timingDiscussed);
  } else {
    push('Opportunity discussed', entry.opportunity);
  }
  push('Objections', entry.objections);
  push('Personal details', entry.personal);
  push('Follow-up promised', entry.followUpPromised);
  push('Next action', entry.nextAction);
  push('Travis notes', entry.notes);
  if (!rows.length) rows.push('- Summary: (no details recorded)');
  return `### ${at} Conversation\n${rows.join('\n')}`;
}

/** Stable key for a conversation block, used to dedupe on merge. */
export function conversationKey(block) {
  const date = (block.match(/^###\s+(\S+)/) || [])[1] || '';
  const summary = (block.match(/- Summary:\s*(.{0,40})/) || [])[1] || '';
  return `${date}::${summary.trim().toLowerCase()}`;
}

/** Extract existing conversation blocks from a previously-written file (append-only safety). */
export function parseConversationBlocks(md) {
  if (!md) return [];
  const out = [];
  // Each block starts at "### <date> Conversation" and runs until the next ### or ## or EOF.
  const re = /^###\s+\S+\s+Conversation[\s\S]*?(?=^###\s|\n^##\s|$(?![\r\n]))/gm;
  let m;
  while ((m = re.exec(md)) !== null) out.push(m[0].trimEnd());
  return out;
}

/** Merge rendered + existing conversation blocks, dedupe by key, sort chronologically. */
export function mergeConversations(renderedBlocks, existingBlocks) {
  const byKey = new Map();
  for (const b of [...existingBlocks, ...renderedBlocks]) {
    byKey.set(conversationKey(b), b);
  }
  return [...byKey.values()].sort((a, b) => {
    const da = (a.match(/^###\s+(\S+)/) || [])[1] || '';
    const db = (b.match(/^###\s+(\S+)/) || [])[1] || '';
    return da.localeCompare(db);
  });
}

/** Final guard: a contact file must carry no banned/spam language. */
export function guardFile(md) {
  return assertCompliantLanguage(md, 'contact memory file');
}
