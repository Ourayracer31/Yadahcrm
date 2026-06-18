/**
 * POD Profit Engine — deterministic verdict brain.
 *
 * Non-negotiable principle (BUILD_SPEC §2.1): Math by code, words by AI.
 * Every number and every pass/fail gate in this file is deterministic.
 * Nothing here is AI-guessed or approximated.
 *
 * The money math reproduces the Heckman waterfall from the v1.4 data model
 * (POD_Profit_Engine_DataModel_v1.4) EXACTLY. See engine.test.ts, which
 * replays the three sample days from that workbook and asserts every
 * subtotal, margin and ratio.
 *
 * ROAS is computed the Heckman way (BUILD_SPEC §2.3):
 *   ROAS = (AOV × Conversion Rate) ÷ CPC
 * never the platform's self-reported number.
 */

// ----------------------------------------------------------------------------
// Inputs
// ----------------------------------------------------------------------------

/** Raw dollar inputs — the "blue" cells of the v1.4 Daily P&L (agent/operator fetches). */
export interface MoneyInputs {
  grossSales: number;     // Shopify Gross Sales
  shipping: number;       // Shopify Shipping (income — charged to buyer, added to gross)
  printifyCogs: number;   // Printify Charge (COGS), per-order base cost
  discounts: number;      // Shopify Discounts  (contra-revenue / platform cost)
  refunds: number;        // Shopify Refunds    (contra-revenue / platform cost) — HOLE #3 filled
  shopifyFees: number;    // Merchant fees (Shopify)
  paypalFees: number;     // Merchant fees (PayPal)
  adFacebook: number;     // Ad - Facebook/IG
  adGoogle: number;       // Ad - Google
  adTiktok: number;       // Ad - TikTok
  overhead: number;       // Overhead Expenses (daily slice of fixed cost)
  printifyRebate: number; // Printify 5% Rebate  (additional income)
  cashback: number;       // Capital One 2% Cashback (additional income)
}

/**
 * Funnel inputs. In Manual mode these are entered as percentages / dollars
 * (beginner-simple). `deriveFunnel` below shows the same numbers can be
 * derived from raw counts, matching the v1.4 Traffic & Funnel block exactly.
 */
export interface FunnelInputs {
  cpc: number;          // $ cost per click
  aov: number;          // $ average order value
  cvrPct: number;       // % conversion rate (orders ÷ sessions)
  cartPct: number;      // % add to cart   (target 6–8%)   — HOLE #2 (real gate)
  checkoutPct: number;  // % reached checkout (target 5–6%) — HOLE #2 (real gate)
  emailSharePct: number;// % email share of revenue (target 20%+)
  aovGoal: number;      // $ AOV target (default 45)
}

export interface EngineInputs extends MoneyInputs, FunnelInputs {
  /** Intraday / unsettled ad + ROAS data (settles in 1–3 days). HOLE #4 filled. */
  provisional: boolean;
}

// ----------------------------------------------------------------------------
// Money waterfall — reproduces v1.4 Daily P&L exactly
// ----------------------------------------------------------------------------

export interface Waterfall {
  totalGrossSales: number;     // Gross Sales + Shipping
  totalCogs: number;           // Printify Charge
  totalPlatformCosts: number;  // Discounts + Refunds
  totalCostOfSales: number;    // COGS + Platform Costs
  grossProfit: number;         // Gross Sales − Cost of Sales
  totalMerchantFees: number;   // Shopify + PayPal fees
  totalAdvertising: number;    // FB + Google + TikTok
  totalGeneralExp: number;     // Overhead
  totalOperatingExp: number;   // Merchant Fees + Advertising + General
  operatingIncome: number;     // Gross Profit − Operating Exp
  totalAdditionalIncome: number; // Rebate + Cashback
  grandTotalIncome: number;    // Operating Income + Additional Income  (= net profit)

