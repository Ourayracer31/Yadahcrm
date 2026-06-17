# Operator Intelligence Layer

> **AI finds the conversations worth having. Travis creates the opportunity.**

The Omni-Engine is **not** a replacement for Travis Manley — it is a
reconnaissance, filtering, and preparation system for a 32-year field-bred
construction operator. This module is the layer **every other module routes
through**: it takes the raw output of the three vectors and the matching engine
and turns each match into a scored, field-checked, killed-or-kept, fully briefed
opportunity — then builds the Daily War Room and the 30-Contact OS on top.

```
Vector A/B/C  ─▶  matching/  ─▶  [ operator/ ]  ─▶  contracts/ + n8n/CRM
                                  ▲ you are here
```

Nothing here auto-sends. Every artifact is **advisory** — the AI recommends, only
Travis decides.

## The 10 modules

| # | Module | File | What it does |
|---|--------|------|--------------|
| 1 | Operator Briefing Pack | `briefing.js` | One-page, 10-section brief per contact (identity, pain, angle, **what NOT to say**, deal path, confidence, next action). |
| 2 | Reverse Selling Scripts | `scripts.js` | Openers in the 5-beat structure: observation → humility → field question → no pressure → let them reveal pain. |
| 3 | Pain-First Scoring | `scoring.js` | Seven 1–10 scores; **Operator Fit < 7 ⇒ deprioritize**, no matter the spread. |
| 4 | Field Reality Check | `fieldReality.js` | Flags sewer/access/flood/detention/grade/shape/zoning-friction/comps/price/density. Unknown ⇒ "verify," never "assumed good." |
| 5 | Relationship Memory | `memory.js` | Persistent CRM memory (builders, landowners, investors, engineers, title, developers); drives intelligent follow-up. |
| 6 | Daily War Room | `warRoom.js` | Morning Opportunity Board: top stress signals, matches, follow-ups, the one call to make first, and **"Do not chase this."** |
| 7 | Deal Killer Logic | `dealKiller.js` | Kills/downgrades on retail-plus pricing, no pain, no utilities, long timeline, thin margins, no authority, paper-only, legal risk — each with a reason. |
| 8 | Trust-First Language | `language.js` | Central guard. Bans the wholesaler/hype vocabulary; suggests credible language. The whole system defers to this. |
| 9 | Human Final Decision | `decision.js` | Wraps every recommendation as "Suggested for Travis"; the only path out of "awaiting-travis" is `applyDecision`. |
| 10 | 30-Contact Daily OS | `dailyOps.js` | 10 builders / 10 landowners / 5 investors / 5 follow-ups, each with 7 prep fields; full activity-funnel KPI tracker. |

`index.js` (`runOperatorLayer`) orchestrates all ten; `cli.js` runs it from disk.

## Usage

```js
import { runMatches } from '../matching/src/match.js';
import { runOperatorLayer, renderWarRoom, RelationshipMemory } from './src/index.js';

const matches = runMatches({ builders, lots, buyers });   // from the vectors
const memory  = new RelationshipMemory('./crm.json');     // persistent
const { opportunities, warRoom, dailyPlan, stats } = runOperatorLayer({ matches, memory });

console.log(renderWarRoom(warRoom));
```

CLI:

```bash
node src/cli.js --matches matches.json --memory crm.json --out ./out
# writes war-room.json, daily-plan.json, opportunities.json, briefings.txt
```

End-to-end demo (vectors → matching → operator → contracts):

```bash
npm run demo
npm test     # 53 passing
```

## Scoring model (pain-first)

Two kinds of **addressable builder pain** are recognized, matching the plays:
- **Inventory choke** — stale specs + price drops → *Liquidity Bailout*.
- **Pipeline drought** — fast absorption / low spec exposure, hungry for dirt →
  *Margin Squeeze / Capital Preservation / Pipeline Drought*.

Composite weighting puts builder pain, operator fit and feasibility ahead of raw
profit. **Operator Fit gates everything** — if it's not the kind of problem
Travis can uniquely solve, it's deprioritized regardless of dollar size.

## Guardrails baked into code

- **No auto-send** (Module 9): `assertNoAutoSend` throws; only `applyDecision` advances a recommendation.
- **Trust-first language** (Module 8): `assertCompliantLanguage` throws on banned terms across every rendered surface.
- **Honest field reads** (Module 4): missing data ⇒ "verify," never assumed buildable.
- **Time protection** (Module 7): every kill carries a plain-language reason.
