# Setup — from zero to using it with real data

## 0. Prerequisite
Install **Node.js (LTS)** from https://nodejs.org. That's the only requirement
for the core system.

## 1. First-time setup (2 minutes)
```bash
cd omni-engine
bash setup.sh         # checks Node, installs optional deps, runs tests, sample daily run
```
That's it — the engine now runs on **sample data** with `npm run daily` (or the
one-click `run.command` / `run.bat`). No accounts, no keys required for the core.

## 2. Go live — the fastest path (no Apify needed)

The pipeline needs three inputs: **builders**, **lots**, **buyers**. You don't
have to scrape all three. The fastest way to real, useful output:

### a) Seed builders + buyers by hand (you already know these)
Travis knows the local builders and BTR buyers. Put them in
`samples/builders.json` and `samples/buyers.json` using the bundled examples as
the template. Even 5–10 real builders produce real matches. (As you talk to
people, the conversation logger keeps them current.)

### b) Pull real lots from the county — directly, no Apify
1. Find the real field names for a county (run on your computer; the county
   servers block bots, so this won't work from a cloud sandbox):
   ```bash
   node tools/discover-fields.js --url "https://gis.mijackson.org/countygis/rest/services/ParcelViewer/Parcels/MapServer/0/query"
   ```
   It prints the layer's fields and a suggested `fieldMap`.
   *(Tip: Claude in Chrome can open that `?f=json` URL and read the fields for you.)*
2. Paste the verified field names into `config/county-sources.json`, replacing the
   `VERIFY_*` placeholders.
3. Pull real multi-family/infill parcels into `lots.json`:
   ```bash
   node tools/pull-parcels.js --source config/county-sources.json \
     --county "Jackson (KCMO)" --vacant --out samples/lots.json
   ```

### c) Run the day
```bash
npm run daily        # synthesis -> operator -> board, on your real data
```
Open `daily/travis-follow-up-board.md`. Make calls. Log them:
```bash
npm run log -- --contact "Builder Name" --type builder --text "what you learned"
```

## 3. Optional upgrades

| Want | Set | Where |
|------|-----|-------|
| Claude-quality call summaries | `ANTHROPIC_API_KEY` | `.env` |
| Transcribe audio recordings | `OPENAI_API_KEY` | `.env` |
| Push to CRM dashboards | n8n webhook URLs + `--route` | `.env` / `config/omni.config.json` |
| Full automated scraping (A/B/C) | Apify account | each `vector-*/` actor |

## 4. The honest state of "scraping"

- **Vector B (dirt)** runs **today** without Apify via `tools/pull-parcels.js`
  once you verify the county fields.
- **Vector A (builders)** and **Vector C (buyers)** are built as Apify actors and
  also work best with verified endpoints. Until you wire those, **seed
  builders.json/buyers.json by hand** — the engine treats hand-entered and
  scraped data identically.

See **SCOPE.md** for exactly what works, what's missing, and the roadmap.
