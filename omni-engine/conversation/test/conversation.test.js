/**
 * Offline tests for the conversation logger. No network, no API key - exercises
 * the heuristic summarizer and the memory/file write. Run: node test/conversation.test.js
 */
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractHeuristic, parseFollowUpDate, summarizeConversation } from '../src/summarize.js';
import { logConversation } from '../src/logCall.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const NOW = new Date('2026-06-16T12:00:00Z');
const root = mkdtempSync(join(tmpdir(), 'omni-conv-'));

// === date parsing ===
ok(parseFollowUpDate('call me next week', NOW) === '2026-06-23', 'next week = +7 days');
ok(parseFollowUpDate('follow up tomorrow', NOW) === '2026-06-17', 'tomorrow = +1');
ok(parseFollowUpDate('check back in 2 weeks', NOW) === '2026-06-30', 'in 2 weeks = +14');
ok(parseFollowUpDate('reach out in 3 days', NOW) === '2026-06-19', 'in 3 days');
ok(parseFollowUpDate('let us talk next month', NOW) === '2026-07-16', 'next month');
ok(parseFollowUpDate('meeting on 2026-07-01', NOW) === '2026-07-01', 'explicit ISO date');
ok(parseFollowUpDate('call 7/4', NOW) === '2026-07-04', 'M/D date');
ok(parseFollowUpDate('no date mentioned here', NOW) === '', 'no date -> empty');

// === heuristic extraction ===
const transcript = 'Talked to the builder about his east side specs. He has three specs sitting over 70 days and is short on finished lots. He was hesitant about price but interested in an R-3 infill lot. I will send him a parcel. Follow up next week.';
const h = extractHeuristic(transcript, { now: NOW });
ok(h.summary.length > 0 && /east side specs/i.test(h.summary), 'summary captured');
ok(/sitting|short on/i.test(h.painLearned), 'pain captured: ' + h.painLearned);
ok(/infill|lot|parcel/i.test(h.opportunity), 'opportunity captured');
ok(/hesitant|price/i.test(h.objections), 'objection captured');
ok(/send|follow up/i.test(h.nextAction), 'next action captured');
ok(h.nextFollowUpDate === '2026-06-23', 'follow-up date parsed from "next week"');

// === summarizeConversation picks heuristic with no key ===
delete process.env.ANTHROPIC_API_KEY;
const sc = await summarizeConversation(transcript, { now: NOW });
ok(sc.engine === 'heuristic', 'no key -> heuristic engine');
ok(sc.fields.summary === h.summary, 'heuristic fields consistent');

// === logConversation writes memory + contact file (append-only) ===
const memoryPath = join(root, 'crm.json');
const r1 = await logConversation({
  contactName: 'Squeezed Homes LLC', type: 'builder', transcript, root, memoryPath, now: NOW, heuristic: true, saveTranscript: true,
});
ok(r1.engine === 'heuristic', 'logConversation used heuristic');
ok(r1.relPath === 'contacts/builders-developers/squeezed-homes-llc.md', 'filed under builders-developers: ' + r1.relPath);
ok(existsSync(join(root, r1.relPath)), 'memory file written');
ok(r1.nextFollowUp === '2026-06-23', 'follow-up set on the contact');
ok(existsSync(r1.transcriptPath), 'raw transcript sidecar written');
const md1 = readFileSync(join(root, r1.relPath), 'utf8');
ok(/## Conversation History/.test(md1) && /Pain discovered/.test(md1), 'conversation rendered into file');
ok(/2026-06-16 Conversation/.test(md1), 'dated conversation block present');

// second call appends, does not overwrite
const r2 = await logConversation({
  contactName: 'Squeezed Homes LLC', type: 'builder',
  transcript: 'Second call. He liked the parcel and wants to move. Call back in 3 days.',
  root, memoryPath, now: new Date('2026-06-18T12:00:00Z'), heuristic: true,
});
const md2 = readFileSync(join(root, r2.relPath), 'utf8');
ok((md2.match(/Conversation\n/g) || []).length >= 2 || (md2.match(/\d{4}-\d{2}-\d{2} Conversation/g) || []).length === 2, 'two conversation blocks (append-only)');
ok(r2.nextFollowUp === '2026-06-21', 'second follow-up recomputed');

// === language guard: banned terms in notes are scrubbed, file still writes ===
const r3 = await logConversation({
  contactName: 'Test Seller', type: 'landowner',
  transcript: 'He seems like a motivated seller and asked if we are wholesalers.',
  root, memoryPath: join(root, 'crm2.json'), now: NOW, heuristic: true,
});
const md3 = readFileSync(join(root, r3.relPath), 'utf8');
ok(!/wholesaler/i.test(md3) && !/motivated seller/i.test(md3), 'banned terms scrubbed from stored note');

console.log(`\nCONVERSATION TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
