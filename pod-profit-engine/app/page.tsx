'use client';

import { useMemo, useState } from 'react';
import { runEngine, type EngineInputs, type Accent } from '@/lib/engine';

// ---- formatters -------------------------------------------------------------
const money = (v: number) => (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
const pct = (v: number) => (Math.round(v * 1000) / 10).toFixed(1) + '%';
const xf = (v: number) => (Math.round(v * 100) / 100).toFixed(2) + 'x';
const ACCENT: Record<Accent, string> = {
  red: 'var(--red)', gold: 'var(--gold)', green: 'var(--green)', faint: 'var(--faint)',
};
const CPC_COL = {
  'GOOD': 'var(--green)', 'OKAY': 'var(--gold)', 'FIX IT': 'var(--gold-d)', 'KILL IT': 'var(--red)',
} as const;

// Default = day 1 of the v1.4 sample (2026-05-26) — reproduces $429 grand total,
// off-FB ROAS 4.05x, MER 3.24x, etc. straight out of the box.
const DEFAULTS = {
  grossSales: '1850', shipping: '95', printifyCogs: '560', discounts: '120', refunds: '95',
  shopifyFees: '0', paypalFees: '48', adFacebook: '480', adGoogle: '0', adTiktok: '120',
  overhead: '133', printifyRebate: '28', cashback: '12',
  cpc: '0.52', aov: '30', cvrPct: '6.5', cartPct: '14.5', checkoutPct: '5.5',
  emailSharePct: '25', aovGoal: '45',
};
type Keys = keyof typeof DEFAULTS;

function Field(props: {
  label: string; hint?: string; pre?: string; post?: string; step?: string;
  value: string; onChange: (v: string) => void;
}) {
  const { label, hint, pre, post, step = '1', value, onChange } = props;
  return (
    <label className="field">
      <span className="t">{label}</span>
      <div className="inwrap">
        {pre && <span className="pre">{pre}</span>}
        <input
          className={pre ? 'pad-l' : post ? 'pad-r' : ''}
          type="number" step={step} inputMode="decimal"
          value={value} onChange={(e) => onChange(e.target.value)}
        />
        {post && <span className="post">{post}</span>}
      </div>
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export default function Page() {
  const [n, setN] = useState<Record<Keys, string>>(DEFAULTS);
  const [provisional, setProvisional] = useState(false);
  const [moreMoney, setMoreMoney] = useState(false);
  const set = (k: Keys) => (v: string) => setN((s) => ({ ...s, [k]: v }));

  const { waterfall: w, verdict: v } = useMemo(() => {
    const num = (k: Keys) => { const x = parseFloat(n[k]); return isNaN(x) ? 0 : x; };
    const input: EngineInputs = {
      grossSales: num('grossSales'), shipping: num('shipping'), printifyCogs: num('printifyCogs'),
      discounts: num('discounts'), refunds: num('refunds'), shopifyFees: num('shopifyFees'),
      paypalFees: num('paypalFees'), adFacebook: num('adFacebook'), adGoogle: num('adGoogle'),
      adTiktok: num('adTiktok'), overhead: num('overhead'), printifyRebate: num('printifyRebate'),
      cashback: num('cashback'), cpc: num('cpc'), aov: num('aov'), cvrPct: num('cvrPct'),
      cartPct: num('cartPct'), checkoutPct: num('checkoutPct'), emailSharePct: num('emailSharePct'),
      aovGoal: num('aovGoal'), provisional,
    };
    return runEngine(input);
  }, [n, provisional]);

  const accent = ACCENT[v.accent];

  return (
    <>
      <div className="top">
        <div className="brand"><span className="dot" />BEELAB</div>
        <div className="brand" style={{ color: 'var(--faint)' }}>PIECE 1</div>
      </div>
      <h1>POD Profit Verdict</h1>
      <div className="sub">Your money and your one move — on Heckman’s locked framework.</div>

      {/* ---------------- INPUTS ---------------- */}
      <div className="card">
        <div className="lbl">The money — this period</div>
        <div className="grid">
          <Field label="Gross sales" hint="Shopify sales" pre="$" value={n.grossSales} onChange={set('grossSales')} />
          <Field label="Shipping in" hint="charged to buyer" pre="$" value={n.shipping} onChange={set('shipping')} />
          <Field label="Product cost" hint="COGS (Printify)" pre="$" value={n.printifyCogs} onChange={set('printifyCogs')} />
          <Field label="Discounts" hint="codes / sales" pre="$" value={n.discounts} onChange={set('discounts')} />
          <Field label="Refunds" hint="returned to buyer" pre="$" value={n.refunds} onChange={set('refunds')} />
          <Field label="Overhead" hint="daily fixed cost" pre="$" value={n.overhead} onChange={set('overhead')} />
          <Field label="Ad — Facebook/IG" hint="Meta spend" pre="$" value={n.adFacebook} onChange={set('adFacebook')} />
          <Field label="Ad — Google" hint="Google spend" pre="$" value={n.adGoogle} onChange={set('adGoogle')} />
          <Field label="Ad — TikTok" hint="TikTok spend" pre="$" value={n.adTiktok} onChange={set('adTiktok')} />
          <Field label="Shopify fees" hint="merchant fee" pre="$" value={n.shopifyFees} onChange={set('shopifyFees')} />
        </div>

        <div className={'more-h' + (moreMoney ? ' open' : '')} onClick={() => setMoreMoney((o) => !o)}>
          <span className="chev">▸</span> More money detail
        </div>
        <div className={'more-body' + (moreMoney ? ' open' : '')}>
          <div className="grid" style={{ marginTop: 4 }}>
            <Field label="PayPal fees" hint="merchant fee" pre="$" value={n.paypalFees} onChange={set('paypalFees')} />
            <Field label="Printify rebate" hint="≈5% wallet" pre="$" value={n.printifyRebate} onChange={set('printifyRebate')} />
            <Field label="Card cashback" hint="≈2% card" pre="$" value={n.cashback} onChange={set('cashback')} />
          </div>
        </div>

        <div className="lbl mt">The funnel</div>
        <div className="grid">
          <Field label="CPC" hint="cost per click" pre="$" step="0.01" value={n.cpc} onChange={set('cpc')} />
          <Field label="AOV" hint="avg order value" pre="$" value={n.aov} onChange={set('aov')} />
          <Field label="Conversion rate" hint="visitors who buy" post="%" step="0.1" value={n.cvrPct} onChange={set('cvrPct')} />
          <Field label="AOV goal" hint="target $45+" pre="$" value={n.aovGoal} onChange={set('aovGoal')} />
          <Field label="Add to cart" hint="target 6–8%" post="%" step="0.1" value={n.cartPct} onChange={set('cartPct')} />
          <Field label="Reached checkout" hint="target 5–6%" post="%" step="0.1" value={n.checkoutPct} onChange={set('checkoutPct')} />
          <Field label="Email % of revenue" hint="target 20%+" post="%" value={n.emailSharePct} onChange={set('emailSharePct')} />
        </div>

        <div className={'prov' + (provisional ? ' on' : '')} onClick={() => setProvisional((o) => !o)}>
          <span className="box">{provisional ? '✓' : ''}</span>
          <span className="txt"><b>Provisional data.</b> Ad spend &amp; ROAS are intraday — they settle in 1–3 days. Flag it so the verdict reads as a draft.</span>
        </div>
      </div>

      {/* ---------------- MONEY PANEL ---------------- */}
      <div className="money">
        <div className="lbl">Net profit — grand total</div>
        <div className="netbig" style={{ color: w.grandTotalIncome >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {money(w.grandTotalIncome)}
        </div>
        <div className="netsub">{pct(w.grandTotalMargin)} net margin · {pct(w.operatingMargin)} operating margin</div>
        <div className="mdiv" />
        <div className="mrow"><div className="k">Money in <span className="sm">gross + shipping</span></div><div className="v">{money(w.totalGrossSales)}</div></div>
        <div className="mrow"><div className="k">Cost of sales <span className="sm">COGS + discounts + refunds</span></div><div className="v">{money(w.totalCostOfSales)}</div></div>
        <div className="mrow"><div className="k">Gross profit <span className="sm">{pct(w.grossMargin)} margin</span></div><div className="v">{money(w.grossProfit)}</div></div>
        <div className="mrow"><div className="k">Operating exp <span className="sm">fees + ads + overhead</span></div><div className="v">{money(w.totalOperatingExp)}</div></div>
        <div className="mrow"><div className="k">Operating income</div><div className="v">{money(w.operatingIncome)}</div></div>
        <div className="mrow"><div className="k">+ Additional income <span className="sm">rebate + cashback</span></div><div className="v">{money(w.totalAdditionalIncome)}</div></div>
        <div className="mdiv" />
        <div className="mrow big"><div className="k">ROI <span className="sm">per $1 of cash out</span></div>
          <div className="v" style={{ color: w.roi >= 0 ? 'var(--green)' : 'var(--red)' }}>{(w.roi >= 0 ? '+' : '') + Math.round(w.roi * 100)}%</div></div>
        <div className="mrow"><div className="k">Off-FB ROAS <span className="sm">gross ÷ FB</span></div><div className="v">{xf(w.offFbRoas)}</div></div>
        <div className="mrow"><div className="k">Blended MER <span className="sm">gross ÷ all ads</span></div><div className="v">{xf(w.blendedMer)}</div></div>
        <div className="mrow"><div className="k">COGS % · Overhead %</div><div className="v">{pct(w.cogsPct)} · {pct(w.overheadPct)}</div></div>
      </div>

      {/* ---------------- VERDICT ---------------- */}
      <div className="vcard" style={{ ['--accent' as string]: accent }}>
        <div className="roasrow">
          <div className="roasnum" style={{ color: accent }}>{v.zone === 'waiting' ? '--' : xf(v.roas)}</div>
          <div className="roaslbl">
            <b>Blended ROAS</b>
            <span style={{ color: CPC_COL[v.cpcState] }}>CPC: {v.cpcState}</span>
          </div>
        </div>
        <div className="badges">
          <span className="phase">{v.phase}</span>
          {v.provisional && <span className="provbadge">⚠ Provisional</span>}
        </div>
        <div className="verdict">{v.verdict}</div>
        {v.move && <div className="move" dangerouslySetInnerHTML={{ __html: v.move }} />}

        {v.checks.length > 0 && <div className="movelbl">The checklist</div>}
        <div className="checks">
          {v.checks.map((c, i) => (
            <div key={i} className={'chk ' + (c.ok ? 'pass' : 'fail')}>
              <div className="ico">{c.ok ? '✓' : '✕'}</div>
              <div className="nm">
                <span className={c.binding ? 'bind' : ''}>{c.name}{c.binding ? '  ← fix this first' : ''}</span>
              </div>
              <div className="val">{c.value}</div>
            </div>
          ))}
        </div>

        {v.budgetLadder && (
          <>
            <div className="movelbl">Budget ladder · per-campaign P7 ROAS</div>
            <div className="ladder">
              {v.budgetLadder.map((l, i) => (
                <div key={i} className="lr"><span className="rg">{l.range}</span><span className="ac">{l.action}</span></div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="foot">
        ROAS = (AOV × Conversion) ÷ CPC &nbsp;·&nbsp; Math by code, words by AI<br />
        Built on Heckman’s locked framework · matches data model v1.4
      </div>
    </>
  );
}