  // Stats / diagnostic ratios (v1.4 "STATS")
  operatingMargin: number;     // Operating Income ÷ Total Gross Sales
  grandTotalMargin: number;    // Grand Total Income ÷ Total Gross Sales (net margin)
  grossMargin: number;         // Gross Profit ÷ Total Gross Sales
  cogsPct: number;             // COGS ÷ Total Gross Sales
  overheadPct: number;         // Overhead ÷ Total Gross Sales
  offFbRoas: number;           // Total Gross Sales ÷ FB ad spend
  blendedMer: number;          // Total Gross Sales ÷ Total Advertising
  roi: number;                 // Grand Total Income ÷ all cash out (cost of sales + opex)
}

export function computeWaterfall(m: MoneyInputs): Waterfall {
  const totalGrossSales = m.grossSales + m.shipping;
  const totalCogs = m.printifyCogs;
  const totalPlatformCosts = m.discounts + m.refunds;
  const totalCostOfSales = totalCogs + totalPlatformCosts;
  const grossProfit = totalGrossSales - totalCostOfSales;
  const totalMerchantFees = m.shopifyFees + m.paypalFees;
  const totalAdvertising = m.adFacebook + m.adGoogle + m.adTiktok;
  const totalGeneralExp = m.overhead;
  const totalOperatingExp = totalMerchantFees + totalAdvertising + totalGeneralExp;
  const operatingIncome = grossProfit - totalOperatingExp;
  const totalAdditionalIncome = m.printifyRebate + m.cashback;
  const grandTotalIncome = operatingIncome + totalAdditionalIncome;

  const safeDiv = (a: number, b: number) => (b !== 0 ? a / b : 0);
  const allCashOut = totalCostOfSales + totalOperatingExp;

  return {
    totalGrossSales, totalCogs, totalPlatformCosts, totalCostOfSales, grossProfit,
    totalMerchantFees, totalAdvertising, totalGeneralExp, totalOperatingExp,
    operatingIncome, totalAdditionalIncome, grandTotalIncome,
    operatingMargin: safeDiv(operatingIncome, totalGrossSales),
    grandTotalMargin: safeDiv(grandTotalIncome, totalGrossSales),
    grossMargin: safeDiv(grossProfit, totalGrossSales),
    cogsPct: safeDiv(totalCogs, totalGrossSales),
    overheadPct: safeDiv(totalGeneralExp, totalGrossSales),
    offFbRoas: safeDiv(totalGrossSales, m.adFacebook),
    blendedMer: safeDiv(totalGrossSales, totalAdvertising),
    roi: safeDiv(grandTotalIncome, allCashOut),
  };
}

// ----------------------------------------------------------------------------
// Funnel — derive the v1.4 Traffic & Funnel stats from raw counts
// (used to prove the math; Manual mode enters rates directly)
// ----------------------------------------------------------------------------

export interface FunnelCounts {
  impressions: number;
  clicks: number;
  sessions: number;   // excl. bots
  addToCart: number;
  orders: number;
  returns: number;
  totalAdvertising: number;
  totalGrossSales: number;
}

export interface DerivedFunnel {
  ctr: number;       // Clicks ÷ Impressions
  cpc: number;       // Total Advertising ÷ Clicks
  cvr: number;       // Orders ÷ Sessions
  aov: number;       // Total Gross Sales ÷ Orders
  cpa: number;       // Total Advertising ÷ Orders
  cartRate: number;  // Add to Cart ÷ Sessions
  returnRate: number;// Returns ÷ Orders
}

export function deriveFunnel(c: FunnelCounts): DerivedFunnel {
  const d = (a: number, b: number) => (b !== 0 ? a / b : 0);
  return {
    ctr: d(c.clicks, c.impressions),
    cpc: d(c.totalAdvertising, c.clicks),
    cvr: d(c.orders, c.sessions),
    aov: d(c.totalGrossSales, c.orders),
    cpa: d(c.totalAdvertising, c.orders),
    cartRate: d(c.addToCart, c.sessions),
    returnRate: d(c.returns, c.orders),
  };
}

// ----------------------------------------------------------------------------
// The Heckman verdict brain
// ----------------------------------------------------------------------------

export type Zone = 'waiting' | 'breakeven' | 'optimize' | 'scaling';
export type CpcState = 'GOOD' | 'OKAY' | 'FIX IT' | 'KILL IT';
export type Accent = 'red' | 'gold' | 'green' | 'faint';

