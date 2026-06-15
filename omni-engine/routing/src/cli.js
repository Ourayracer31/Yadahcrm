#!/usr/bin/env node
/**
 * CLI: route a saved operator result (+ optional board) to configured webhooks.
 *
 * Usage:
 *   node src/cli.js --operator op.json [--board board.json] --config cfg.json [--dry-run]
 *
 * cfg.json: { "endpoints": { "default": "https://n8n/webhook/omni", "highPriority": "...", "dealsToKill": "..." } }
 */

import { readFileSync } from 'node:fs';
import { routeToCrm } from './index.js';

function parseArgs(argv) {
  const a = { dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--operator') a.operator = argv[++i];
    else if (argv[i] === '--board') a.board = argv[++i];
    else if (argv[i] === '--config') a.config = argv[++i];
    else if (argv[i] === '--dry-run') a.dryRun = true;
  }
  return a;
}

const args = parseArgs(process.argv);
if (!args.operator) { console.error('Provide --operator <op.json>.'); process.exit(1); }

const operatorResult = JSON.parse(readFileSync(args.operator, 'utf8'));
const board = args.board ? JSON.parse(readFileSync(args.board, 'utf8')) : null;
const fileConfig = args.config ? JSON.parse(readFileSync(args.config, 'utf8')) : {};
const config = { ...fileConfig, dryRun: args.dryRun };

const { manifest, stats } = await routeToCrm({ operatorResult, board, config });
for (const m of manifest) console.log(`${m.status.toUpperCase().padEnd(7)} ${m.event} -> ${m.channel} (${m.endpoint || 'no-endpoint'})`);
console.log(`\n[routing] ${JSON.stringify(stats)}`);
