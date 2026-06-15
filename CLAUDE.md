# CLAUDE.md — Manley Systems / YadahCRM workspace

Guidance for AI agents working in this repository.

## What lives here

Two related efforts share this repo:

1. **YadahCRM** (root) — a voice-note CRM MVP for realtors/agents
   (React + Vite + Supabase + OpenAI). See `YadahCRM_Cold_Launch_Implementation.txt`.
2. **The Omni-Engine** (`omni-engine/`) — an automated, multi-vector real estate
   **matchmaking / data-broker** system for the Kansas City / Midwest region,
   operated by Manley Systems LLC.

## Omni-Engine operating posture ("Honest Broker")

This is a **Data Broker / procurement-finder** business, not a wholesaler.

- Only aggregate **public** records (county tax/GIS/assessment, public permit
  feeds, public LLC registries). No private-system access, no writes to county
  systems, no spam.
- We do not act as a licensed real estate agent — we buy and **assign Option
  Contracts**, with full disclosure of role.
- Avoid the word "Wholesale" in generated documents. Use the Exclusive Option to
  Purchase + Assignment & Finder's Fee frameworks described in the mission brief.

## The three ingestion vectors

| Vector | Name | Target | Status |
|--------|------|--------|--------|
| **A** | **Builder Health Sweep** | Mid-market builders (5–50 permits/yr); spec DOM & price drops | **built** → `omni-engine/vector-a-builder-health/` |
| **B** | **The Dirt Sweep** | Multi-family/infill-zoned lots (KCMO/KCK) + 10–40 ac exurban tracts | **built** → `omni-engine/vector-b-dirt-sweep/` |
| **C** | **Capital Sweep** | LLCs buying 5+ SFH in 24 mo (BTR buyer list) | **built** → `omni-engine/vector-c-capital-sweep/` |

Downstream of the vectors:

- **Pain-Point matching engine** → `omni-engine/matching/` — routes A/B/C leads
  into the four Plays (pure, deterministic, unit-tested).
- **Operator Intelligence Layer** → `omni-engine/operator/` — **the spine every
  other module routes through.** Turns raw matches into field-ready intelligence
  for Travis Manley: operator briefings, pain-first scoring (Operator Fit gates),
  field-reality checks, deal-killer logic, reverse-selling scripts, relationship
  memory, the daily war room, and the 30-contact OS. Enforces trust-first
  language (no wholesaler/hype vocabulary) and human-final-decision (nothing
  auto-sends; only Travis decides). *AI finds the conversations; Travis creates
  the opportunity.*
- **Contract generators** → `omni-engine/contracts/` — Exclusive Option to Purchase
  + Assignment & Finder's Fee, with the mandated disclosure clauses and a hard
  "no Wholesale" compliance guard.

## Pain-Point matching plays (how scraped data is routed)

1. **Margin Squeeze** — option an R-3 infill lot ($50–70k), assign to a builder
   for a ~$10k fee (duplex on city pre-approved plans).
2. **Liquidity Bailout** — connect a builder's 60+ day spec to Vector C BTR
   investors; $5k finder's fee per door.
3. **Capital Preservation** — 120-day option on a premium suburban lot marketed
   build-to-suit; paid at retail closing.
4. **Pipeline Drought** — option a 15+ ac exurban tract; assign for a five-figure fee.

Vector B tags each lead with the Play it feeds (`playTarget`).

## Conventions for agents

- Each vector is a self-contained Apify actor under `omni-engine/<vector>/`
  (Node.js, ESM, Apify SDK v3).
- County/data-source endpoints and attribute names are **configurable via input**
  and must be **verified against live service directories** before production
  runs — never hard-code unverified endpoints as if confirmed.
- Keep enrichment honest: label approximations (e.g. `equityProxy`) as screening
  signals, not valuations.
- Branch work per the active task's feature branch; commit with clear messages.