export interface Check {
  ok: boolean;
  name: string;
  value: string;
  binding: boolean; // the single thing to fix first
}

export interface Verdict {
  roas: number;            // blended ROAS = (AOV × CVR) ÷ CPC
  cpcState: CpcState;
  zone: Zone;
  phase: string;
  verdict: string;
  accent: Accent;
  move: string;
  binding: string;
  checks: Check[];
  provisional: boolean;
  /** Per-campaign P7-ROAS budget ladder — shown only when the Scale Gate passes. */
  budgetLadder?: { range: string; action: string }[];
}

/** CPC gatekeeper bands — v1.4 "Road to Breakeven", Step 1. */
export function cpcGate(cpc: number): CpcState {
  if (cpc <= 0.75) return 'GOOD';   // $0.50–0.75 GOOD (below 0.50 still good)
  if (cpc <= 1.0) return 'OKAY';    // $0.75–1.00 OKAY
  if (cpc <= 1.5) return 'FIX IT';  // $1.00–1.50 FIX IT
  return 'KILL IT';                 // $1.50+ KILL IT
}

const BUDGET_LADDER = [
  { range: 'P7 ROAS 2.5+', action: 'Increase budget 20%' },
  { range: '2.2 – 2.4', action: 'Increase 15%' },
  { range: '2.0 – 2.2', action: 'Hold 0%' },
  { range: '1.8 – 2.0', action: 'Hold 0%' },
  { range: '1.6 – 1.8', action: 'Reduce 15%' },
  { range: '< 1.6', action: 'Reduce 20%' },
];

/**
 * The locked Heckman framework, three ROAS zones:
 *   ROAS < 2.0            → Road to Breakeven (find the broken number)
 *   2.0 ≤ ROAS < 2.5      → Past breakeven, below the scale line  ← HOLE #1 filled
 *   ROAS ≥ 2.5            → Scaling phase (run the 4 gates, then Scale Gate)
 */
