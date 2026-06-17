#!/bin/bash
# Omni-Engine — first-time setup. Verifies Node, installs deps, runs the tests,
# and does one sample daily run so you can see it work.
cd "$(dirname "$0")" || exit 1
set -e

echo "== Omni-Engine setup =="
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js not found. Install the LTS from https://nodejs.org, then re-run."
  exit 1
fi
echo "✓ Node $(node --version)"

echo
echo "1/4  Installing dependencies for the conversation summarizer (optional features)…"
( cd conversation && npm install --silent 2>/dev/null ) || echo "   (skipped — the offline summarizer still works without this)"

echo "2/4  Setting up your env file…"
[ -f .env ] || { cp .env.example .env; echo "   created .env (all keys optional — fill in later for Claude/Whisper)"; }

echo "3/4  Running the test suite…"
npm test >/tmp/omni-test.log 2>&1 && echo "   ✓ all tests passed" || { echo "   ✗ tests failed — see /tmp/omni-test.log"; exit 1; }

echo "4/4  Sample daily run…"
npm run daily >/tmp/omni-daily.log 2>&1 && echo "   ✓ daily pipeline ran — board at daily/travis-follow-up-board.md" || echo "   ✗ daily run failed — see /tmp/omni-daily.log"

echo
echo "Done. Next:"
echo "  • Read SETUP.md for going live with real data."
echo "  • Double-click run.command (Mac) / run.bat (Windows) each morning."
echo "  • Keep CHEATSHEET.md next to the computer."
