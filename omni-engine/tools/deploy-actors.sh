#!/bin/bash
# Deploy the three vector actors to your Apify account.
# Prereq: `npm i -g apify-cli` and `apify login` (once).
cd "$(dirname "$0")/.." || exit 1

if ! command -v apify >/dev/null 2>&1; then
  echo "Apify CLI not found. Install it:  npm install -g apify-cli   then:  apify login"
  exit 1
fi

for actor in vector-a-builder-health vector-b-dirt-sweep vector-c-capital-sweep; do
  echo "== Pushing $actor =="
  ( cd "$actor" && apify push ) || { echo "  ✗ failed to push $actor"; exit 1; }
  echo
done

echo "✓ All three actors pushed. Run them in the Apify console (or via Apify MCP),"
echo "  fill in the verified county endpoints/fields, then export each run's dataset"
echo "  to builders.json / lots.json / buyers.json and point omni.config.json at them."
