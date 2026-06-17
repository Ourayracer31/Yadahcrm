#!/bin/bash
# Omni-Engine — ONE BUTTON (macOS: double-click this file).
# Runs the morning pipeline and opens Travis's board.
cd "$(dirname "$0")" || exit 1

echo "☕ Running the Omni-Engine for today…"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js isn't installed. Install it from https://nodejs.org (LTS), then double-click this again."
  read -r -p "Press Return to close." _; exit 1
fi

# Install deps the first time only.
[ -d node_modules ] || (echo "First run — setting up (one minute)…"; npm install --silent 2>/dev/null)

node runner/src/daily.js --config config/omni.config.example.json
STATUS=$?

BOARD="daily/travis-follow-up-board.md"
if [ -f "$BOARD" ]; then
  echo
  echo "📋 Opening today's board: $BOARD"
  open "$BOARD" 2>/dev/null || true
fi

echo
if [ $STATUS -eq 0 ]; then echo "✅ Done. Read the board, make your calls."; else echo "⚠️ Something went wrong (code $STATUS) — scroll up."; fi
read -r -p "Press Return to close." _
