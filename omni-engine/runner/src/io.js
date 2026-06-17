/**
 * Filesystem IO for the daily runner: load vector inputs + config, build memory,
 * and write the day's artifacts to disk.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, isAbsolute, resolve } from 'node:path';
import { RelationshipMemory } from '../../contact-memory/src/index.js';

export function loadJson(path, fallback = null) {
  try {
    if (!path || !existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to read JSON ${path}: ${err.message}`);
  }
}

function resolveFrom(baseDir, p) {
  if (!p) return p;
  return isAbsolute(p) ? p : resolve(baseDir, p);
}

/** Load { builders, lots, buyers } from the paths in config.inputs (arrays default to []). */
export function loadInputs(config, baseDir = process.cwd()) {
  const inp = config.inputs || {};
  const builders = loadJson(resolveFrom(baseDir, inp.builders), []) || [];
  const lots = loadJson(resolveFrom(baseDir, inp.lots), []) || [];
  const buyers = loadJson(resolveFrom(baseDir, inp.buyers), []) || [];
  return { builders, lots, buyers };
}

/** Open (or create) the relationship-memory store. */
export function loadMemory(config, baseDir = process.cwd()) {
  const path = config.memory ? resolveFrom(baseDir, config.memory) : null;
  return new RelationshipMemory(path);
}

/** Write the day's artifacts to the out directory. Returns the list of files written. */
export function writeArtifacts(outDir, { warRoomText, warRoom, briefingsText, dailyPlan, opportunities, board, routingManifest }) {
  mkdirSync(outDir, { recursive: true });
  const files = [];
  const put = (name, content) => {
    const path = join(outDir, name);
    writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    files.push(path);
  };
  if (warRoomText != null) put('war-room.txt', warRoomText);
  if (warRoom != null) put('war-room.json', warRoom);
  if (briefingsText != null) put('briefings.txt', briefingsText);
  if (dailyPlan != null) put('daily-plan.json', dailyPlan);
  if (opportunities != null) put('opportunities.json', opportunities);
  if (board != null) { put('board.md', board.markdown); put('board.json', board.board); }
  if (routingManifest != null) put('routing-manifest.json', routingManifest);
  return files;
}

export { dirname };
