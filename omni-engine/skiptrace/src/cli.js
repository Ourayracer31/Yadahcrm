#!/usr/bin/env node
/**
 * Skip-trace a leads file (owner -> phone/email) and optionally file the results
 * into landowner relationship memory.
 *
 * Usage:
 *   node src/cli.js --in samples/lots.json --out samples/lots.json
 *   node src/cli.js --in samples/lots.json --out samples/lots.json --memory crm.json --root .
 *
 * Provider via env: SKIPTRACE_URL + SKIPTRACE_API_KEY (+ optional *_PATH overrides).
 * Without a provider it runs and reports 0 enriched (no hard failure).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { providerFromEnv, TraceCache } from './skiptrace.js';
import { enrichLeads, syncEnrichedToMemory } from './enrich.js';

function parseArgs(argv) {
  const a = { cache: '.cache/skiptrace.json' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--in') a.in = argv[++i];
    else if (argv[i] === '--out') a.out = argv[++i];
    else if (argv[i] === '--cache') a.cache = argv[++i];
    else if (argv[i] === '--memory') a.memory = argv[++i];
    else if (argv[i] === '--root') a.root = argv[++i];
  }
  return a;
}

const args = parseArgs(process.argv);
if (!args.in || !args.out) { console.error('Required: --in <leads.json> --out <leads.json>'); process.exit(1); }

const provider = providerFromEnv();
if (!provider) console.warn('No skip-trace provider configured (SKIPTRACE_URL + SKIPTRACE_API_KEY). Running in no-op mode.');

const leads = JSON.parse(readFileSync(args.in, 'utf8'));
const cache = new TraceCache(args.cache);

let traced = 0;
const enriched = await enrichLeads(leads, {
  provider, cache,
  onTrace: (lead, r) => { if (!r.skipped && ((r.phones || []).length || (r.emails || []).length)) traced += 1; },
});
cache.save();
writeFileSync(args.out, JSON.stringify(enriched, null, 2));
console.log(`Skip-traced ${enriched.length} leads → ${traced} with contact info. Wrote ${args.out}.`);

if (args.memory) {
  const { filesWritten, withContact } = syncEnrichedToMemory(enriched, { memoryPath: args.memory, root: args.root || process.cwd() });
  console.log(`Filed ${filesWritten.length} landowner contact files (${withContact} with phone/email).`);
}
