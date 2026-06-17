#!/usr/bin/env node
/**
 * CLI: build/refresh contact memory files + the daily follow-up board.
 *
 * Usage:
 *   node src/cli.js --memory crm.json [--opportunities opps.json] [--root .] [--date YYYY-MM-DD]
 *
 * crm.json is a RelationshipMemory export ({ contacts: [...] }); opps.json is the
 * operator layer's opportunities array (optional - enriches AI Recommendations).
 */

import { readFileSync } from 'node:fs';
import { RelationshipMemory, syncContactMemory } from './index.js';

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--memory') a.memory = argv[++i];
    else if (argv[i] === '--opportunities') a.opps = argv[++i];
    else if (argv[i] === '--root') a.root = argv[++i];
    else if (argv[i] === '--date') a.date = argv[++i];
  }
  return a;
}

const args = parseArgs(process.argv);
if (!args.memory) { console.error('Provide --memory <crm.json>.'); process.exit(1); }

const memory = new RelationshipMemory(args.memory);
const opportunities = args.opps ? JSON.parse(readFileSync(args.opps, 'utf8')) : [];
const date = args.date ? new Date(args.date) : new Date();

const result = syncContactMemory({
  operatorResult: { opportunities },
  memory,
  root: args.root || process.cwd(),
  date,
});

console.log(`Wrote ${result.filesWritten.length} contact file(s):`);
for (const f of result.filesWritten) console.log(`  - ${f.relPath}`);
console.log(`Wrote follow-up board: ${result.boardPaths.path}`);
