# The Omni-Engine

An automated, multi-vector real estate **matchmaking / data-broker** system for
the Kansas City / Midwest region, operated by Manley Systems LLC under an
**"Honest Broker"** posture: aggregate **public** records only, disclose role
fully, buy and **assign Option Contracts** (never "wholesale"), no spam, no
private-system access, no writes to county systems.

## Pipeline

```
  PUBLIC RECORDS              INGESTION (Apify actors)      CREATION      ROUTING       OPERATOR LAYER     OUTPUT
  ─────────────               ────────────────────────      ────────      ───────       ──────────────     ──────
  county permits ─────────▶  Vector A Builder Health ─┐
  county tax/GIS/zoning ──▶  Vector B The Dirt Sweep ─┼─▶ synthesis/ ─(or)─ matching/ ─▶ operator/ ─▶ contracts/ ─▶ n8n/CRM
  assessor/recorder ──────▶  Vector C Capital Sweep ──┘   creates       4 Plays      briefings,        Option +     (webhook)
                                                          opportunities  (pairwise)   scoring, field-   Assignment
                                                          (People x                   check, war room,
                                                           Timing x                   deal-killer,
                                                           Capital x                  scripts, memory,
                                                           Land)                      30-contact OS
```

> **Opportunities are created, not discovered.** `synthesis/` combines People ×
> Timing × Capital × Land into multi-party, de-risked opportunities none of the
> parties initiated (the flagship being the Land+Builder+Capital chain). The
> **Operator Intelligence Layer (`operator/`) is the spine** every opportunity
> then routes through — turning each creation into field-ready, scored,
> human-decided intelligence for Travis Manley. *AI finds the conversations worth
> having; Travis creates the opportunity.*

## Modules

| Path | What it does | Tests |
|------|--------------|-------|
| `vector-a-builder-health/` | Mid-market builders (5–50 permits/yr), spec DOM & price drops → Choked vs Selling-out | logic verified |
| `vector-b-dirt-sweep/` | Multi-family/infill lots (R-2.5/R-3/R-4…) + 10–40 ac tracts; out-of-state, vacant, equity proxy | 16 passing |
| `vector-c-capital-sweep/` | BTR buyer list: LLCs buying 5+ SFH / 24 mo | logic verified |
| `synthesis/` | **Opportunity Synthesis Engine** — creates opportunities by combining People × Timing × Capital × Land; never assumes discovery | 24 passing |
| `matching/` | Routes A/B/C leads into the 4 Plays with disclosed fee math (pairwise discovery) | 14 passing |
| `operator/` | **Operator Intelligence Layer** — briefings, pain-first scoring, field-reality, deal-killer, reverse-selling scripts, relationship memory, daily war room, 30-contact OS; trust-first language + human-final-decision | 53 passing |
| `contact-memory/` | **Relationship Intelligence System** — permanent per-contact markdown files (`/contacts/**`), append-only history, builder/landowner/investor/partner templates, daily follow-up board, Field Reality Rule | 32 passing |
| `contracts/` | Option to Purchase + Assignment & Finder's Fee; "no Wholesale" guard | 18 passing |
| `routing/` | **n8n / webhook routing layer** — pushes operator output + daily board to CRM dashboards; internal-only (never auto-contacts a lead) | 19 passing |
| `runner/` | **One-command daily runner** — chains vectors → synthesis → operator → board → routing; writes all artifacts (`npm run daily`) | 12 passing |

## The four Plays (matching engine)

| Play | Trigger | Action | Fee |
|------|---------|--------|-----|
| **Margin Squeeze** | builder needs affordable inventory | option R-3 infill lot, assign for duplex | $10k flat |
| **Liquidity Bailout** | builder has 60+ day specs | route dead specs to Vector C BTR buyers | $5k / door |
| **Capital Preservation** | builder won't risk cash on dirt | 120-day option, build-to-suit | paid at retail closing |
| **Pipeline Drought** | heavy hitter needs subdivision space | option 15+ ac tract, assign | five-figure |

## Quick start — the one-command daily runner

```bash
cd omni-engine
npm run daily        # runs the full pipeline on bundled sample data
npm test             # 175 tests across all modules
```

`runner/` chains it all: **vectors' output → synthesis → operator →
contact-memory board → (optional) n8n routing**, writing the War Room,
briefings, 30-contact plan, and `daily/travis-follow-up-board.md`. See
[`USAGE.md`](./USAGE.md) for the full daily operating guide and
[`runner/README.md`](./runner/README.md) for flags/config.

## Run the whole chain locally

```bash
# 1) Ingest (each is an Apify actor; run on platform or locally with an INPUT.json)
cd vector-b-dirt-sweep && npm install && npm run start:dev

# 2) Match (pure Node, no install)
node -e "import('./matching/src/match.js').then(async m => {
  const { default: fs } = await import('node:fs');
  // feed it arrays from the vector dataset exports…
});"
node matching/test/match.test.js      # 14 passing
node contracts/test/contracts.test.js # 18 passing

# 3) Generate a deal packet
echo '{ "seller":{"name":"Jane"}, "assignee":{"name":"Acme Build LLC"},
        "property":{"address":"123 Vine","parcelId":"INFILL1"},
        "netToSeller":60000, "finderFee":10000, "play":"Margin Squeeze" }' \
  | node contracts/src/cli.js --out ./out
```

## Compliance guardrails (enforced in code)

- **No "Wholesale":** `contracts/src/shared.js` throws if any generated document
  contains the prohibited term family.
- **Real option consideration:** clamped to $50–$100.
- **Role disclosure:** every instrument states Manley Systems LLC is a Procurement
  Finder, not a licensed agent.
- **Honest enrichment:** `equityProxy` and zoning matches are labeled screening
  signals, not valuations or legal conclusions.
- **Verify before production:** every county endpoint + field name is input-driven
  and must be confirmed against the live service directory.
