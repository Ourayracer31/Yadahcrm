# Opportunity Synthesis Engine

> **The system must never assume opportunities are discovered. The objective is to
> CREATE opportunities through the intelligent combination of People, Timing,
> Capital and Land.**

The matching engine does pairwise *discovery* (a builder that fits a lot). This
module does **creation**: it constructs multi-party, de-risked opportunities that
none of the parties initiated, by combining the four primitives. Every output is
explicitly `origin: "synthesized"`, `discovered: false` — and `assertCreated()`
throws on anything that claims to be merely found.

```
Vector A/B/C  ─▶  [ synthesis/ ]  ─▶  operator/  ─▶  contracts/ + n8n/CRM
                   creates opportunities      prepares them for Travis
```

## The four primitives (`primitives.js`)

| Primitive | Source | Scored by |
|-----------|--------|-----------|
| **People** | builders (A), landowners (B owners), investors (C) | `peopleFit` — is there a real need, and do the parties fit (geo/product)? |
| **Timing** | pain windows + hold patterns | `timingAlignment` — a **patient** seller (absentee/long-hold/idle) bridged to an **urgent** builder via the option clock |
| **Capital** | BTR buyers (C) as exit; builder capacity | `capitalReadiness` — is funding/exit ready, or theoretical? |
| **Land** | lots (B) | `landViability` — light buildability pre-screen (operator does the deep field check) |

The option contract is the **timing instrument**: it lets a patient landowner and
an urgent builder line up on different clocks, with capital behind the exit.

## Creation patterns (`synthesize.js`)

| Pattern | Combination | Result |
|---------|-------------|--------|
| **Created Chain** (flagship) | Land + Builder + Capital | Option idle land → assign to a needy builder → BTR buyer pre-commits the exit. `$10k assignment + $5k/door`. |
| **Margin Squeeze** | Land + Builder | Bridge idle R-3 dirt to a pipeline-drought builder for a duplex. `$10k`. |
| **Liquidity Bailout** | Builder + Capital | Connect aging specs to BTR capital before retail discounting. `$5k/door`. |
| **Pipeline Drought** | Land (tract) + Heavy hitter | Option a patiently-held 15+ ac tract for a developer. Five-figure. |
| **Capital Preservation** | Land (premium) + Capital-shy builder | 120-day option, build-to-suit, paid at retail closing. |

Each created opportunity carries:
- **`creationThesis`** — the narrative of the path being made, not found.
- **`creationConditions`** — what must be made true to bring it into being.
- **`catalyst`** — the single move Travis makes (usually: option the land first).
- **`synthesisScore`** — weighted 1–10 alignment of the four primitives.

Outputs are shaped to drop straight into `operator/runOperatorLayer({ matches })`,
so a *created* opportunity is prepared (scored, field-checked, briefed) exactly
like any other — but it was never just "discovered."

## Usage

```js
import { runSynthesis } from './src/index.js';
import { runOperatorLayer, renderWarRoom } from '../operator/src/index.js';

const created = runSynthesis({ builders, lots, buyers });   // CREATE, don't find
const { opportunities, warRoom } = runOperatorLayer({ matches: created });
console.log(renderWarRoom(warRoom));
```

```bash
npm test   # 24 passing
```
