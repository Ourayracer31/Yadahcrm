#!/usr/bin/env node
/**
 * CLI: generate a deal packet (Option + Assignment) to disk as Markdown + HTML.
 *
 * Usage:
 *   node src/cli.js --deal deal.json --out ./out
 *   echo '{...}' | node src/cli.js --out ./out
 *
 * `deal.json` shape: { seller, assignee, property, netToSeller, finderFee, play, optionDays }
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateDealPacket } from './index.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--deal') args.deal = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  return args;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const args = parseArgs(process.argv);
const outDir = args.out || './out';

let dealJson;
if (args.deal) dealJson = readFileSync(args.deal, 'utf8');
else if (!process.stdin.isTTY) dealJson = await readStdin();
else {
  console.error('No deal provided. Use --deal <file.json> or pipe JSON to stdin.');
  process.exit(1);
}

const deal = JSON.parse(dealJson);
const packet = generateDealPacket(deal);

mkdirSync(outDir, { recursive: true });
const slug = (deal.property?.parcelId || deal.property?.address || 'deal')
  .toString().replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60);

writeFileSync(join(outDir, `option-${slug}.md`), packet.option.markdown);
writeFileSync(join(outDir, `option-${slug}.html`), packet.option.html);
writeFileSync(join(outDir, `assignment-${slug}.md`), packet.assignment.markdown);
writeFileSync(join(outDir, `assignment-${slug}.html`), packet.assignment.html);

console.log(`Wrote 4 files to ${outDir} for ${slug}`);
