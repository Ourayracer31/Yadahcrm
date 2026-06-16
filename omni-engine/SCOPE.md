# Omni-Engine — Scope, Gaps & Roadmap

An honest accounting of what this system **is**, what **works today**, what's
**partial**, what's **missing**, and what it takes to make it fully production-grade.

*Last updated: 2026-06-16. 219 automated tests passing across the engine.*

---

## What it is (in one paragraph)

A **Construction Opportunity Intelligence System** for Travis Manley: it ingests
public records, **creates** opportunities by combining People × Timing × Capital ×
Land, scores them by *pain* (gated on whether Travis's construction judgment can
uniquely solve them), runs each through a field-reality and deal-killer check,
prepares a one-page briefing and a non-pushy opening script, remembers every
contact and conversation, and hands Travis a daily board + a 30-contact plan. It
**never contacts a lead and never auto-sends** — the human makes every call.

---

## 🤖 How hands-off is it?

The design goal is: **you don't click around.** A scheduler runs the whole chain
and the board just appears. Here's the split.

**Fully automatic (no human input, runs on a schedule):**
`tools/daemon.js` (or cron / Apify schedules) runs `tools/run-all.sh`, which:
1. **Auto-resolves county field names** from the live ArcGIS services
   (`auto-config.js` — no hand-mapping),
2. **Pulls real parcels** → `lots.json` (`pull-parcels.js`),
3. **Runs the builder/buyer actors** on Apify (if deployed),
4. **Synthesizes → scores → field-checks → briefs → builds the board**,
5. **Pushes to your CRM dashboard / phone** (n8n, if configured).

```bash
node tools/daemon.js --at 06:00     # set once; the board refreshes every morning
```

**The ONLY things that ever need you (they can't be automated away):**
1. **Connect accounts once** — paste an Apify token + API keys into `.env`. The
   system can't create your accounts.
2. **One-time deploy** — `bash tools/deploy-actors.sh` to put the scrapers on your
   Apify account (one command).
3. **Make the calls & sign the deals** — this is the entire point. *AI finds the
   conversations; Travis creates the opportunity.* By design the system never
   contacts a lead or signs anything for you.
4. **Legal review** of the contract templates, once.

Everything else — discover, map, scrape, combine, score, brief, board, push,
refresh daily — happens with zero input from you.

---

## ✅ What works TODAY (runnable now, no accounts required)

| Capability | How to use it | Status |
|------------|---------------|--------|
| **Full daily pipeline** on data you provide | `npm run daily` / double-click `run.command` | ✅ tested (12) |
| **Opportunity synthesis** (create, not discover) | automatic in the pipeline | ✅ tested (24) |
| **Pain-first scoring + Operator-Fit gate** | automatic | ✅ tested (53, operator) |
| **Field-reality + deal-killer** | automatic | ✅ |
| **Briefings + reverse-selling scripts** | `out/briefings.txt` | ✅ |
| **Daily War Room + 30-contact plan** | `out/`, console | ✅ |
| **Relationship memory + per-contact files** | `contacts/**`, append-only | ✅ tested (35) |
| **Daily Follow-Up Board** | `daily/travis-follow-up-board.md` | ✅ |
| **Log a call → memory** (typed or audio) | `npm run log -- ...` / `recorder.html` | ✅ tested (26) |
| **Offline call summarizer** (no API key) | built-in heuristic | ✅ |
| **Contract generation** (Option + Assignment) | `contracts/src/cli.js` | ✅ tested (18) |
| **Trust-first language guard** (no "wholesale"/hype) | everywhere | ✅ |
| **Real Vector-B parcel pull** (no Apify) | `tools/pull-parcels.js` once fields verified | ✅ logic tested (4) |
| **County field discovery** | `tools/discover-fields.js` | ✅ tested (14) |
| **n8n/webhook routing** (internal dashboards only) | `--route` | ✅ tested (19) |

**Bottom line:** the entire *intelligence + memory + paperwork* half of the system
is done and runs on plain Node with zero setup. Feed it data and it works.

---

## 🟡 Partial — built, needs your config/accounts to go live

| Area | What's built | What you supply |
|------|--------------|-----------------|
| **Vector B (dirt scrape)** | Apify actor **and** a no-Apify direct puller | Verified county `queryUrl` + `fieldMap` (run `discover-fields.js`) |
| **Vector A (builders)** | Apify actor (permits + spec DOM/price) | A permit data source (Socrata/ArcGIS) + field map; optional listings feed |
| **Vector C (buyers)** | Apify actor (corporate SFH buyers) | Assessor/recorder sales layer + field map |
| **Webhook → CRM dashboards** | routing layer + n8n workflow template | Your n8n endpoints |
| **Claude-quality summaries** | Claude path in the summarizer | `ANTHROPIC_API_KEY` |
| **Audio transcription** | Whisper integration | `OPENAI_API_KEY` |

You have an **Apify account (MCP-capable)** — so A/B/C are deployable now: see
`APIFY.md` (`bash tools/deploy-actors.sh`, then run/verify each actor).

---

## 🔴 What's MISSING (not built yet)

1. **A skip-trace *provider account*.** The skip-trace engine is **built**
   (`skiptrace/` — provider-agnostic client, caching, lead + memory enrichment,
   phone on the board; 15 tests). What's missing is *your* licensed provider:
   pick one, set `SKIPTRACE_URL` + `SKIPTRACE_API_KEY`, and it runs automatically.
2. **Live endpoint verification at scale.** County field names are verified
   one-by-one with `discover-fields.js`. Cass/Platte/Miami tract sources aren't
   pre-filled.
3. **A real database.** Memory is markdown files + JSON. Fine for one operator;
   no multi-user, no concurrent-write safety, no search UI.
4. **A UI / dashboard.** Everything is CLI + markdown files (+ optional n8n
   push). There's no web app yet (the root `YadahCRM` Vite app is separate and
   not wired in).
