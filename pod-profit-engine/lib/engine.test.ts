/**
 * Validation harness — proves the engine reproduces the v1.4 data model EXACTLY.
 *
 * Replays the three sample days from POD_Profit_Engine_DataModel_v1.4 (Daily P&L
 * tab) and asserts every waterfall subtotal, margin, diagnostic ratio, and the
 * derived funnel stats against the workbook's own computed cells.
 *
 * Run:  npm run verify     (uses tsx)
 */
import assert from 'node:assert';
import {
  computeWaterfall, deriveFunnel, cpcGate, computeVerdict,
  type MoneyInputs, type FunnelInputs,
} from './engine';

let passed = 0;
const near = (got: number, want: number, label: string, eps = 1e-6) => {
  assert.ok(Math.abs(got - want) <= eps, `${label}: got ${got}, want ${want}`);
  passed++;
};
const eq = (got: unknown, want: unknown, label: string) => {
  assert.strictEqual(got, want, `${label}: got ${got}, want ${want}`);
  passed++;
};

// --- Sample days, exactly as in the v1.4 Daily P&L tab -----------------------
interface Sample {
  m: MoneyInputs;
  counts: { impressions: number; clicks: number; sessions: number; addToCart: number; orders: number; returns: number };
  expect: {
    totalGrossSales: number; grossProfit: number; operatingIncome: number; grandTotalIncome: number;
    operatingMargin: number; grandTotalMargin: number; cogsPct: number; overheadPct: number;
    offFbRoas: number; blendedMer: number;
    ctr: number; cpc: number; cvr: number; aov: number; cpa: number;
  };
}

const days: Sample[] = [
  { // 2026-05-26
    m: { grossSales:1850, shipping:95, printifyCogs:560, discounts:120, refunds:95, shopifyFees:0, paypalFees:48, adFacebook:480, adGoogle:0, adTiktok:120, overhead:133, printifyRebate:28, cashback:12 },
    counts: { impressions:92000, clicks:1150, sessions:980, addToCart:142, orders:64, returns:3 },
    expect: { totalGrossSales:1945, grossProfit:1170, operatingIncome:389, grandTotalIncome:429,
      operatingMargin:0.20005141388, grandTotalMargin:0.22056555269, cogsPct:0.28791774, overheadPct:0.06838046,
      offFbRoas:4.05208333333, blendedMer:3.24166666667,
      ctr:0.0125, cpc:0.52173913043, cvr:0.06530612245, aov:30.390625, cpa:9.375 },
  },
  { // 2026-05-27
    m: { grossSales:2240, shipping:110, printifyCogs:640, discounts:150, refunds:60, shopifyFees:56, paypalFees:45, adFacebook:560, adGoogle:0, adTiktok:140, overhead:133, printifyRebate:32, cashback:14 },
    counts: { impressions:105000, clicks:1180, sessions:1010, addToCart:150, orders:78, returns:2 },
    expect: { totalGrossSales:2350, grossProfit:1500, operatingIncome:566, grandTotalIncome:612,
      operatingMargin:0.24085106383, grandTotalMargin:0.26042553191, cogsPct:0.27234042553, overheadPct:0.05659574468,
      offFbRoas:4.19642857143, blendedMer:3.35714285714,
      ctr:0.01123809524, cpc:0.59322033898, cvr:0.07722772277, aov:30.12820512821, cpa:8.97435897436 },
  },
  { // 2026-05-28 — deliberate bleed day
    m: { grossSales:1390, shipping:70, printifyCogs:410, discounts:90, refunds:140, shopifyFees:53, paypalFees:30, adFacebook:520, adGoogle:0, adTiktok:130, overhead:133, printifyRebate:20, cashback:12 },
    counts: { impressions:98000, clicks:760, sessions:690, addToCart:88, orders:41, returns:5 },
    expect: { totalGrossSales:1460, grossProfit:820, operatingIncome:-46, grandTotalIncome:-14,
      operatingMargin:-0.03150684932, grandTotalMargin:-0.00958904110, cogsPct:0.28082191781, overheadPct:0.09109589041,
      offFbRoas:2.80769230769, blendedMer:2.24615384615,
      ctr:0.00775510204, cpc:0.85526315789, cvr:0.05942028986, aov:35.6097560976, cpa:15.8536585366 },
  },
];