export function computeVerdict(f: FunnelInputs, w: Waterfall, provisional: boolean): Verdict {
  const cpc = f.cpc;
  const aov = f.aov;
  const cvr = f.cvrPct / 100;
  const cart = f.cartPct / 100;
  const checkout = f.checkoutPct / 100;
  const email = f.emailSharePct / 100;
  const aovGoal = f.aovGoal;
  const netM = w.grandTotalMargin;

  const roas = cpc > 0 ? (aov * cvr) / cpc : 0;
  const cpcState = cpcGate(cpc);
  const pct = (v: number, dp = 1) => (v * 100).toFixed(dp) + '%';
  const x = (v: number) => v.toFixed(2) + 'x';

  // Waiting — no spend entered yet.
  if (cpc <= 0) {
    return {
      roas, cpcState, zone: 'waiting', phase: 'Waiting', verdict: 'ENTER YOUR NUMBERS',
      accent: 'faint', move: '', binding: '', checks: [], provisional,
    };
  }

  // ---- Zone 1: Road to Breakeven (ROAS < 2.0) ----
  if (roas < 2.0) {
    let binding: string, move: string;
    if (cpc > 1) {
      binding = 'cpc';
      move = 'Fix the ad. CPC is over $1 — your creative isn’t stopping the scroll. Test new mockups and designs to get it under $1.';
    } else if (cvr < 0.03 || cart < 0.06 || checkout < 0.05) {
      binding = 'funnel';
      move = 'Fix the store. People click but don’t buy — the page or checkout is breaking trust. Better photos, descriptions, trust signals, faster checkout.';
    } else if (aov < aovGoal) {
      binding = 'aov';
      move = 'Fix the offer. They’re buying one cheap thing. Bundles, upsells, free-shipping threshold, or raise prices to lift AOV.';
    } else {
      binding = 'cost';
      move = 'Fix the cost structure. Funnel looks fine but the math doesn’t work — audit COGS and fees, keep pushing AOV.';
    }
    return {
      roas, cpcState, zone: 'breakeven', phase: 'Road to breakeven',
      verdict: 'NOT AT BREAKEVEN', accent: 'red', move, binding, provisional,
      checks: [
        { ok: cpc <= 1, name: 'CPC under $1', value: '$' + cpc.toFixed(2), binding: binding === 'cpc' },
        { ok: cart >= 0.06, name: 'Add to cart 6%+', value: pct(cart), binding: binding === 'funnel' },
        { ok: checkout >= 0.05, name: 'Reached checkout 5%+', value: pct(checkout), binding: false },
        { ok: cvr >= 0.03, name: 'Conversion 3%+', value: pct(cvr, 2), binding: false },
        { ok: aov >= aovGoal, name: 'AOV $' + aovGoal + '+', value: '$' + aov.toFixed(0), binding: binding === 'aov' },
      ],
    };
  }

  // The four Scaling-Protocol gates (used by zones 2 and 3).
  const g1 = roas >= 2.5;     // Gate 1: Overall ROAS (P7) — pass line 2.5
  const g2 = email >= 0.20;   // Gate 2: Email share of revenue
  const g3 = netM >= 0.15;    // Gate 3: Net Profit Margin
  const g4 = cvr >= 0.02;     // Gate 4: Store CVR
  const gateChecks: Check[] = [
    { ok: g1, name: 'ROAS 2.5+', value: x(roas), binding: false },
    { ok: g2, name: 'Email 20%+', value: (email * 100).toFixed(0) + '%', binding: false },
    { ok: g3, name: 'Net margin 15%+', value: pct(netM), binding: false },
    { ok: g4, name: 'CVR 2%+', value: pct(cvr, 2), binding: false },
  ];

  // ---- Zone 2: Past breakeven but below the scale line (2.0 ≤ ROAS < 2.5) ---- HOLE #1
  if (roas < 2.5) {
    gateChecks[0].binding = true; // ROAS is the thing to push
    return {
      roas, cpcState, zone: 'optimize', phase: 'Past breakeven · below scale line',
      verdict: 'HOLD — DON’T SCALE YET', accent: 'gold', binding: 'roas',
      move: 'You’re past breakeven but under the 2.5 scale line. Don’t add budget yet — tighten creative and the funnel to push ROAS to 2.5+ first. Hold spend (budget ladder says hold from 2.0–2.2).',
      checks: gateChecks, provisional,
    };
  }

  // ---- Zone 3: Scaling phase (ROAS ≥ 2.5) ----
  if (g1 && g2 && g3 && g4) {
    return {
      roas, cpcState, zone: 'scaling', phase: 'Scaling phase', verdict: 'SCALE', accent: 'green',
      binding: '', provisional,
      move: 'Green light. Raise winning campaigns by the budget ladder, then re-check every 2–3 days, skip Mon/Tue.',
      checks: gateChecks, budgetLadder: BUDGET_LADDER,
    };
  }

  // Scale Gate failed on a non-ROAS gate — fix the first broken one.
  let binding: string, move: string;
  if (!g2) {
    binding = 'email';
    move = 'Build email first. Under 20% of revenue. Add abandon + post-purchase flows and 2–3 campaigns a week before more spend.';
    gateChecks[1].binding = true;
  } else if (!g3) {
    binding = 'margin';
    move = 'Plug the margin leak first. Net margin under 15%. Audit COGS, shipping and fees, raise AOV before more spend.';
    gateChecks[2].binding = true;
  } else {
    binding = 'cvr';
    move = 'Lift conversion first. CVR under 2%. Fix the product page and checkout before scaling.';
    gateChecks[3].binding = true;
  }
  return {
    roas, cpcState, zone: 'scaling', phase: 'Scaling phase', verdict: 'DON’T SCALE YET',
    accent: 'gold', binding, move, checks: gateChecks, provisional,
  };
}

export interface EngineResult {
  waterfall: Waterfall;
  verdict: Verdict;
}

export function runEngine(input: EngineInputs): EngineResult {
  const waterfall = computeWaterfall(input);
  const verdict = computeVerdict(input, waterfall, input.provisional);
  return { waterfall, verdict };
}