5. **Permit-pulse automation for Vector A.** The actor needs a confirmed permit
   feed; "spec DOM + price drops" assumes a listings source you connect.
6. **Authentication/secrets management** for the webhook + API keys beyond `.env`.
7. **Automated tests against live county data** (current tests are deterministic
   offline fixtures — they prove the logic, not the live endpoints).
8. **Scheduling/orchestration** beyond cron / Apify schedules (no built-in
   queue, retries-across-runs, or run history dashboard).

---

## ⚠️ Honest limitations & risks

- **Garbage in, garbage out:** scores are only as good as the input data. The
  `equityProxy`, zoning matches, and field-reality flags are **screening
  signals**, labeled as such — not valuations or legal conclusions. Confirm at
  title and on the ground.
- **County data is messy and lags** (parcels often update weekly; field names
  vary by county and change). The `discover-fields` step is mandatory, not
  optional.
- **The AI prepares; Travis decides.** Nothing here replaces standing on the dirt
  or a phone call. The Field Reality Rule ("would Travis believe it after standing
  on the property?") is enforced, but it's a prompt to verify, not a guarantee.
- **Compliance is built-in but not legal advice.** The "no Wholesale", role-
  disclosure, real-option-consideration, and net-to-seller guards encode the
  Honest-Broker posture; have counsel review the generated instruments before use.
- **Only public records.** No private-system access, no writes to county systems,
  no spam. That boundary is by design.

---

## 🚀 Roadmap to "fully working & better" (prioritized)

**Phase 1 — Go hands-off (one-time setup, then it runs itself)**
1. Put your keys in `.env` (Apify token, `ANTHROPIC_API_KEY`, optional
   `OPENAI_API_KEY`, optional n8n URL). *(once)*
2. `bash tools/deploy-actors.sh` — push the scrapers to your Apify account. *(once)*
3. `node tools/daemon.js --at 06:00` — start the scheduler. **← from here it's
   automatic: fields resolve, parcels pull, actors run, the board refreshes daily.**
4. You just read the board and make the calls it surfaces.

**Phase 2 — Widen coverage (automatic once added)**
5. Add Cass/Platte/Miami tract sources to `county-sources.json` (the daemon
   auto-resolves their fields on the next run).

**Phase 3 — Close the loop**
7. ~~Skip-trace integration (owner phone/email)~~ **DONE** (`skiptrace/`) — just
   add your provider's `SKIPTRACE_URL` + `SKIPTRACE_API_KEY` and it runs.
8. n8n dashboards live (push board + first-call alert to Travis's phone).

**Phase 4 — Productize**
9. Move memory from files → a real DB (Supabase is already available) for search,
   history, and a UI.
10. A simple web dashboard (reuse the root YadahCRM Vite app) over the same data.
11. Live-endpoint smoke tests in CI; run-history + retry orchestration.

---

## Module map (what to read)

```
synthesis/  create opportunities (People×Timing×Capital×Land)   24 tests
matching/   pairwise routing into the 4 Plays                    14 tests
operator/   the spine: scoring, field-reality, deal-killer,      53 tests
            briefings, scripts, memory, war room, 30-contact OS,
            trust-first language, human-final-decision
contact-memory/  per-contact files + daily board (append-only)  35 tests
contracts/  Option to Purchase + Assignment & Finder's Fee       18 tests
skiptrace/  owner -> phone/email (provider-agnostic, cached)     15 tests
routing/    n8n/webhook (internal dashboards only)               19 tests
runner/     one-command daily pipeline                           12 tests
conversation/  record/transcribe/summarize a call → memory       26 tests
tools/      field discovery + parcel pull + Apify + self-test    30 tests
vector-a/b/c/  Apify ingestion actors (deploy to run)            logic verified
```

Read `USAGE.md` for the daily loop, `SETUP.md` to go live, `APIFY.md` for the
scrapers, `CHEATSHEET.md` for the plain-language version.
