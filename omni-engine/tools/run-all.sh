#!/bin/bash
# Omni-Engine — the whole chain, hands-off. No clicking, no field mapping.
#   1. auto-resolve county fields from the live services
#   2. pull real multi-family/infill parcels  -> lots.json
#   3. (Apify) run builder + buyer actors if configured -> builders/buyers.json
#   4. run the daily pipeline (synthesis -> operator -> board)
#   5. push to your CRM dashboards (if --route configured)
#
# Designed to be run by a scheduler (cron / tools/daemon.js). Logs to stdout.
cd "$(dirname "$0")/.." || exit 1
[ -f .env ] && set -a && . ./.env && set +a

echo "[$(date '+%Y-%m-%d %H:%M')] Omni-Engine run starting"

echo "→ resolving county fields…"
node tools/auto-config.js --source config/county-sources.json --write || true

echo "→ pulling real parcels (Vector B)…"
for COUNTY in "Jackson (KCMO)" "Wyandotte (KCK)"; do
  node tools/pull-parcels.js --source config/county-sources.json --county "$COUNTY" --vacant --out "samples/lots-$(echo "$COUNTY" | tr -dc 'A-Za-z').json" 2>&1 || echo "   (skipped $COUNTY — fields not verified yet)"
done
# merge whatever pulled into samples/lots.json
node -e '
  import("node:fs").then(fs=>{
    const files=fs.readdirSync("samples").filter(f=>/^lots-.*\.json$/.test(f));
    const all=files.flatMap(f=>{try{return JSON.parse(fs.readFileSync("samples/"+f))}catch{return[]}});
    if(all.length) fs.writeFileSync("samples/lots.json", JSON.stringify(all,null,2));
    console.log("   merged "+all.length+" parcels into samples/lots.json");
  })' || true

# 3. Apify actors via the REST API (just needs APIFY_TOKEN + actor ids in .env).
if [ -n "$APIFY_TOKEN" ] && [ -n "$APIFY_VECTOR_A" ]; then
  echo "→ running Vector A (builders) on Apify…"
  A_IN=""; [ -f config/vector-a-input.json ] && A_IN="--input config/vector-a-input.json"
  node tools/apify.js --actor "$APIFY_VECTOR_A" $A_IN --out samples/builders.json || echo "   (Vector A run failed — keeping existing builders.json)"
fi
if [ -n "$APIFY_TOKEN" ] && [ -n "$APIFY_VECTOR_B" ]; then
  echo "→ running Vector B (dirt) on Apify…"
  B_IN=""; [ -f config/vector-b-input.json ] && B_IN="--input config/vector-b-input.json"
  node tools/apify.js --actor "$APIFY_VECTOR_B" $B_IN --out samples/lots.json || echo "   (Vector B Apify run failed — using the direct-pull lots.json)"
fi
if [ -n "$APIFY_TOKEN" ] && [ -n "$APIFY_VECTOR_C" ]; then
  echo "→ running Vector C (buyers) on Apify…"
  C_IN=""; [ -f config/vector-c-input.json ] && C_IN="--input config/vector-c-input.json"
  node tools/apify.js --actor "$APIFY_VECTOR_C" $C_IN --out samples/buyers.json || echo "   (Vector C run failed — keeping existing buyers.json)"
fi

# skip-trace owners so the board has a number to call (if a provider is configured)
if [ -n "$SKIPTRACE_URL" ] && [ -n "$SKIPTRACE_API_KEY" ] && [ -f samples/lots.json ]; then
  echo "→ skip-tracing owners…"
  node skiptrace/src/cli.js --in samples/lots.json --out samples/lots.json --memory crm.json --root . || echo "   (skip-trace failed — continuing without phone numbers)"
fi

echo "→ running the daily pipeline…"
ROUTE=""
[ -n "$OMNI_WEBHOOK_DEFAULT" ] && ROUTE="--route"
node runner/src/daily.js --config config/omni.config.example.json $ROUTE

echo "[$(date '+%Y-%m-%d %H:%M')] Done. Board: daily/travis-follow-up-board.md"
