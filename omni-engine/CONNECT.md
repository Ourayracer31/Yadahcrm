# Connect & Go Live — the complete checklist

Grouped by what it gets you. **Tier 1 alone gives a working board with real KC
data and zero paid accounts.** Each item says: do it once? needs an account/$?

Legend: ⏱️ one-time · 🆓 free · 💳 needs a paid account · 🔑 needs a key in `.env`

---

## TIER 1 — Working board on real data (no paid accounts)

- [ ] **Install Node.js LTS** ⏱️🆓 — https://nodejs.org . Verify: `node --version`.
- [ ] **Get the project on your computer** ⏱️🆓 — clone branch `claude/eager-mendel-p776fb` (or merge PR #3 and clone `main`). Then `cd omni-engine`.
- [ ] **Run it** 🆓 — double-click `START.command` (Mac) / `START.bat` (Windows), or `npm start`.
- [ ] **Be on a normal network** 🆓 — the county GIS servers must be reachable (any home/office ISP works; locked-down/VPN sandboxes don't).
- [ ] **Auto-map the county fields** ⏱️🆓 — `node tools/auto-config.js --source config/county-sources.json --write`. Confirm no `VERIFY_*` left. For any it can't auto-detect: `node tools/discover-fields.js --url "<that county's layer>/query"` and paste the field name into `config/county-sources.json`.
- [ ] **Add the builders you know** ⏱️🆓🔑(your knowledge) — `npm run add-builder`. **Required for matches** — without builders there's nothing to pair land with. Add 5–15.
- [ ] **Confirm it works on real data** 🆓 — `npm run verify:live` (proves the live county fetch from your machine).

> After Tier 1: `npm start` gives a real board of your builders against real KC
> parcels. Everything below is automation and reach.

---

## TIER 2 — Phone numbers on the leads (skip-trace)

- [ ] **Pick a licensed skip-trace provider** 💳 — e.g. BatchData, Endato, REISkip, IDI/TLO. Get its API endpoint + key.
- [ ] **Set 4 vars in `.env`** 🔑 — `SKIPTRACE_URL`, `SKIPTRACE_API_KEY`, `SKIPTRACE_PHONES_PATH`, `SKIPTRACE_EMAILS_PATH` (the last two = where phones/emails sit in that provider's JSON response).
- [ ] **DNC / TCPA** ⏱️ — scrub the Do-Not-Call list and follow texting/calling rules before outreach. Calls stay manual by design.

> After Tier 2: the board shows "Landowner <name> ☎ <number>" — a person to call.

---

## TIER 3 — Automatic scrapers (Apify)

- [ ] **Apify account + API token** ⏱️💳🔑 — https://console.apify.com/account/integrations → `APIFY_TOKEN` in `.env`.
- [ ] **Deploy the 3 actors** ⏱️ — `npm i -g apify-cli && apify login && bash tools/deploy-actors.sh`.
- [ ] **Set actor ids in `.env`** 🔑 — `APIFY_VECTOR_A`, `APIFY_VECTOR_B`, `APIFY_VECTOR_C` (the `username~actorname` you just pushed).
- [ ] **Give Vector A a permit source** ⏱️ — a public permits dataset (e.g. a `data.kcmo.org` Socrata dataset id) + field map. Verify fields like you did for B.
- [ ] **Give Vector C a sales source** ⏱️ — the county assessor/recorder *sales* layer + field map (owner, land-use, sale date). Verify fields.
- [ ] *(Vector B already has verified KCMO/KCK services from Tier 1.)*

> After Tier 3: builders (A), dirt (B), and BTR buyers (C) all refresh themselves.

---

## TIER 4 — It reaches your phone & runs itself

- [ ] **Telegram bot** ⏱️🆓🔑 — message `@BotFather` → `/newbot` → get the token; get your chat id (message the bot, then read it from the API or use `@userinfobot`). Set `NOTIFY_CHANNEL=telegram`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` in `.env`. *(Slack/webhook also supported.)*
- [ ] **Start the autopilot** ⏱️ — `node tools/daemon.js --at 06:00`, kept alive with `pm2`, `systemd`, or `nohup … &` so it survives logout. (Or schedule the Apify actors instead.)

> After Tier 4: you wake up, the board + first call + number are on your phone.

---

## TIER 5 — Smarter AI (optional)

- [ ] **Claude call summaries** 🔑💳 — `ANTHROPIC_API_KEY` in `.env` (https://console.anthropic.com). Without it, the offline summarizer is used.
- [ ] **Audio transcription** 🔑💳 — `OPENAI_API_KEY` for Whisper, to log recorded calls. `cd conversation && npm install` (only module needing a dependency).

---

## TIER 6 — Before you transact (do not skip)

- [ ] **Lawyer reviews the contract templates** ⏱️💳 — the Option to Purchase + Assignment & Finder's Fee in `contracts/` encode the Honest-Broker clauses, but counsel should sign off once before you use them.

---

## What each tier needs at a glance

| Tier | Result | Accounts needed |
|------|--------|-----------------|
| 1 | Real board, real KC parcels, your builders | none |
| 2 | Phone/email on landowners | skip-trace provider |
| 3 | Scrapers run automatically | Apify |
| 4 | Board on your phone, on autopilot | Telegram (free) |
| 5 | Best-quality call summaries | Anthropic / OpenAI |
| 6 | Safe to transact | a lawyer, once |

**Minimum to be genuinely useful = Tier 1 + Tier 2.** Everything else is reach and
automation. If any step errors, copy the on-screen text and I'll fix it.
