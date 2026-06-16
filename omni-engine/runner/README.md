# Daily Runner (`omni-daily`)

One command that runs the whole Omni-Engine for the day and drops Travis's board
in his lap.

```
vectors' output ─▶ synthesis ─▶ operator ─▶ contact-memory board ─▶ (optional) routing
   (builders/lots/buyers.json)   create     score/brief/kill   /daily/board.md     n8n/CRM
```

## Run it

```bash
# from omni-engine/
node runner/src/daily.js --config config/omni.config.example.json
```

That reads the sample inputs, runs the full pipeline, prints the War Room, and writes:

- `out/war-room.txt` + `out/war-room.json` — the daily War Room
- `out/briefings.txt` — one-page operator brief per live opportunity
- `out/daily-plan.json` — the 30-contact plan (10/10/5/5)
- `out/opportunities.json` — every scored opportunity (live + killed)
- `out/board.md` + `out/board.json` — the Follow-Up Board
- `contacts/**/<contact>.md` — refreshed per-contact memory files (append-only)
- `daily/travis-follow-up-board.md` — the board, in the mandated location

## Real daily use

1. Run the three Apify vectors, export their datasets to
   `builders.json` / `lots.json` / `buyers.json`.
2. Copy `config/omni.config.example.json` → `omni.config.json` and point
   `inputs` at those files, `memory` at your `crm.json`, and (optionally)
   `endpoints` at your n8n webhooks. Set `"route": true` to push to dashboards.
3. `node runner/src/daily.js --config config/omni.config.json`
4. Travis opens `daily/travis-follow-up-board.md`, works the calls, and logs each
   conversation back into memory (see `contact-memory`), which sharpens tomorrow.

## Flags

| Flag | Meaning |
|------|---------|
| `--config <file>` | config file (paths resolve relative to it) |
| `--inputs <dir>` | shortcut: use `<dir>/builders.json|lots.json|buyers.json` |
| `--memory <file>` | relationship-memory JSON store |
| `--out <dir>` | artifact output dir (default `out`) |
| `--root <dir>` | where `/contacts` and `/daily` are written (default `.`) |
| `--route` | also POST events to the configured n8n endpoints |
| `--dry-run` | with `--route`, record intent but send nothing |
| `--date <YYYY-MM-DD>` | run "as of" a specific date |

## Guarantees

- **Nothing is sent to a lead.** Routing is internal-only (Travis dashboards).
- **Advisory only.** Every output is a suggestion; Travis decides.
- **Pure core.** `runDailyPipeline()` is filesystem/network-free and unit-tested
  (`npm test`, 12 passing); `daily.js` is the IO wrapper around it.
