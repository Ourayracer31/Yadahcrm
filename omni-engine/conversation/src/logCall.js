#!/usr/bin/env node
/**
 * Log a conversation into the robot's memory.
 *
 * Give it a contact and either typed notes, a notes file, or an audio recording.
 * It transcribes (audio), summarizes into structured fields (Claude or the
 * offline heuristic), appends an append-only conversation entry to the contact's
 * memory file, sets the next follow-up, and (optionally) saves the raw transcript
 * to a git-ignored sidecar.
 *
 * Usage:
 *   node src/logCall.js --contact "Squeezed Homes LLC" --type builder --text "..."
 *   node src/logCall.js --contact "Jane Heir" --type landowner --file notes.txt
 *   node src/logCall.js --contact "Squeezed Homes LLC" --audio call.m4a --save-transcript
 *   node src/logCall.js ... --heuristic        # force offline summarizer
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RelationshipMemory, blankRichContact, ContactFileStore } from '../../contact-memory/src/index.js';
import { scrubLanguage } from '../../operator/src/language.js';
import { summarizeConversation } from './summarize.js';
import { transcribeAudio } from './transcribe.js';

function slug(s) {
  return String(s || 'contact').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/**
 * Core (testable): summarize a transcript and write it into memory + the contact file.
 * @returns {{ fields, engine, relPath, nextFollowUp, transcriptPath }}
 */
export async function logConversation({
  contactName, type = 'builder', transcript, method = 'call',
  root = process.cwd(), memoryPath = null, now = new Date(),
  heuristic = false, saveTranscript = false, onFallback,
}) {
  if (!contactName) throw new Error('contactName is required.');
  if (!transcript || !transcript.trim()) throw new Error('Nothing to log: provide --text, --file, or --audio.');

  const { fields, engine } = await summarizeConversation(transcript, { contactName, kind: type, now, heuristic, onFallback });

  // Keep the stored record in trust-first language (the contact file is guarded).
  const clean = {};
  for (const [k, v] of Object.entries(fields)) clean[k] = k === 'nextFollowUpDate' ? v : scrubLanguage(v).clean;

  const memory = new RelationshipMemory(memoryPath);
  memory.upsert({ name: contactName, type });
  const contact = memory.recordInteraction(contactName, {
    date: now.toISOString(),
    channel: method,
    summary: clean.summary,
    painLearned: clean.painLearned,
    nextFollowUp: clean.nextFollowUpDate || undefined,
  });
  // Enrich the just-appended entry with the rest of the extracted fields.
  const entry = contact.interactions[contact.interactions.length - 1];
  Object.assign(entry, {
    method,
    opportunity: clean.opportunity,
    objections: clean.objections,
    personal: clean.personal,
    followUpPromised: clean.followUpPromised,
    nextAction: clean.nextAction,
  });
  memory.save();

  // Render/refresh the contact's memory file (append-only history preserved).
  const rich = blankRichContact(contact);
  rich.interactions = contact.interactions;
  const { relPath } = new ContactFileStore(root).write(rich);

  // Optional raw-transcript sidecar (git-ignored; may contain verbatim PII).
  let transcriptPath = null;
  if (saveTranscript) {
    transcriptPath = join(root, 'transcripts', `${slug(contactName)}-${now.toISOString().slice(0, 10)}.txt`);
    await mkdir(dirname(transcriptPath), { recursive: true });
    await writeFile(transcriptPath, transcript);
  }

  return { fields: clean, engine, relPath, nextFollowUp: clean.nextFollowUpDate || null, transcriptPath };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = { type: 'builder', method: 'call', heuristic: false, saveTranscript: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--contact') a.contact = argv[++i];
    else if (k === '--type') a.type = argv[++i];
    else if (k === '--text') a.text = argv[++i];
    else if (k === '--file') a.file = argv[++i];
    else if (k === '--audio') a.audio = argv[++i];
    else if (k === '--method') a.method = argv[++i];
    else if (k === '--root') a.root = argv[++i];
    else if (k === '--memory') a.memory = argv[++i];
    else if (k === '--heuristic') a.heuristic = true;
    else if (k === '--save-transcript') a.saveTranscript = true;
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.contact) { console.error('Required: --contact "<name>". Add --text/--file/--audio.'); process.exit(1); }

  let transcript = args.text || '';
  if (!transcript && args.file) transcript = await readFile(args.file, 'utf8');
  if (!transcript && args.audio) {
    process.stdout.write('Transcribing audio… ');
    transcript = await transcribeAudio(args.audio);
    console.log('done.');
  }
  if (!transcript) { console.error('Nothing to log: provide --text, --file, or --audio.'); process.exit(1); }

  const result = await logConversation({
    contactName: args.contact,
    type: args.type,
    method: args.method,
    transcript,
    root: args.root || process.cwd(),
    memoryPath: args.memory || join(args.root || process.cwd(), 'crm.json'),
    heuristic: args.heuristic,
    saveTranscript: args.saveTranscript,
    onFallback: (err) => console.warn(`(Claude summarizer unavailable: ${err.message} — used offline heuristic.)`),
  });

  console.log(`\nLogged conversation with ${args.contact} [${result.engine}]`);
  console.log(`  Summary:      ${result.fields.summary}`);
  if (result.fields.painLearned) console.log(`  Pain:         ${result.fields.painLearned}`);
  if (result.fields.nextAction) console.log(`  Next action:  ${result.fields.nextAction}`);
  console.log(`  Follow-up:    ${result.nextFollowUp || '(none set)'}`);
  console.log(`  Memory file:  ${result.relPath}`);
  if (result.transcriptPath) console.log(`  Transcript:   ${result.transcriptPath}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
}
