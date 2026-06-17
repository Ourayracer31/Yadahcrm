#!/usr/bin/env node
/**
 * Omni-Engine daemon — runs the whole chain on a schedule so the board just
 * refreshes itself. Set it running once and walk away.
 *
 *   node tools/daemon.js                 # every morning at 6:00 local
 *   node tools/daemon.js --at 05:30      # custom daily time
 *   node tools/daemon.js --every 6h      # or a fixed interval
 *
 * On a server, run it under pm2/systemd/`nohup ... &` so it survives logout.
 * (On Apify, schedule the actors instead — see APIFY.md.)
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const a = { at: '06:00' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--at') a.at = argv[++i];
    else if (argv[i] === '--every') a.every = argv[++i];
  }
  return a;
}

function intervalMs(spec) {
  const m = String(spec).match(/^(\d+)\s*(m|h|d)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n * { m: 60000, h: 3600000, d: 86400000 }[m[2].toLowerCase()];
}

function msUntilDailyTime(hhmm, now = new Date()) {
  const [h, min] = hhmm.split(':').map(Number);
  const next = new Date(now);
  next.setHours(h, min || 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

function runChain() {
  return new Promise((resolve) => {
    const ts = new Date().toISOString();
    console.log(`\n[daemon ${ts}] launching run-all…`);
    const child = spawn('bash', [join(ROOT, 'tools', 'run-all.sh')], { cwd: ROOT, stdio: 'inherit' });
    child.on('exit', (code) => { console.log(`[daemon] run-all exited ${code}`); resolve(code); });
    child.on('error', (err) => { console.error(`[daemon] failed to launch: ${err.message}`); resolve(1); });
  });
}

const args = parseArgs(process.argv);
const every = args.every ? intervalMs(args.every) : null;

console.log(`Omni-Engine daemon started. ${every ? `Running every ${args.every}.` : `Running daily at ${args.at}.`}`);
console.log('Leave this running (or use pm2/systemd). Ctrl-C to stop.\n');

async function loop() {
  await runChain();
  const wait = every || msUntilDailyTime(args.at);
  const when = new Date(Date.now() + wait);
  console.log(`[daemon] next run ${when.toLocaleString()}`);
  setTimeout(loop, wait);
}

// Run immediately on start, then on the schedule.
loop();
