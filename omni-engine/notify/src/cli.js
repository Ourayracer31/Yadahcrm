#!/usr/bin/env node
/**
 * Push the morning digest to your phone from a generated board file.
 *
 * Usage:
 *   node src/cli.js --board out/board.json            # channel from NOTIFY_CHANNEL env
 *   node src/cli.js --board out/board.json --channel telegram
 *
 * Env: NOTIFY_CHANNEL=telegram|slack|webhook|console
 *      TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID | SLACK_WEBHOOK_URL | NOTIFY_WEBHOOK_URL
 */

import { readFileSync } from 'node:fs';
import { sendDigest, channelFromEnv } from './notify.js';

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--board') a.board = argv[++i];
    else if (argv[i] === '--channel') a.channel = argv[++i];
  }
  return a;
}

const args = parseArgs(process.argv);
if (!args.board) { console.error('Required: --board <board.json> (the daily writes out/board.json).'); process.exit(1); }

const board = JSON.parse(readFileSync(args.board, 'utf8'));
const env = channelFromEnv();
const channel = args.channel || env.channel;

try {
  const r = await sendDigest(board, { channel, config: env.config });
  console.log(r.sent ? `Digest sent via ${r.channel} (HTTP ${r.status}).` : 'Digest printed (set NOTIFY_CHANNEL to push to your phone).');
} catch (err) {
  console.error(`Notify failed: ${err.message}`);
  process.exit(1);
}
