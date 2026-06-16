#!/bin/bash
# Omni-Engine — START HERE (Mac: double-click this file).
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Install Node.js from https://nodejs.org (LTS), then double-click this again."; read -r -p "Press Return." _; exit 1; }
node tools/quickstart.js
BOARD="daily/travis-follow-up-board.md"
[ -f "$BOARD" ] && open "$BOARD" 2>/dev/null
read -r -p "Press Return to close." _
