#!/usr/bin/env node
/**
 * omni-daily - the one-command daily runner.
 *
 * Runs the whole Omni-Engine for the day and drops Travis's board in his lap:
 *   1. load vector outputs (builders/lots/buyers) + relationship memory
 *   2. synthesis -> operator -> follow-up board  (runner/pipeline.js)
 *   3. write artifacts (war room, briefings, daily plan, board) to --out
 *   4. refresh per-contact memory files + /daily/travis-follow-up-board.md
 *   5. (optional) route events to n8n / CRM dashboards  (--route)
 *
 * Usage:
 *   node src/daily.js --config ../config/omni.config.example.json
 *   node src/daily.js --inputs ../samples --memory crm.json --out out --route
 *   node src/daily.js --config cfg.json --dry-run        # no webhooks sent
 *
 * Nothing here contacts a lead. Every output is advisory; Travis decides.
 */

import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadJson, loadInputs, loadMemory, writeArtifacts } from './io.js';
import { runDailyPipeline } from './pipeline.js';
import { renderWarRoom, renderBriefing } from '../../operator/src/index.js';
import { syncContactMemory } from '../../contact-memory/src/index.js';
import { routeToCrm } from '../../routing/src/index.js';

const __dir = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const a = { dryRun: false, route: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--config') a.config = argv[++i];
    else if (k === '--inputs') a.inputs = argv[++i];
    else if (k === '--memory') a.memory = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--root') a.root = argv[++i];
    else if (k === '--date') a.date = argv[++i];
    else if (k === '--route') a.route = true;
    else if (k === '--dry-run') a.dryRun = true;
  }
  return a;
}

const args = parseArgs(process.argv);

// Config file is the base; CLI flags override. Paths resolve relative to the
// config file's directory (or cwd when only flags are used).
const configPath = args.config ? resolve(process.cwd(), args.config) : null;
const baseDir = configPath ? dirname(configPath) : process.cwd();
const fileConfig = configPath ? (loadJson(configPath, {}) || {}) : {};

const config = {
  inputs: fileConfig.inputs || {},
  memory: args.memory || fileConfig.memory || null,
  out: args.out || fileConfig.out || 'out',
  root: args.root || fileConfig.root || '.',
  route: args.route || fileConfig.route || false,
  endpoints: fileConfig.endpoints || {},
  minComposite: fileConfig.minComposite ?? 0,
  dryRun: args.dryRun,
};

// If --inputs <dir> was given, derive the three file paths from it.
if (args.inputs) {
  const dir = isAbsolute(args.inputs) ? args.inputs : resolve(process.cwd(), args.inputs);
  config.inputs = { builders: `${dir}/builders.json`, lots: `${dir}/lots.json`, buyers: `${dir}/buyers.json` };
}

const date = args.date ? new Date(args.date) : new Date();
// out/root resolve relative to the config file's directory (or cwd when no config),
// matching how inputs/memory resolve, so all paths in a config are consistent.
const outDir = isAbsolute(config.out) ? config.out : resolve(baseDir, config.out);
const root = isAbsolute(config.root) ? config.root : resolve(baseDir, config.root);

// --- 1) load ---
const { builders, lots, buyers } = loadInputs(config, baseDir);
const memory = loadMemory(config, baseDir);
console.log(`[omni-daily] inputs: ${builders.length} builders, ${lots.length} lots, ${buyers.length} buyers · memory: ${memory.all().length} contacts`);

// --- 2) run pipeline ---
const { created, operatorResult, board } = runDailyPipeline({ builders, lots, buyers, memory, date });

// --- 3) write artifacts ---
const briefingsText = operatorResult.opportunities
  .filter((o) => o.dealEval.status !== 'kill' && !o.score.deprioritized)
  .map((o) => renderBriefing(o.briefing))
  .join('\n\n' + '='.repeat(72) + '\n\n');
const warRoomText = renderWarRoom(operatorResult.warRoom);

let routingManifest = null;

// --- 5) optional routing (declared here so it lands in the artifacts) ---
if (config.route) {
  const { manifest, stats } = await routeToCrm({
    operatorResult, board,
    config: { endpoints: config.endpoints, minComposite: config.minComposite, dryRun: config.dryRun },
  });
  routingManifest = { manifest, stats };
}

const files = writeArtifacts(outDir, {
  warRoomText,
  warRoom: operatorResult.warRoom,
  briefingsText,
  dailyPlan: operatorResult.dailyPlan,
  opportunities: operatorResult.opportunities,
  board,
  routingManifest,
});

// --- 4) refresh per-contact memory files + the daily board on disk ---
const sync = syncContactMemory({ operatorResult, memory, root, date });
memory.save();

// --- console summary ---
console.log('\n' + warRoomText);
console.log(`\n[omni-daily] stats: ${JSON.stringify(operatorResult.stats)}`);
console.log(`[omni-daily] artifacts -> ${outDir}`);
files.forEach((f) => console.log(`   - ${f}`));
console.log(`[omni-daily] contact files refreshed: ${sync.filesWritten.length}`);
console.log(`[omni-daily] follow-up board -> ${sync.boardPaths.path}`);
if (routingManifest) console.log(`[omni-daily] routing: ${JSON.stringify(routingManifest.stats)}${config.dryRun ? ' (dry-run)' : ''}`);
console.log('\n[omni-daily] Done. Nothing was sent to any lead — these are suggestions for Travis.');
