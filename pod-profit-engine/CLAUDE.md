# POD Profit Engine — CLAUDE.md (source of truth)

*From `BUILD_SPEC`. Every build session is checked against this. Correct over fast.*
**Owner:** Travis Manley · **Brand:** BeeLab

> This project folder is **self-contained and separate from any other product** (e.g. the CRM that shares this repo). Keep it that way — no shared code across products.

---

## One-line definition
A dead-simple profit tool for **beginner print-on-demand operators**: feed it a handful of
numbers, get back **one verdict and one move**, on Chris Heckman's (WeScale) proven framework.
Everyone else sells a mirror; we sell a coach.

## Non-negotiable principles
1. **Math by code, words by AI.** All numbers and pass/fail gates are deterministic code —
   never AI-guessed, never approximated. The AI layer only writes the plain-English read on top.
2. **Heckman's framework is locked.** Exactly the 5 metrics, the gates, the budget ladder, the
   road to breakeven. Nothing more, nothing less.
3. **ROAS the Heckman way:** `ROAS = (AOV × Conversion Rate) ÷ CPC`. Never the platform's number.
4. **Beginner-simple is the product.** No dashboards, no tutorials. One plain answer.
5. **One hero chart** allowed (later). A wall of charts is not.
6. **Two input modes, one brain.** Manual (now) and Connected (later). Verdict engine identical.

## The locked Heckman spec (implemented in `lib/engine.ts`)

### Road to Breakeven (ROAS < 2.0)
- **CPC gatekeeper:** $0.50–0.75 GOOD · $0.75–1.00 OKAY · $1.00–1.50 FIX IT · $1.50+ KILL IT.
- **Funnel targets:** Add to cart 6–8% · Reached checkout 5–6% · CVR ~3% · AOV $33 → $45.
- **Find the broken number:** High CPC → fix the ad. Low conversion → fix the store.
  Low AOV → fix the offer. Low ROAS (others fine) → fix the cost structure.

### Past breakeven, below scale line (2.0 ≤ ROAS < 2.5)
- Hold spend. Push ROAS to 2.5 before adding budget. (Budget ladder = hold from 2.0–2.2.)

### Scaling Protocol (ROAS ≥ 2.5) — fix the first broken gate
- **Gate 1 — ROAS (P7):** pass at 2.5+.
- **Gate 2 — Email share of revenue:** pass at 20%+.
- **Gate 3 — Store CVR:** pass at 2%+.
- **Gate 4 — Net Profit Margin:** pass at 15%+.
- **Scale Gate (ALL must pass):** ROAS ≥ 2.5 AND Email ≥ 20% AND Net Margin ≥ 15% AND CVR ≥ 2%.
- **Budget ladder (per-campaign P7 ROAS):** 2.5+ → +20% · 2.2–2.4 → +15% · 2.0–2.2 hold ·
  1.8–2.0 hold · 1.6–1.8 → −15% · <1.6 → −20%. Re-check every 2–3 days, skip Mon/Tue.

### Money waterfall (matches data model v1.4, `Daily P&L`)
Gross Sales(+Shipping) → −Cost of Sales(COGS + Discounts + Refunds) → Gross Profit →
−Operating Exp(Merchant Fees + Advertising + Overhead) → Operating Income →
+Additional Income(Printify rebate + card cashback) → **Grand Total Income (net profit)**.
Stats: Off-FB ROAS, Blended MER, COGS %, Overhead %. All reproduced exactly in `engine.test.ts`.

## Stack (locked)
- **Frontend/app:** Next.js (React) · BeeLab dark cockpit theme
  (bg `#0a0e17`, blue `#2E86C1`/`#1A5276`, gold `#f39c12`/`#e67e22`, green `#27c08a`, red `#e8554e`).
- **Backend/data:** Supabase (auth + daily entry history). *(later piece)*
- **AI:** Claude Sonnet via **server-side** route — never ship the key client-side. *(later piece)*
- **Payments:** Stripe, trial → subscription. *(later piece)*
- **Deploy:** Vercel + custom domain. *(later piece)*
- Must NOT: ship the AI key client-side; let AI compute/override a number; store card data;
  block the core verdict behind a connection (Manual mode always works).

---

## Build state — piece tracker

| Piece | Scope | Status |
|---|---|---|
| **1** | App shell + corrected deterministic verdict engine. Holes filled: 2.0–2.5 ROAS band, cart + checkout as real funnel gates, refunds input, provisional flag. Math matches v1.4 exactly. | ✅ built — awaiting verification vs v1.4 |
| 2 | Hero trend chart + Supabase auth + saved daily history | not started |
| 3 | Server-side Claude Sonnet "coach's read" | not started |
| 4 | Stripe trial → subscription + Vercel deploy | not started |
| later | Connected mode (MCP pulls: Shopify/Meta/Klaviyo/Printify), per-SKU & per-channel panels | not started |

**Verify Piece 1:** `npm install && npm run verify` (replays the three v1.4 sample days and
asserts every subtotal/margin/ratio + the zone logic), then `npm run dev` and check the
default screen reproduces the 2026-05-26 sample ($429 grand total, off-FB 4.05x, MER 3.24x).
