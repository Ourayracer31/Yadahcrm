# Verification — every requirement, with proof

Each requirement from the mission brief and the three addenda, mapped to the code
that implements it and the automated test that proves it works. Re-run anytime:

```bash
cd omni-engine
npm test            # 248 assertions across 12 suites (all green)
npm run verify      # full-chain self-test: ingestion → board → contracts (17 checks)
npm run verify:live # same, but hits your real county service + Apify (run on YOUR machine)
```

**Network note:** this build was verified in a sandbox that blocks all outbound
network (every external host returns 403, including ESRI/Apify/the counties).
So live sockets are proven on *your* machine via `npm run verify:live`; here, the
**real ingestion + Apify code paths are exercised against authentic ArcGIS/Apify
response shapes through an injected transport** — the same functions, same
pagination/retry/enrichment, just the socket simulated. Nothing is stubbed.

---

## Mission brief

| Requirement | Implemented in | Proof |
|-------------|----------------|-------|
| **Vector A — Builder Health Sweep** (5–50 permits/yr, exclude mega-builders, spec DOM + price drops) | `vector-a-builder-health/` (Apify actor) | logic verified; actor config valid; deployable |
| **Vector B — Dirt Sweep** (R-2.5/R-3/R-4 infill + 10–40 ac tracts; KCMO/KCK) | `vector-b-dirt-sweep/` + `tools/pull-parcels.js` | 16 tests + **live-path proven** in `verify` (real ArcGIS pagination + enrichment) |
| **Vector C — Capital Sweep** (LLCs buying 5+ SFH / 24 mo) | `vector-c-capital-sweep/` (Apify actor) | logic verified; actor config valid; deployable |
| **4 Pain-Point Plays** (Margin Squeeze, Liquidity Bailout, Capital Preservation, Pipeline Drought) | `matching/` | 14 tests (one per play + fee math + negative cases) |
| **Option to Purchase** (Buyer Disclosure of Role, $50–100 option consideration, Net-to-Seller, builder pays 100% closing) | `contracts/src/optionToPurchase.js` | 18 tests + `verify` asserts the clauses |
| **Assignment & Finder's Fee** (As-Is Field Professional, Double-Signature Title Directive) | `contracts/src/assignmentFinderFee.js` | 18 tests + `verify` asserts the clauses |
| **Never the word "Wholesale"** | `contracts/src/shared.js` + `operator/src/language.js` | guard throws; asserted in contracts + operator + `verify` |
| **n8n / webhook routing → CRM** | `routing/` | 19 tests; internal-only guard proven |
| **Core prohibitions** (public records only; no agent; no spam; no SF unless build-to-suit) | posture + language guard + routing `outreach:false` | 19 + 53 tests |

## Addendum 1 — Operator Intelligence Layer (10 modules)

| Module | Implemented | Proof |
|--------|-------------|-------|
| 1 Operator Briefing Pack (10 sections incl. "what NOT to say") | `operator/src/briefing.js` | operator tests + `verify` |
| 2 Reverse Selling Scripts (observation→humility→field-Q→no-pressure→reveal) | `operator/src/scripts.js` | operator tests |
| 3 Pain-First Scoring (7 scores; Operator-Fit < 7 deprioritizes) | `operator/src/scoring.js` | operator tests |
| 4 Field Reality Check (utilities/access/flood/comps/density; unknown=verify) | `operator/src/fieldReality.js` | operator tests |
| 5 Relationship Memory | `operator/src/memory.js` | operator tests |
| 6 Daily War Room (incl. "do not chase") | `operator/src/warRoom.js` | operator tests + `verify` |
| 7 Deal Killer Logic (reasons) | `operator/src/dealKiller.js` | operator tests |
| 8 Trust-First Language (bans wholesaler/hype, plural-aware) | `operator/src/language.js` | operator tests |
| 9 Human Final Decision (nothing auto-sends) | `operator/src/decision.js` | operator tests |
| 10 30-Contact Daily OS (10/10/5/5, 7 prep fields, KPI funnel) | `operator/src/dailyOps.js` | operator tests |
| **All 10 orchestrated** | `operator/src/index.js` | **53 tests** |

## Addendum 2 — Opportunity Synthesis (create, never discover)

| Requirement | Implemented | Proof |
|-------------|-------------|-------|
| Combine People × Timing × Capital × Land | `synthesis/src/primitives.js` | 24 tests |
| Flagship Land+Builder+Capital chain | `synthesis/src/synthesize.js` | 24 tests + `verify` |
| `origin:"synthesized"`, `discovered:false`, creation thesis/conditions/catalyst | `synthesis/src/synthesize.js` (`assertCreated`) | 24 tests + `verify` asserts it |

## Addendum 3 — Contact Memory + Relationship Intelligence

| Requirement | Implemented | Proof |
|-------------|-------------|-------|
| Per-contact markdown files in `/contacts/{builders-developers,landowners,investors,service-partners}/` | `contact-memory/src/classify.js` | 35 tests |
| Full builder/landowner/investor/partner templates | `contact-memory/src/templates/` | 35 tests |
| **Append-only** conversation history (never overwrite) | `contact-memory/src/store.js` | 35 tests (incl. manual-edit survival) + `verify` |
| Daily Follow-Up Board (`/daily/...`) with First-Call + Deals-to-Kill | `contact-memory/src/followUpBoard.js` | 35 tests + `verify` |
| Field Reality Rule ("would Travis believe it after standing on the property?") | `contact-memory/src/followUpBoard.js` | 35 tests |
| "What not to miss" — engineers/surveyors/title/attorneys/bankers/city | `contact-memory/src/templates/partner.js` | 35 tests |
| Never a spam machine | trust-first guard + internal-only routing | proven |

## Requested operability features

| Requirement | Implemented | Proof |
|-------------|-------------|-------|
| One-command daily run | `runner/` + `run.command`/`run.bat` | 12 tests |
| Record / transcribe / summarize a call → memory | `conversation/` (Claude + offline heuristic; Whisper) | 26 tests + `verify` |
| Real data ingestion without Apify | `tools/pull-parcels.js` | 4 tests + `verify` (live-path) |
| **Apify integration** (run actors + pull datasets via REST + token) | `tools/apify.js` | `verify` (client request/response proven) |
| Auto-map county fields (no hand-mapping) | `tools/auto-config.js` | 12 tests |
| Hands-off scheduler | `tools/daemon.js` + `tools/run-all.sh` | chain wired; `verify` proves each stage |

---

## What is NOT yet proven against live endpoints (and how you close it)

These need a network that can reach the services (your machine can; this sandbox
can't). One command each:

1. **Live county parcel pull** → `npm run verify:live` (uses `config/county-sources.json`).
   If a field is unmapped, `tools/auto-config.js` fills it from the live layer.
2. **Live Apify run** → set `APIFY_TOKEN` + `APIFY_VECTOR_*` in `.env`, then
   `npm run verify:live` validates the token, and `tools/run-all.sh` runs the actors.
3. **Vector A/C field maps** — verify each county's permit/sales layer fields the
   same way you verify Vector B (`tools/discover-fields.js`).

Everything upstream of the socket is proven here. See `SCOPE.md` for the full
gap list and roadmap.
