# START HERE

## Step 1 — open it
- **Mac:** double-click **`START.command`**
- **Windows:** double-click **`START.bat`**

It sets everything up, pulls real Kansas City parcels (no account needed), builds
today's board, shows you the summary, and opens the full board.
*(If it says "Node.js" is missing, install it once from https://nodejs.org — pick "LTS" — then double-click again.)*

## Step 2 — the one thing only you can do
Tell it the builders you know. You know who's building and who's squeezed — that's
the spark it needs to turn parcels into real deals.

```
npm run add-builder
```

20 seconds each, no files to edit. It just asks: name, area, what they build, and
whether they're sitting on specs or short on lots. Add a handful, then double-click
START again — now the board is *your* real deals.

## Step 3 (optional, later) — make it run itself & reach your phone
In the file called `.env`, fill in:
- `NOTIFY_CHANNEL=telegram` + a bot token → the morning board lands on your phone.
- a skip-trace key → phone numbers appear next to the landowners.
- an Apify token → the builder/buyer scrapers run automatically too.

Then start the autopilot once and walk away:
```
node tools/daemon.js --at 06:00
```

That's it. Everything else (`SCOPE.md`, `SETUP.md`, `CHEATSHEET.md`) is there if
you want detail — but you don't need it to start.
