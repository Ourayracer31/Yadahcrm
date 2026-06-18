# POD Profit Engine (BeeLab)

Beginner POD profit coach. Feed it the numbers → get **one verdict and one move**, on Chris
Heckman's locked framework. This is a self-contained project, separate from anything else in the repo.

See [`CLAUDE.md`](./CLAUDE.md) for the locked spec and piece tracker.

## Piece 1 (this build)
App shell + the deterministic verdict engine, with the four holes filled:
1. **2.0–2.5 ROAS band** — its own "past breakeven, below the scale line · HOLD" verdict.
2. **Cart + checkout** — real funnel gates in the Road-to-Breakeven checklist.
3. **Refunds** — a first-class input (the v1.4 waterfall, not lumped into "other").
4. **Provisional flag** — mark intraday/unsettled data; the verdict reads as a draft.

The money math reproduces **data model v1.4** (`Daily P&L`) exactly.

## Run it
```bash
npm install
npm run verify     # replays the 3 v1.4 sample days, asserts every number + the zone logic
npm run dev        # http://localhost:3000 — defaults to the 2026-05-26 sample ($429 net)
npm run build      # production build
```

## Where things live
- `lib/engine.ts` — pure, deterministic engine: waterfall + funnel + Heckman verdict.
- `lib/engine.test.ts` — the v1.4 validation harness (`npm run verify`).
- `app/page.tsx` — the single-screen Manual-mode UI.
- `app/globals.css` — BeeLab dark cockpit theme.

## Not in Piece 1 (next pieces)
Trend chart · Supabase auth + saved history · server-side Claude coach read · Stripe · deploy.
