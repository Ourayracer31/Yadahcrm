/**
 * The daily pipeline - one pure function that runs the whole Omni-Engine:
 *
 *   vectors' output (builders, lots, buyers)
 *     -> synthesis (CREATE opportunities: People x Timing x Capital x Land)
 *     -> operator  (score, field-check, kill/keep, brief, script)
 *     -> contact-memory follow-up board
 *
 * Pure (no filesystem / network) so it is unit-testable; the CLI in daily.js
 * handles IO and optional webhook routing around it.
 */

import { runSynthesis } from '../../synthesis/src/index.js';
import { runOperatorLayer } from '../../operator/src/index.js';
import { generateFollowUpBoard } from '../../contact-memory/src/index.js';

/**
 * @param {object} p
 * @param {Array} p.builders Vector A output
 * @param {Array} p.lots     Vector B output
 * @param {Array} p.buyers   Vector C output
 * @param {RelationshipMemory} [p.memory]
 * @param {Date}  [p.date]
 * @returns {{ created, operatorResult, board }}
 */
export function runDailyPipeline({ builders = [], lots = [], buyers = [], memory = null, date = new Date() } = {}) {
  const created = runSynthesis({ builders, lots, buyers });
  const operatorResult = runOperatorLayer({ matches: created, memory, date });
  const board = generateFollowUpBoard({ opportunities: operatorResult.opportunities, memory, date });
  return { created, operatorResult, board };
}
