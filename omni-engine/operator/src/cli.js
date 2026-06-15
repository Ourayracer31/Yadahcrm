#!/usr/bin/env node
/**
 * CLI for the Operator Intelligence Layer.
 *
 * Feed it the matching engine's output (and optionally a relationship-memory
 * file) and it prints the War Room + writes briefings/daily plan to disk.
 *
 * Usage:
 *   node src/cli.js --matches matches.json [--memory memory.json] [--out ./out]
 *   cat matches.json | node src/cli.js --out ./out
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runOperatorLayer, renderWarRoom, renderBriefing, RelationshipMemory } from './index.js';

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--matches') a.matches = argv[++i];
    else if (argv[i] === '--memory') a.memory = argv[++i];
    else if (argv[i] === '--out') a.out = argv[++i];
    else if (argv[i] === '--date') a.date = argv[++i];
  }
  return a;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const args = parseArgs(process.argv);
const outDir = args.out || './out';
const date = args.date ? new Date(args.date) : new Date();

let matchesJson;
if (args.matches) matchesJson = readFileSync(args.matches, 'utf8');
else if (!process.stdin.isTTY) matchesJson = await readStdin();
else { console.error('Provide --matches <file.json> or pipe JSON to stdin.'); process.exit(1); }

const matches = JSON.parse(matchesJson);
const memory = args.memory ? new RelationshipMemory(args.memory) : null;

const result = runOperatorLayer({ matches, memory, date });

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'war-room.json'), JSON.stringify(result.warRoom, null, 2));
writeFileSync(join(outDir, 'daily-plan.json'), JSON.stringify(result.dailyPlan, null, 2));
writeFileSync(join(outDir, 'opportunities.json'), JSON.stringify(result.opportunities, null, 2));

const briefs = result.opportunities
  .filter((o) => o.dealEval.status !== 'kill' && !o.score.deprioritized)
  .map((o) => renderBriefing(o.briefing))
  .join('\n\n' + '='.repeat(72) + '\n\n');
writeFileSync(join(outDir, 'briefings.txt'), briefs);

console.log(renderWarRoom(result.warRoom));
console.log(`\n[stats] ${JSON.stringify(result.stats)}`);
console.log(`[written] war-room.json, daily-plan.json, opportunities.json, briefings.txt -> ${outDir}`);
