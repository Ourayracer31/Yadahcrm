#!/bin/bash
# Omni-Engine — ONE BUTTON (Linux / terminal). Runs the daily pipeline + opens the board.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Install Node.js (https://nodejs.org) first."; exit 1; }
[ -d node_modules ] || npm install --silent 2>/dev/null
node runner/src/daily.js --config config/omni.config.example.json
BOARD="daily/travis-follow-up-board.md"
[ -f "$BOARD" ] && (xdg-open "$BOARD" 2>/dev/null || cat "$BOARD")
