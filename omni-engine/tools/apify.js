#!/usr/bin/env node
/**
 * Apify integration — run the vector actors and pull their datasets straight into
 * the pipeline, using the Apify REST API and your APIFY_TOKEN. No Apify CLI and no
 * MCP required (though Apify's MCP works too); this is the code path the daemon
 * uses so ingestion is fully automatic once the token + actor ids are set.
 *
 * Env: APIFY_TOKEN (required for live calls).
 * Config: actor ids in .env (APIFY_VECTOR_A/B/C) or passed with --actor.
 *
 * Usage:
 *   node tools/apify.js --actor <username~actor> --input input.json --out samples/lots.json
 *   node tools/apify.js --dataset <datasetId> --out samples/lots.json
 */

import { readFileSync, writeFileSync } from 'node:fs';

const API = 'https://api.apify.com/v2';

/** Build the run-sync-get-dataset-items URL (runs an actor and returns its items). */
export function runSyncUrl(actorId, token) {
  const id = encodeURIComponent(actorId).replace(/%2F/gi, '~'); // username/actor -> username~actor
  return `${API}/acts/${id}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
}

/** Build the dataset-items URL for an already-completed run. */
export function datasetItemsUrl(datasetId, token) {
  return `${API}/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&token=${encodeURIComponent(token)}`;
}

/** Run an actor synchronously and return its dataset items. */
export async function runActorAndGetItems(actorId, input = {}, { token = process.env.APIFY_TOKEN, fetchImpl = fetch } = {}) {
  if (!token) throw new Error('APIFY_TOKEN is required (put it in .env).');
  const res = await fetchImpl(runSyncUrl(actorId, token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Apify run failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Fetch items from an existing dataset. */
export async function getDatasetItems(datasetId, { token = process.env.APIFY_TOKEN, fetchImpl = fetch } = {}) {
  if (!token) throw new Error('APIFY_TOKEN is required (put it in .env).');
  const res = await fetchImpl(datasetItemsUrl(datasetId, token));
  if (!res.ok) throw new Error(`Apify dataset fetch failed: HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const args = process.argv.slice(2);
  const opt = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--actor') opt.actor = args[++i];
    else if (args[i] === '--dataset') opt.dataset = args[++i];
    else if (args[i] === '--input') opt.input = args[++i];
    else if (args[i] === '--out') opt.out = args[++i];
  }
  if (!opt.out) { console.error('Provide --out <file>. And one of --actor <id> [--input file] or --dataset <id>.'); process.exit(1); }

  let items;
  if (opt.actor) {
    const input = opt.input ? JSON.parse(readFileSync(opt.input, 'utf8')) : {};
    console.log(`Running Apify actor ${opt.actor}…`);
    items = await runActorAndGetItems(opt.actor, input);
  } else if (opt.dataset) {
    console.log(`Fetching Apify dataset ${opt.dataset}…`);
    items = await getDatasetItems(opt.dataset);
  } else {
    console.error('Need --actor or --dataset.'); process.exit(1);
  }

  writeFileSync(opt.out, JSON.stringify(items, null, 2));
  console.log(`Wrote ${Array.isArray(items) ? items.length : '?'} items -> ${opt.out}`);
}

if (process.argv[1] && process.argv[1].endsWith('apify.js')) {
  main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
}