days.forEach((day, i) => {
  const w = computeWaterfall(day.m);
  const e = day.expect;
  const eps = 1e-4;
  near(w.totalGrossSales, e.totalGrossSales, `D${i+1} totalGrossSales`);
  near(w.grossProfit, e.grossProfit, `D${i+1} grossProfit`);
  near(w.operatingIncome, e.operatingIncome, `D${i+1} operatingIncome`);
  near(w.grandTotalIncome, e.grandTotalIncome, `D${i+1} grandTotalIncome`);
  near(w.operatingMargin, e.operatingMargin, `D${i+1} operatingMargin`, eps);
  near(w.grandTotalMargin, e.grandTotalMargin, `D${i+1} grandTotalMargin`, eps);
  near(w.cogsPct, e.cogsPct, `D${i+1} cogsPct`, eps);
  near(w.overheadPct, e.overheadPct, `D${i+1} overheadPct`, eps);
  near(w.offFbRoas, e.offFbRoas, `D${i+1} offFbRoas`, eps);
  near(w.blendedMer, e.blendedMer, `D${i+1} blendedMer`, eps);

  const fn = deriveFunnel({ ...day.counts, totalAdvertising: w.totalAdvertising, totalGrossSales: w.totalGrossSales });
  near(fn.ctr, e.ctr, `D${i+1} ctr`, eps);
  near(fn.cpc, e.cpc, `D${i+1} cpc`, eps);
  near(fn.cvr, e.cvr, `D${i+1} cvr`, eps);
  near(fn.aov, e.aov, `D${i+1} aov`, eps);
  near(fn.cpa, e.cpa, `D${i+1} cpa`, eps);
});

// --- CPC gatekeeper bands (Road to Breakeven Step 1) -------------------------
eq(cpcGate(0.60), 'GOOD', 'cpc 0.60');
eq(cpcGate(0.75), 'GOOD', 'cpc 0.75');
eq(cpcGate(0.90), 'OKAY', 'cpc 0.90');
eq(cpcGate(1.00), 'OKAY', 'cpc 1.00');
eq(cpcGate(1.25), 'FIX IT', 'cpc 1.25');
eq(cpcGate(1.50), 'FIX IT', 'cpc 1.50');
eq(cpcGate(1.75), 'KILL IT', 'cpc 1.75');

// --- The four ROAS zones, incl. the filled 2.0–2.5 hole ----------------------
const baseFunnel: FunnelInputs = { cpc:0.50, aov:45, cvrPct:3.0, cartPct:7, checkoutPct:5.5, emailSharePct:25, aovGoal:45 };
const zoneFor = (roasTarget: number, over: Partial<FunnelInputs> = {}, netMargin = 0.20) => {
  // Solve cvrPct so that (aov*cvr)/cpc = roasTarget, with default aov/cpc.
  const f = { ...baseFunnel, ...over };
  f.cvrPct = (roasTarget * f.cpc / f.aov) * 100;
  const w = computeWaterfall({ grossSales:1000, shipping:0, printifyCogs:0, discounts:0, refunds:0,
    shopifyFees:0, paypalFees:0, adFacebook:0, adGoogle:0, adTiktok:0,
    overhead:1000 * (1 - netMargin), printifyRebate:0, cashback:0 });
  return computeVerdict(f, w, false);
};
eq(zoneFor(1.5).zone, 'breakeven', 'ROAS 1.5 → road to breakeven');
eq(zoneFor(1.5).verdict, 'NOT AT BREAKEVEN', 'ROAS 1.5 verdict');
eq(zoneFor(2.2).zone, 'optimize', 'ROAS 2.2 → optimize (the filled hole)');
eq(zoneFor(2.2).binding, 'roas', 'ROAS 2.2 binding = roas');
eq(zoneFor(2.7).zone, 'scaling', 'ROAS 2.7 → scaling');
eq(zoneFor(2.7, {}, 0.20).verdict, 'SCALE', 'ROAS 2.7 all gates pass → SCALE');
eq(zoneFor(2.7, {}, 0.10).verdict, 'DON’T SCALE YET', 'ROAS 2.7 but margin<15% → don’t scale');
eq(zoneFor(2.7, {}, 0.10).binding, 'margin', 'ROAS 2.7 low margin → binding margin');
eq(zoneFor(2.7, { emailSharePct: 10 }, 0.20).binding, 'email', 'ROAS 2.7 low email → binding email');

// --- Provisional flag (hole #4) ---------------------------------------------
const prov = computeVerdict(baseFunnel, computeWaterfall({ grossSales:1000, shipping:0, printifyCogs:0, discounts:0, refunds:0, shopifyFees:0, paypalFees:0, adFacebook:0, adGoogle:0, adTiktok:0, overhead:800, printifyRebate:0, cashback:0 }), true);
eq(prov.provisional, true, 'provisional flag carried into verdict');

console.log(`\n  ✓ All ${passed} assertions passed — engine matches v1.4 data model.\n`);
