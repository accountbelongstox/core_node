/**
 * OkxBacktestPanel — the OKX backtest surface. This lives ONLY in /vortex (the
 * "OKX 回测" tab in VortexApp.tsx) — the crypto backtest belongs to the Vortex app,
 * NOT the /pycore-manager operator panel. (A PcOkxMarketPage once mirrored it there;
 * it was removed 2026-06-20 — do not re-add an OKX page to pycore-manager.)
 *
 * Talks to the pycore OKX market-data service over the shared HTTP interface
 * using the centralized Vortex controller and event-topic constants. Nothing fetches until the user
 * presses "填充回测数据 / Fill backtest data", which kicks off the rate-limited
 * gap-fill + catch-up on the backend; live progress streams through HTTP events.
 * seeded from the in-memory DB pycore loaded on startup, with a localStorage cache
 * fallback + a "pycore unreachable" banner (the PcQueueManagerPage pattern).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, Square, RefreshCw, AlertTriangle, Database, TrendingUp, Sparkles, Clock,
  Search, X, ArrowUpDown, ArrowUp, ArrowDown, Download, CandlestickChart, Zap, Table2, LayoutGrid,
  Filter as FilterIcon, Layers, LineChart, ZoomIn,
} from 'lucide-react';
import { connectPycoreHttp, subscribe, requestPycoreHttp, onHttpStatus } from '../../core/api-libs/pycore';
import { VORTEX_PYCORE_EVENT_TOPICS } from '../../core/api-libs/pycore/PycoreEventTopics';
import { VORTEX_PYCORE_HTTP_ROUTES } from '../../core/api-libs/pycore/PycoreHttpRoutes';

/**
 * Adaptive OHLC chart for a coin's candles ([ts,o,h,l,c,vol,...], oldest→newest).
 * Renders real candlesticks when the set is small enough to be legible & cheap
 * (<=300), otherwise a single close-price area polyline (fast at thousands of pts).
 */
const CandleChart: React.FC<{ candles: number[][] }> = ({ candles }) => {
  if (!candles.length) return <div className="h-44 flex items-center justify-center text-xs text-slate-500">—</div>;
  const W = 1000, H = 180, pad = 4;
  const hi = Math.max(...candles.map((c) => c[2]));
  const lo = Math.min(...candles.map((c) => c[3]));
  const span = hi - lo || 1;
  const y = (v: number) => pad + (1 - (v - lo) / span) * (H - 2 * pad);
  const n = candles.length;

  if (n <= 300) {
    const slot = (W - 2 * pad) / n;
    const bw = Math.max(1, slot * 0.62);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-44">
        {candles.map((c, i) => {
          const o = c[1], cl = c[4];
          const up = cl >= o;
          const col = up ? '#10b981' : '#f43f5e';
          const cx = pad + slot * (i + 0.5);
          const yo = y(o), yc = y(cl);
          const top = Math.min(yo, yc), bh = Math.max(0.8, Math.abs(yc - yo));
          return (
            <g key={i}>
              <line x1={cx} x2={cx} y1={y(c[2])} y2={y(c[3])} stroke={col} strokeWidth="0.7" />
              <rect x={cx - bw / 2} y={top} width={bw} height={bh} fill={col} />
            </g>
          );
        })}
      </svg>
    );
  }
  const closes = candles.map((c) => c[4]);
  const x = (i: number) => pad + (i / (n - 1 || 1)) * (W - 2 * pad);
  const pts = closes.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const up = closes[n - 1] >= closes[0];
  const stroke = up ? '#10b981' : '#f43f5e';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-44">
      <polygon points={`${pad},${H - pad} ${pts} ${W - pad},${H - pad}`}
        fill={up ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)'} />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

/**
 * Tiny inline sparkline from a flat close-price series (oldest→newest). Green when
 * the series closes up, rose when down. Renders nothing legible for <2 points.
 */
const Sparkline: React.FC<{ series: number[] }> = ({ series }) => {
  if (!series || series.length < 2) {
    return <div className="h-10 flex items-center justify-center text-[10px] text-slate-600">—</div>;
  }
  const W = 120, H = 36, pad = 2;
  const hi = Math.max(...series);
  const lo = Math.min(...series);
  const span = hi - lo || 1;
  const n = series.length;
  const x = (i: number) => pad + (i / (n - 1)) * (W - 2 * pad);
  const y = (v: number) => pad + (1 - (v - lo) / span) * (H - 2 * pad);
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const up = series[n - 1] >= series[0];
  const stroke = up ? '#10b981' : '#f43f5e';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-10">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

// Stable per-symbol color (hash → HSL) so a coin keeps its colour across redraws.
const colorOf = (id: string): string => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return `hsl(${h % 360} 70% 55%)`;
};

/**
 * High-performance multi-coin COMPARISON chart on a single <canvas>. Overlays every
 * coin's close series in ONE draw pass (canvas, not SVG — hundreds of series × hundreds
 * of points would be tens of thousands of DOM nodes and stall). mode 'change' normalizes
 * each series to % vs the visible window's start (relative-performance compare); 'price'
 * plots raw closes. Mouse WHEEL zooms the x-range around the cursor, DRAG pans left/right,
 * hover highlights the nearest coin + shows its label. Index x-axis (bars-ago), DPR-aware.
 */
const CompareChart: React.FC<{
  series: Record<string, number[]>;
  mode: 'change' | 'price';
  dark: boolean;
  height?: number;
  emptyText: string;
  selected?: string | null;                 // externally-highlighted coin (legend/dashboard pick)
  onPick?: (id: string | null) => void;     // click a line -> select it
  focus?: { lo: number; hi: number } | null; // jump/zoom the view to a bar-index segment
}> = ({ series, mode, dark, height = 380, emptyText, selected, onPick, focus }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ids = useMemo(
    () => Object.keys(series).filter((id) => (series[id]?.length ?? 0) > 1), [series]);
  const maxLen = useMemo(
    () => ids.reduce((m, id) => Math.max(m, series[id].length), 0), [ids, series]);
  const [vr, setVr] = useState<{ lo: number; hi: number }>({ lo: 0, hi: 1 });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ x: number; lo: number; hi: number } | null>(null);
  const movedRef = useRef(false);          // distinguishes a click from a drag-pan
  const nearIdRef = useRef<string | null>(null); // last nearest-to-cursor id (for click-pick)
  const PADL = 46, PADR = 10, PADT = 10, PADB = 22;

  // reset the view to the full range whenever the data shape changes
  useEffect(() => { setVr({ lo: 0, hi: Math.max(1, maxLen - 1) }); }, [maxLen]);
  // jump/zoom to an external focus segment (e.g. a coin's most-volatile window)
  useEffect(() => {
    if (focus && maxLen > 1) {
      const lo = Math.max(0, Math.min(maxLen - 2, focus.lo));
      const hi = Math.max(lo + 1, Math.min(maxLen - 1, focus.hi));
      setVr({ lo, hi });
    }
  }, [focus, maxLen]);

  const draw = useCallback(() => {
    const cv = canvasRef.current, wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = wrap.clientWidth || 600, H = height;
    cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!ids.length || maxLen < 2) {
      ctx.fillStyle = dark ? '#475569' : '#94a3b8'; ctx.font = '12px monospace';
      ctx.textAlign = 'center'; ctx.fillText(emptyText, W / 2, H / 2); ctx.textAlign = 'left';
      return;
    }
    const plotW = W - PADL - PADR, plotH = H - PADT - PADB;
    const lo = Math.max(0, Math.floor(vr.lo)), hi = Math.min(maxLen - 1, Math.ceil(vr.hi));
    const norm = (arr: number[], i: number): number => {
      if (mode === 'change') { const b = arr[Math.min(lo, arr.length - 1)] || arr[0]; return b ? (arr[i] / b - 1) * 100 : 0; }
      return arr[i];
    };
    let ymin = Infinity, ymax = -Infinity;
    for (const id of ids) { const a = series[id]; for (let i = lo; i <= hi && i < a.length; i++) { const v = norm(a, i); if (v < ymin) ymin = v; if (v > ymax) ymax = v; } }
    if (!isFinite(ymin) || !isFinite(ymax)) { ymin = 0; ymax = 1; }
    if (ymin === ymax) { ymin -= 1; ymax += 1; }
    const yp = (ymax - ymin) * 0.06; ymin -= yp; ymax += yp;
    const xToPx = (i: number) => PADL + ((i - vr.lo) / ((vr.hi - vr.lo) || 1)) * plotW;
    const yToPx = (v: number) => PADT + (1 - (v - ymin) / ((ymax - ymin) || 1)) * plotH;
    // grid + y labels
    ctx.lineWidth = 1; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    for (let g = 0; g <= 4; g++) {
      const yv = ymin + (ymax - ymin) * g / 4, py = yToPx(yv);
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
      ctx.beginPath(); ctx.moveTo(PADL, py); ctx.lineTo(W - PADR, py); ctx.stroke();
      ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
      ctx.fillText(mode === 'change' ? `${yv.toFixed(1)}%` : `${yv.toPrecision(3)}`, 2, py + 3);
    }
    if (mode === 'change' && ymin < 0 && ymax > 0) {
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
      const z = yToPx(0); ctx.beginPath(); ctx.moveTo(PADL, z); ctx.lineTo(W - PADR, z); ctx.stroke();
    }
    // nearest series under the cursor (for click-pick + hover label)
    let nearId: string | null = null;
    if (hover && hover.x > PADL && hover.x < W - PADR) {
      const fi = vr.lo + ((hover.x - PADL) / (plotW || 1)) * (vr.hi - vr.lo);
      const i = Math.max(lo, Math.min(hi, Math.round(fi)));
      let best = Infinity;
      for (const id of ids) { const a = series[id]; if (i < a.length) { const d = Math.abs(yToPx(norm(a, i)) - hover.y); if (d < best) { best = d; nearId = id; } } }
    }
    nearIdRef.current = nearId;
    // the line to emphasize: the hovered one, else the externally-selected one
    const hl = nearId || selected || null;
    // series (dim the rest when one is highlighted)
    for (const id of ids) {
      const a = series[id], hot = id === hl;
      ctx.strokeStyle = colorOf(id);
      ctx.globalAlpha = hl && !hot ? 0.16 : 0.9;
      ctx.lineWidth = hot ? 2.2 : 1;
      ctx.beginPath(); let started = false;
      for (let i = lo; i <= hi && i < a.length; i++) { const px = xToPx(i), py = yToPx(norm(a, i)); if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // crosshair (hover) + label for the highlighted coin
    if (hover && hover.x > PADL && hover.x < W - PADR) {
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.moveTo(hover.x, PADT); ctx.lineTo(hover.x, H - PADB); ctx.stroke();
    }
    if (hl && series[hl]) {
      const cx = hover && hover.x > PADL && hover.x < W - PADR ? hover.x : W - PADR - 4;
      const i = Math.max(lo, Math.min(hi, Math.round(vr.lo + ((cx - PADL) / (plotW || 1)) * (vr.hi - vr.lo))));
      const v = norm(series[hl], i);
      const label = `${hl}  ${mode === 'change' ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : v.toPrecision(5)}`;
      ctx.font = '11px monospace'; const tw = ctx.measureText(label).width;
      const bx = Math.min(W - PADR - tw - 8, Math.max(PADL, (hover ? hover.x : cx) + 8));
      ctx.fillStyle = dark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.92)';
      ctx.fillRect(bx, PADT + 2, tw + 8, 16);
      ctx.fillStyle = colorOf(hl); ctx.fillText(label, bx + 4, PADT + 13);
    }
  }, [ids, series, mode, dark, vr, maxLen, height, hover, emptyText, selected]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const on = () => draw();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [draw]);

  // Wheel zoom via a NATIVE non-passive listener (React's onWheel is passive, so it can't
  // preventDefault) — reads live state through refs to avoid stale closures.
  const vrRef = useRef(vr); vrRef.current = vr;
  const maxLenRef = useRef(maxLen); maxLenRef.current = maxLen;
  useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const ml = maxLenRef.current; if (ml < 2) return;
      const rect = wrap.getBoundingClientRect();
      const plotW = rect.width - PADL - PADR;
      const fx = Math.max(0, Math.min(1, (e.clientX - rect.left - PADL) / (plotW || 1)));
      const v = vrRef.current, cur = v.hi - v.lo, factor = e.deltaY > 0 ? 1.18 : 0.84;
      const span = Math.min(ml - 1, Math.max(3, cur * factor));
      const center = v.lo + fx * cur;
      let lo = center - fx * span, hi = lo + span;
      if (lo < 0) { lo = 0; hi = span; }
      if (hi > ml - 1) { hi = ml - 1; lo = hi - span; }
      setVr({ lo: Math.max(0, lo), hi: Math.min(ml - 1, hi) });
    };
    wrap.addEventListener('wheel', handler, { passive: false });
    return () => wrap.removeEventListener('wheel', handler);
  }, []);
  const onDown = (e: React.MouseEvent) => { dragRef.current = { x: e.clientX, lo: vr.lo, hi: vr.hi }; movedRef.current = false; };
  const onMove = (e: React.MouseEvent) => {
    const wrap = wrapRef.current; if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    setHover({ x: e.clientX - r.left, y: e.clientY - r.top });
    const d = dragRef.current;
    if (d) {
      if (Math.abs(e.clientX - d.x) > 3) movedRef.current = true;
      const span = d.hi - d.lo;
      const dx = ((e.clientX - d.x) / ((wrap.clientWidth - PADL - PADR) || 1)) * span;
      let lo = d.lo - dx, hi = d.hi - dx;
      if (lo < 0) { lo = 0; hi = span; }
      if (hi > maxLen - 1) { hi = maxLen - 1; lo = hi - span; }
      setVr({ lo, hi });
    }
  };
  const onUp = () => {
    // a press WITHOUT a drag = a click on a line -> select the nearest series
    if (dragRef.current && !movedRef.current && onPick) onPick(nearIdRef.current);
    dragRef.current = null;
  };
  const onLeave = () => { setHover(null); dragRef.current = null; };

  return (
    <div ref={wrapRef} className="relative w-full select-none touch-none" style={{ height }}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onLeave}>
      <canvas ref={canvasRef} className="cursor-crosshair" />
    </div>
  );
};

/**
 * Phase-1 fill DIFF chart: visualizes the coverage gap computed from LOCAL fragments
 * (okx.fill_plan) BEFORE any download — an overall have/missing bar, full/partial/empty
 * counts, and a ranked list of the coins with the biggest gaps (bar = missing share).
 */
const FillDiffChart: React.FC<{ plan: FillPlan; t: any; dark: boolean; onHide: () => void }> = ({ plan, t, dark, onHide }) => {
  const tot = plan.totals;
  const top = plan.coins.filter((c) => c.missing > 0).slice(0, 20);
  const maxMiss = Math.max(1, ...top.map((c) => c.missing));
  const card = dark ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-200';
  const chip = (label: string, val: React.ReactNode, accent: string) => (
    <div className="flex flex-col">
      <span className="text-[8px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`text-sm font-black font-mono ${accent}`}>{val}</span>
    </div>
  );
  return (
    <div className={`p-3 rounded-2xl border ${card}`}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-black text-slate-200 flex items-center gap-2">
          <Layers className="w-4 h-4 text-fuchsia-400" /> {t.diffTitle}
          <span className="text-[10px] font-normal text-slate-500">· {plan.bar} · {t.diffWindow(plan.hours)}</span>
        </span>
        <button onClick={onHide} title={t.diffHide} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"><X className="w-4 h-4" /></button>
      </div>
      {/* overall coverage bar (have vs missing) */}
      <div className="h-3 rounded-full bg-rose-500/20 overflow-hidden mb-2">
        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${tot.coverage}%` }} />
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3 font-mono">
        {chip(t.diffCoverageN, `${tot.coverage}%`, 'text-emerald-400')}
        {chip(t.diffHave, tot.have.toLocaleString(), 'text-slate-200')}
        {chip(t.diffNeed, tot.need.toLocaleString(), 'text-slate-200')}
        {chip(t.diffMissing, tot.missing.toLocaleString(), 'text-rose-400')}
        {chip(t.diffFull, tot.full, 'text-emerald-400')}
        {chip(t.diffEmpty, tot.empty, 'text-amber-400')}
      </div>
      {top.length > 0 && (
        <>
          <div className="text-[9px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">{t.diffTopGaps}</div>
          <div className="space-y-1 max-h-48 overflow-auto">
            {top.map((c) => (
              <div key={c.inst_id} className="flex items-center gap-2 text-[11px] font-mono">
                <span className="w-24 shrink-0 truncate text-slate-300">{c.inst_id}</span>
                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-rose-500 to-fuchsia-400" style={{ width: `${Math.max(3, (c.missing / maxMiss) * 100)}%` }} />
                </div>
                <span className="w-10 text-right text-rose-400">{c.missing}</span>
                <span className="w-12 text-right text-slate-500">{c.coverage}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/** Window stats derived from a candle set (open/close/high/low + % change & range). */
const candleStats = (candles: number[][]) => {
  if (!candles.length) return null;
  const open = candles[0][1];
  const close = candles[candles.length - 1][4];
  const hi = Math.max(...candles.map((c) => c[2]));
  const lo = Math.min(...candles.map((c) => c[3]));
  const chg = open ? ((close - open) / open) * 100 : 0;
  const range = lo ? ((hi - lo) / lo) * 100 : 0;
  return { open, close, hi, lo, chg, range };
};

interface CoinRow {
  inst_id: string;
  state?: string;
  list_time?: number | null; // OKX listing time (real new-coin signal)
  first_seen?: number;       // when OUR db first saw it (cold-DB = now)
  first_ts?: number | null;
  last_ts?: number | null;
  complete?: number;
  cnt?: number;
  last?: number | null;     // live last price (ticker feed)
  chg24h?: number | null;   // live 24h change %
}
interface OkxStatus {
  running?: boolean; filling?: boolean;
  instruments?: number; candles?: number;
  universe?: { total?: number; pending?: number; new?: number };
  job?: any;
}
// Unified progress event for BOTH the universe-load and the backtest-fill flows
// (backend emits one `okx_market_progress` event for each). op/phase pick the label;
// elapsed_s seeds the local up-counting timer; the rest mirror the old fill fields.
interface Progress {
  op?: 'load' | 'fill';
  phase?: string;            // load: 'universe'|'tickers'|'sync' · fill: 'gap-fill'|'catch-up'
  state?: 'starting' | 'running' | 'done' | 'cancelled' | 'error' | string;
  done?: number; total?: number; inst_id?: string;
  elapsed_s?: number; eta_s?: number | null; rate?: number | null;
  throttled?: boolean; inserted?: number;
  job_id?: string;
}

// Per-coin window metrics (okx.metrics) → compare-view rankings dashboard + detail panel.
interface CoinMetrics {
  change: number; hi: number; lo: number; range: number;
  vol_base: number; vol_quote: number; buy_ratio: number | null;
  volatility: number; max_move: { idx: number; ts: number; pct: number };
  n: number; first_ts: number; last_ts: number;
}
type RankKey = 'change' | 'loss' | 'volatility' | 'vol_quote';

// Phase-1 fill plan: the local-fragment coverage diff vs the target window (okx.fill_plan).
interface FillPlanCoin { inst_id: string; have: number; need: number; missing: number; coverage: number; }
interface FillPlan {
  bar: string; hours: number; scope: string;
  window: { from: number; to: number };
  totals: { coins: number; have: number; need: number; missing: number;
            full: number; partial: number; empty: number; coverage: number };
  coins: FillPlanCoin[];
}

const CACHE_KEY = 'vortex_okx_coins';
const loadCache = (): CoinRow[] => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]') || []; } catch { return []; } };
const saveCache = (rows: CoinRow[]) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(rows.slice(0, 2000))); } catch { /* ignore */ } };

const DAY = 24 * 3600 * 1000;
// "New" = recently LISTED on OKX (list_time), NOT when our DB first saw it — on a cold
// first-fill every first_seen == now, which would mark every coin new. Fall back to
// first_seen only when OKX gave no list_time.
const isNew = (c: CoinRow) => {
  const t = c.list_time ?? c.first_seen;
  return !!t && Date.now() - t < DAY;
};
const isPending = (c: CoinRow) => c.state === 'preopen' || c.state === 'test';
const fmtTs = (t?: number | null) => (t ? new Date(t).toLocaleString() : '—');

// Compact large-number formatter for volumes (341723254 -> "341.72M").
const fmtBig = (n?: number | null): string => {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(2);
};

// Quote currency from an inst_id ("BTC-USDT" -> "USDT"); fall back to the whole id.
const quoteOf = (inst_id: string): string => {
  const parts = inst_id.split('-');
  return parts.length > 1 ? parts[1] : inst_id;
};

// mm:ss from a whole-second count (clamped at 0).
const fmtClock = (s: number): string => {
  const v = Math.max(0, Math.floor(s));
  const mm = Math.floor(v / 60);
  const ss = v % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

type Filter = 'all' | 'new' | 'pending' | 'incomplete';
type View = 'table' | 'charts' | 'compare';

// is this op still in flight? (anything but a terminal state)
const isActive = (p?: Progress | null): boolean =>
  !!p && p.state !== 'done' && p.state !== 'cancelled' && p.state !== 'error';

const L = (lang: string) => (lang === 'en'
  ? {
      title: 'OKX Backtest Data', sub: 'OHLCV across all coins — in-memory store',
      fill: 'Fill backtest data', filling: 'Filling…', cancel: 'Cancel', refresh: 'Refresh',
      startAll: 'Load + Backtest', startingAll: 'Starting…',
      startAllHint: 'One click: load all coins live → compute diff (chart) → fill history',
      loadCoins: 'Load all coins', loadingCoins: 'Loading…',
      liveHint: 'Fetch every coin with live prices (no history)',
      coin: 'Coin', state: 'State', last: 'Last', candles: 'Candles', coverage: 'Coverage', done: 'Done',
      all: 'All', newC: 'New', pending: 'Pending', incomplete: 'Incomplete',
      unreachable: 'pycore unreachable — showing the last cached snapshot.',
      empty: 'No coins yet. Press "Load all coins" for live prices, then "Fill backtest data" for history.',
      instruments: 'Coins', pendingN: 'Pending', newN: 'New', candlesN: 'Candles',
      timeframe: 'Timeframe', export: 'Export CSV',
      sOpen: 'Open', sClose: 'Close', sHigh: 'High', sLow: 'Low', sChg: 'Change', sRange: 'Range',
      scopeUsdt: 'USDT', scopeAll: 'All', scopeHint: 'USDT pairs only / all live pairs',
      autoLoad: 'Auto-load coins on start', autoBacktest: 'Auto-run backtest on start',
      autoHint: 'Saved to pycore settings; applied next startup',
      // unified progress labels
      pLoadUniverse: 'Loading coins', pLoadTickers: 'Live prices', pLoadSync: 'Syncing',
      pCatchUp: 'Catching up', elapsed: 'Elapsed', eta: 'ETA',
      // type filter + view toggle
      allTypes: 'All types', type: 'Type', viewTable: 'Table', viewCharts: 'Charts', viewCompare: 'Compare',
      cmpChange: 'Change %', cmpPrice: 'Price', cmpReset: 'Reset zoom',
      cmpHint: 'wheel = zoom · drag = pan · click line = select', cmpLoading: 'Loading…',
      cmpEmpty: 'No coins with data — run a backtest fill first.', quoteFilter: 'Quote',
      rankGainers: 'Gainers', rankLosers: 'Losers', rankVol: 'Volatility', rankVolume: 'Volume',
      dChange: 'Change', dRange: 'Range', dVolQuote: 'Volume (quote)', dVolBase: 'Volume (base)',
      dBuyRatio: 'Buy pressure', dHi: 'High', dLo: 'Low', dMaxMove: 'Biggest move',
      dVolatility: 'Realized vol', dCandles: 'Candles', dAt: 'at', dWindow: 'Window',
      detailPick: 'Click a line on the chart, or a coin in the list, to see its details.',
      noData: 'No trend data', showingN: (n: number, total: number) => `Showing ${n} of ${total}`,
      chartsEmpty: 'No coins with candle history yet — run a backtest fill first (Charts only shows coins that have data).',
      withDataN: (n: number, total: number) => `${n} of ${total} coins have data (run a fill to add more)`,
      ofTotal: (n: number) => `of ${n} coins`,
      // selected-coin listing info
      listed: 'Listed',
      // fill phase-1 diff (local coverage gap, computed before any fetch)
      pDiff: 'Computing diff', diffTitle: 'Phase 1 · coverage diff (local fragments vs target)',
      diffHave: 'Have', diffNeed: 'Need', diffMissing: 'Missing', diffCoverageN: 'Coverage',
      diffFull: 'Complete', diffPartial: 'Partial', diffEmpty: 'Empty', diffTopGaps: 'Largest gaps',
      diffHide: 'Hide', diffWindow: (h: number) => `${h}h window`,
    }
  : {
      title: 'OKX 回测数据', sub: '全币种 OHLCV — 内存库',
      fill: '填充回测数据', filling: '填充中…', cancel: '取消', refresh: '刷新',
      startAll: '载入并回测', startingAll: '启动中…',
      startAllHint: '一键：载入全部币种实时行情 → 计算差异（图表） → 填充历史',
      loadCoins: '载入全部币种', loadingCoins: '载入中…',
      liveHint: '拉取全部币种实时价格（不含历史）',
      coin: '币种', state: '状态', last: '最新价', candles: 'K线', coverage: '覆盖区间', done: '完成',
      all: '全部', newC: '新币', pending: '待发', incomplete: '不完整',
      unreachable: 'pycore 不可达 —— 显示上次缓存快照。',
      empty: '暂无数据。先点「载入全部币种」获取实时行情，再点「填充回测数据」拉取历史。',
      instruments: '币种', pendingN: '待发', newN: '新币', candlesN: 'K线',
      timeframe: '周期', export: '导出 CSV',
      sOpen: '开', sClose: '收', sHigh: '高', sLow: '低', sChg: '涨跌', sRange: '振幅',
      scopeUsdt: 'USDT', scopeAll: '全部', scopeHint: '仅 USDT 交易对 / 所有在交易对',
      autoLoad: '启动时自动载入币种', autoBacktest: '启动时自动回测',
      autoHint: '保存到 pycore 设置；下次启动生效',
      // unified progress labels
      pLoadUniverse: '载入币种', pLoadTickers: '实时价格', pLoadSync: '同步中',
      pCatchUp: '追平', elapsed: '已用时', eta: '预计',
      // type filter + view toggle
      allTypes: '全部类型', type: '类型', viewTable: '表格', viewCharts: '图表', viewCompare: '对比',
      cmpChange: '涨跌%', cmpPrice: '价格', cmpReset: '重置缩放',
      cmpHint: '滚轮缩放 · 拖动平移 · 点击线条选中', cmpLoading: '加载中…',
      cmpEmpty: '暂无含数据的币种 —— 请先填充回测。', quoteFilter: '计价',
      rankGainers: '涨幅', rankLosers: '跌幅', rankVol: '波动', rankVolume: '成交量',
      dChange: '涨跌', dRange: '振幅', dVolQuote: '成交额', dVolBase: '成交量',
      dBuyRatio: '买入占比', dHi: '最高', dLo: '最低', dMaxMove: '最大波动',
      dVolatility: '已实现波动', dCandles: 'K线', dAt: '于', dWindow: '窗口',
      detailPick: '点击图表中的线条，或列表中的币，查看详情。',
      noData: '暂无走势数据', showingN: (n: number, total: number) => `显示 ${n} / ${total}`,
      chartsEmpty: '暂无含K线历史的币种 —— 请先填充回测数据（图表仅显示有数据的币）。',
      withDataN: (n: number, total: number) => `${total} 个币中 ${n} 个有数据（填充可增加）`,
      ofTotal: (n: number) => `/ 共 ${n} 币`,
      // selected-coin listing info
      listed: '上线',
      // fill phase-1 diff (local coverage gap, computed before any fetch)
      pDiff: '计算差异', diffTitle: '第一阶段 · 覆盖差异（本地片段 vs 目标）',
      diffHave: '已有', diffNeed: '需要', diffMissing: '缺失', diffCoverageN: '覆盖率',
      diffFull: '完整', diffPartial: '部分', diffEmpty: '空', diffTopGaps: '最大缺口',
      diffHide: '隐藏', diffWindow: (h: number) => `${h}小时窗口`,
    });

const BARS = ['1m', '5m', '15m', '1H', '4H', '1D'];

export const OkxBacktestPanel: React.FC<{ dark: boolean; lang: string }> = ({ dark, lang }) => {
  const t = L(lang);
  const [coins, setCoins] = useState<CoinRow[]>(() => loadCache());
  const [status, setStatus] = useState<OkxStatus>({});
  const [progress, setProgress] = useState<Progress | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');   // quote-currency filter ('all' = any)
  const [view, setView] = useState<View>('table');               // table | charts grid | compare overlay
  const [spark, setSpark] = useState<Record<string, number[]>>({}); // inst_id -> close series (charts view)
  const [cmp, setCmp] = useState<Record<string, number[]>>({});  // inst_id -> close series (compare overlay)
  const [cmpLoading, setCmpLoading] = useState(false);
  const [cmpMode, setCmpMode] = useState<'change' | 'price'>('change'); // compare by % change (default) or price
  const [cmpMetrics, setCmpMetrics] = useState<Record<string, CoinMetrics>>({}); // per-coin window stats
  const [cmpSel, setCmpSel] = useState<string | null>(null);     // highlighted coin in the compare view
  const [cmpRank, setCmpRank] = useState<RankKey>('change');      // dashboard ranking metric
  const [cmpFocus, setCmpFocus] = useState<{ lo: number; hi: number } | null>(null); // zoom-to-segment
  const [fillPlan, setFillPlan] = useState<FillPlan | null>(null); // phase-1 diff (local coverage gap)
  const [unreachable, setUnreachable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [httpOk, setHttpOk] = useState(false);
  const [hours, setHours] = useState<number>(24);   // backtest window (24h / 48h)
  const [bar, setBar] = useState<string>('1m');     // timeframe
  const [scope, setScope] = useState<'usdt' | 'all'>('usdt'); // USDT pairs vs ALL coins
  const barRef = useRef(bar); barRef.current = bar; // stable read for callbacks
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'coin' | 'last' | 'chg' | 'candles'>('coin');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [selected, setSelected] = useState<string | null>(null);   // chart coin
  const [selCandles, setSelCandles] = useState<number[][]>([]);
  const [selLoading, setSelLoading] = useState(false);
  const [loadingUniverse, setLoadingUniverse] = useState(false);   // "Load all coins" busy
  const [elapsed, setElapsed] = useState(0);   // local up-counting timer (seconds) for the active op
  // Auto-load settings persisted in the pycore user-data store (replace defaults on start).
  const [settings, setSettings] = useState<{ auto_load: boolean; auto_backtest: boolean }>(
    { auto_load: true, auto_backtest: false });
  const refreshTimer = useRef<number | null>(null);

  const refreshCoins = useCallback(async () => {
    try {
      const [st, cs] = await Promise.all([
        requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.status, {}, 8000),
        requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.coins, { bar: barRef.current }, 15000),
      ]);
      if (st) setStatus(st);
      const rows: CoinRow[] = Array.isArray(cs?.coins) ? cs.coins : [];
      setCoins(rows); saveCache(rows); setUnreachable(false);
    } catch {
      setUnreachable(true);
    }
  }, []);

  // Initial load and HTTP event subscriptions. onHttpStatus fires with the current
  // state immediately and again when the event transport connects.
  // Map the persisted display_quote ('usdt'|'usdc'|'all') to the type-filter value.
  const quoteToType = (q: string): string => (q === 'usdt' ? 'USDT' : q === 'usdc' ? 'USDC' : 'all');
  const quoteInit = useRef(false);
  const loadSettings = useCallback(async () => {
    try {
      const s = await requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.getSettings, {}, 8000);
      if (s) {
        setSettings({ auto_load: !!s.auto_load, auto_backtest: !!s.auto_backtest });
        // Apply the saved quote filter ONCE (don't clobber the user's later manual picks).
        if (!quoteInit.current && s.display_quote) { setTypeFilter(quoteToType(String(s.display_quote))); quoteInit.current = true; }
      }
    } catch { /* keep defaults */ }
  }, []);

  // Persist the quote filter choice (segmented USDT/USDC/All) to pycore settings.
  const saveQuote = (q: 'usdt' | 'usdc' | 'all') => {
    setTypeFilter(quoteToType(q));
    requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.setSettings, { display_quote: q }, 8000).catch(() => { /* best-effort */ });
  };

  useEffect(() => {
    connectPycoreHttp();
    const offStatus = onHttpStatus((c) => { setHttpOk(c); if (c) { refreshCoins(); loadSettings(); } });
    const offS = subscribe(VORTEX_PYCORE_EVENT_TOPICS.marketStatus, (d: any) => setStatus(d || {}));
    const offP = subscribe(VORTEX_PYCORE_EVENT_TOPICS.marketProgress, (d: Progress) => {
      setProgress(d);   // the progress bar render already hides on state==='done'
      // a fill finished/cancelled/errored -> refresh the table once to show the result
      if (d?.state === 'done' || d?.state === 'cancelled' || d?.state === 'error') {
        refreshCoins();
      }
    });
    const offU = subscribe(VORTEX_PYCORE_EVENT_TOPICS.marketUpdate, () => { /* universe/tick — table refresh below */ });
    return () => { offStatus(); offS(); offP(); offU(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // An op is in flight when an active fill-progress event is live (or the legacy
  // status.filling flag). Drives the Cancel button + the 3s coverage poll below.
  const fillActive = isActive(progress) && progress?.op === 'fill';
  const filling = !!status.filling || fillActive;
  // The unified bar shows whenever ANY op is active OR the local Load flow is busy.
  const loadActive = isActive(progress) && progress?.op === 'load';
  const showProgress = isActive(progress) || loadingUniverse;
  // Load button is busy from either the local flag OR a live load-op event.
  const loadBusy = loadingUniverse || loadActive;
  useEffect(() => {
    // Always clear a prior timer before (re)deciding, so we can never stack intervals.
    if (refreshTimer.current) { clearInterval(refreshTimer.current); refreshTimer.current = null; }
    if (filling) {
      refreshTimer.current = window.setInterval(refreshCoins, 3000);
    }
    return () => { if (refreshTimer.current) { clearInterval(refreshTimer.current); refreshTimer.current = null; } };
  }, [filling, refreshCoins]);

  // ELAPSED TIMER: seed from progress.elapsed_s and tick locally every 1s so it advances
  // smoothly between HTTP events. Reset when a new operation begins.
  // and stop ticking when the op ends. We key the seed-effect on op+state so a fresh op
  // re-seeds; a separate interval increments while an op is active.
  const opKey = showProgress ? `${progress?.op ?? (loadingUniverse ? 'load' : '')}` : '';
  useEffect(() => {
    // (re)seed the timer whenever an op (re)starts or the op identity changes
    if (showProgress) setElapsed(Math.max(0, Math.floor(progress?.elapsed_s ?? 0)));
    else setElapsed(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opKey, progress?.state === 'starting']);
  // Keep the local clock in sync with the latest backend HTTP event.
  useEffect(() => {
    if (showProgress && progress?.elapsed_s != null) setElapsed(Math.max(0, Math.floor(progress.elapsed_s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.elapsed_s]);
  useEffect(() => {
    if (!showProgress) return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [showProgress]);

  // MERGED single-button pipeline (load + backtest): one click runs every stage —
  //   1a) load ALL coins live (universe + ticker feed) so the table fills instantly,
  //   1b) compute the local-fragment DIFF and show its chart (phase 1),
  //   2) Fill the backtest history; progress streams through HTTP events.
  const startAll = async () => {
    setLoading(true); setLoadingUniverse(true);
    try {
      // Phase 1a — load every coin with live prices (fast; no history). Non-fatal:
      // fill_backtest also refreshes the universe, so a hiccup here never blocks the fill.
      try { await requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.loadUniverse, {}, 30000); setUnreachable(false); refreshCoins(); }
      catch { /* best-effort */ }
      setLoadingUniverse(false);
      // Phase 1b — DIFF from local fragments → chart, BEFORE any download.
      try {
        const plan = await requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.fillPlan, { bar, hours, scope }, 20000);
        if (plan && !plan.error) setFillPlan(plan as FillPlan);
      } catch { /* plan is best-effort */ }
      // Phase 2: download only missing ranges with HTTP event progress.
      await requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.fillBacktest, { bar, hours, scope }, 8000);
      setProgress({ state: 'starting', op: 'fill', phase: 'diff' });
    } catch { setUnreachable(true); }
    finally { setLoading(false); setLoadingUniverse(false); refreshCoins(); }
  };
  const cancelFill = async () => { try { await requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.cancelFill, {}, 8000); } catch { /* ignore */ } };

  // Persist an auto-load setting to the pycore user-data store (optimistic UI).
  const saveSetting = async (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try { await requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.setSettings, patch, 8000); } catch { /* best-effort */ }
  };

  const openChart = useCallback(async (inst_id: string) => {
    setSelected(inst_id); setSelCandles([]); setSelLoading(true);
    try {
      const r = await requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.candles, { inst_id, bar: barRef.current }, 15000);
      setSelCandles(Array.isArray(r?.candles) ? r.candles : []);
    } catch { setSelCandles([]); }
    finally { setSelLoading(false); }
  }, []);

  // changing timeframe re-queries the table (per-bar candle counts) + the open chart
  useEffect(() => {
    if (!httpOk) return;
    refreshCoins();
    if (selected) openChart(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bar]);

  // export the currently filtered/sorted rows as CSV
  const exportCsv = () => {
    const head = ['inst_id', 'state', 'last', 'chg24h', 'candles', 'first_ts', 'last_ts', 'complete'];
    const lines = [head.join(',')];
    for (const c of filtered) {
      lines.push([
        c.inst_id, c.state ?? '', c.last ?? '', c.chg24h ?? '',
        c.cnt ?? 0, c.first_ts ?? '', c.last_ts ?? '', c.complete ? 1 : 0,
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `okx_${bar}_${hours}h.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (k: typeof sortKey) =>
    setSortKey((prev) => { if (prev === k) { setSortDir((d) => (d === 1 ? -1 : 1)); return prev; } setSortDir(1); return k; });
  // Directional sort indicator: faint up/down when inactive (hints sortability), a solid
  // arrow showing asc/desc on the active column (click toggles the direction).
  const sortArrow = (k: typeof sortKey) => (
    sortKey !== k
      ? <ArrowUpDown className="inline w-3 h-3 ml-1 opacity-40" />
      : sortDir === 1
        ? <ArrowUp className="inline w-3 h-3 ml-1 text-indigo-400" />
        : <ArrowDown className="inline w-3 h-3 ml-1 text-indigo-400" />
  );

  // distinct quote currencies present in the loaded coins (for the type dropdown)
  const types = useMemo(() => {
    const set = new Set<string>();
    for (const c of coins) set.add(quoteOf(c.inst_id));
    return Array.from(set).sort();
  }, [coins]);

  // filter -> type -> search -> sort (memoized; the table is the dynamic-display hot path)
  const filtered = useMemo(() => {
    let arr = coins.filter((c) =>
      filter === 'all' ? true
        : filter === 'new' ? isNew(c)
          : filter === 'pending' ? isPending(c)
            : !c.complete);
    if (typeFilter !== 'all') arr = arr.filter((c) => quoteOf(c.inst_id) === typeFilter);
    const q = search.trim().toLowerCase();
    if (q) arr = arr.filter((c) => c.inst_id.toLowerCase().includes(q));
    const d = sortDir;
    return [...arr].sort((a, b) => {
      if (sortKey === 'coin') return a.inst_id < b.inst_id ? -d : a.inst_id > b.inst_id ? d : 0;
      const av = sortKey === 'last' ? (a.last ?? -Infinity) : sortKey === 'chg' ? (a.chg24h ?? -Infinity) : (a.cnt ?? 0);
      const bv = sortKey === 'last' ? (b.last ?? -Infinity) : sortKey === 'chg' ? (b.chg24h ?? -Infinity) : (b.cnt ?? 0);
      return (av - bv) * d;
    });
  }, [coins, filter, typeFilter, search, sortKey, sortDir]);

  // Charts grid is capped at 60 cards; the sparkline batch only fetches this set.
  const CHART_CAP = 60;
  // Charts view: only coins that actually HAVE candle history (cnt>0) — an empty
  // sparkline ("暂无走势数据") is noise, so unfilled pairs are skipped here (the table
  // view still lists every coin). This is why non-USDT pairs vanish in Charts until filled.
  const chartCoins = useMemo(
    () => filtered.filter((c) => (c.cnt ?? 0) > 0).slice(0, CHART_CAP), [filtered]);
  const withData = useMemo(() => filtered.filter((c) => (c.cnt ?? 0) > 0).length, [filtered]);
  // stable key for the visible set so the fetch effect only re-runs when it truly changes
  const chartKey = useMemo(() => chartCoins.map((c) => c.inst_id).join(','), [chartCoins]);

  // Fetch close-series for the visible capped set in ONE batch call. Runs when we enter
  // Charts view, when the timeframe (bar) changes, or when the visible set changes. A ref
  // guards against firing the same (key+bar) request twice (e.g. duplicate renders).
  const sparkReq = useRef('');
  useEffect(() => {
    if (view !== 'charts' || !httpOk || chartCoins.length === 0) return;
    const reqKey = `${bar}|${chartKey}`;
    if (sparkReq.current === reqKey) return;
    sparkReq.current = reqKey;
    let alive = true;
    (async () => {
      try {
        const r = await requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.sparklines, { inst_ids: chartCoins.map((c) => c.inst_id), bar, points: 32 }, 20000);
        if (alive && r?.series) setSpark(r.series as Record<string, number[]>);
      } catch { /* leave prior series; cards show no-data */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, httpOk, bar, chartKey]);

  // Compare overlay: a denser series set (more points) for up to 80 coins with data.
  const CMP_CAP = 80;
  const cmpCoins = useMemo(
    () => filtered.filter((c) => (c.cnt ?? 0) > 0).slice(0, CMP_CAP), [filtered]);
  const cmpKey = useMemo(() => cmpCoins.map((c) => c.inst_id).join(','), [cmpCoins]);
  // dashboard: coins ranked by the chosen metric (desc) using the window metrics
  const cmpRanked = useMemo(() => {
    const val = (m: CoinMetrics) => cmpRank === 'change' ? m.change
      : cmpRank === 'loss' ? -m.change : cmpRank === 'volatility' ? m.volatility : m.vol_quote;
    return cmpCoins.map((c) => ({ id: c.inst_id, m: cmpMetrics[c.inst_id] }))
      .filter((x): x is { id: string; m: CoinMetrics } => !!x.m)
      .sort((a, b) => val(b.m) - val(a.m));
  }, [cmpCoins, cmpMetrics, cmpRank]);
  // select a coin (highlight its line); for the volatility metric, also zoom the chart to
  // the coin's most-volatile segment (max_move.idx mapped onto the sampled series length).
  const pickCompare = useCallback((id: string | null, focusVol = false) => {
    setCmpSel(id);
    if (id && focusVol) {
      const m = cmpMetrics[id], len = cmp[id]?.length ?? 0;
      if (m && len > 1 && m.n > 1) {
        const c = Math.round((m.max_move.idx / (m.n - 1)) * (len - 1));
        const w = Math.max(8, Math.floor(len * 0.12));
        setCmpFocus({ lo: Math.max(0, c - w), hi: Math.min(len - 1, c + w) });
      }
    } else {
      setCmpFocus(null);
    }
  }, [cmpMetrics, cmp]);
  const cmpReq = useRef('');
  useEffect(() => {
    if (view !== 'compare' || !httpOk || cmpCoins.length === 0) return;
    const reqKey = `${bar}|${cmpKey}`;
    if (cmpReq.current === reqKey) return;
    cmpReq.current = reqKey;
    let alive = true;
    setCmpLoading(true);
    const ids = cmpCoins.map((c) => c.inst_id);
    (async () => {
      try {
        // close series for the overlay + per-coin window metrics for the dashboard/detail
        const [sp, mt] = await Promise.all([
          requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.sparklines, { inst_ids: ids, bar, points: 200, hours }, 25000),
          requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.metrics, { inst_ids: ids, bar, hours }, 25000),
        ]);
        if (alive && sp?.series) setCmp(sp.series as Record<string, number[]>);
        if (alive && mt?.metrics) setCmpMetrics(mt.metrics as Record<string, CoinMetrics>);
      } catch { /* leave prior */ }
      finally { if (alive) setCmpLoading(false); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, httpOk, bar, hours, cmpKey]);

  const pct = progress?.total ? Math.min(100, Math.round(((progress.done || 0) / progress.total) * 100)) : 0;

  // Localized label for the active op/phase (falls back to the generic "filling" copy).
  const progressLabel = ((): string => {
    const op = progress?.op ?? (loadingUniverse ? 'load' : undefined);
    const phase = progress?.phase;
    if (op === 'load') {
      if (phase === 'tickers') return t.pLoadTickers;
      if (phase === 'sync') return t.pLoadSync;
      return t.pLoadUniverse; // 'universe' or unknown
    }
    if (op === 'fill') {
      if (phase === 'diff') return t.pDiff;
      if (phase === 'catch-up') return t.pCatchUp;
      return t.filling; // 'gap-fill' or unknown
    }
    return t.filling;
  })();

  const card = dark ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-200';
  const chip = (active: boolean) => `px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${active ? 'bg-indigo-500/15 text-indigo-400' : dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`;

  const stat = (icon: React.ReactNode, label: string, value: React.ReactNode, accent: string) => (
    <div className={`p-3 rounded-2xl border ${card} flex items-center gap-2.5`}>
      <span className={accent}>{icon}</span>
      <div><div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">{label}</div>
        <div className="text-lg font-black font-mono text-slate-100 dark:text-slate-100 leading-none">{value}</div></div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2 text-slate-100">
            <Database className="w-5 h-5 text-indigo-400" /> {t.title}
          </h2>
          <p className="text-xs text-slate-400 font-mono">{t.sub}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!filling && (
            <div className={`flex items-center rounded-xl border ${card} overflow-hidden`} title={t.timeframe}>
              {BARS.map((b) => (
                <button key={b} onClick={() => setBar(b)}
                  className={`px-2 py-1.5 text-[11px] font-bold font-mono transition ${bar === b ? 'bg-indigo-500/15 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}>
                  {b}
                </button>
              ))}
            </div>
          )}
          {!filling && (
            <div className={`flex items-center rounded-xl border ${card} overflow-hidden`}>
              {[6, 12, 24, 48, 72].map((h) => (
                <button key={h} onClick={() => setHours(h)}
                  className={`px-2.5 py-1.5 text-[11px] font-bold font-mono transition ${hours === h ? 'bg-indigo-500/15 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}>
                  {h}h
                </button>
              ))}
            </div>
          )}
          {!filling && (
            <div className={`flex items-center rounded-xl border ${card} overflow-hidden`} title={t.scopeHint}>
              {(['usdt', 'all'] as const).map((s) => (
                <button key={s} onClick={() => setScope(s)}
                  className={`px-2.5 py-1.5 text-[11px] font-bold font-mono transition ${scope === s ? 'bg-indigo-500/15 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}>
                  {s === 'usdt' ? t.scopeUsdt : t.scopeAll}
                </button>
              ))}
            </div>
          )}
          {!filling ? (
            <button onClick={startAll} disabled={loadBusy || loading} title={t.startAllHint}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition">
              {(loadBusy || loading) ? <Zap className="w-4 h-4 animate-pulse" /> : <Play className="w-4 h-4" />}
              {(loadBusy || loading) ? t.startingAll : t.startAll}
            </button>
          ) : (
            <button onClick={cancelFill}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition">
              <Square className="w-4 h-4" /> {t.cancel}
            </button>
          )}
          <button onClick={refreshCoins} title={t.refresh}
            className={`p-2.5 rounded-xl border ${card} text-slate-400 hover:text-indigo-400 transition`}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {unreachable && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{t.unreachable}</span>
        </div>
      )}

      {/* auto-load settings (persisted in pycore user-data store) */}
      <div className={`flex items-center gap-4 flex-wrap rounded-2xl border px-4 py-2.5 ${card}`}>
        {([
          { key: 'auto_load' as const, label: t.autoLoad },
          { key: 'auto_backtest' as const, label: t.autoBacktest },
        ]).map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
            <button type="button" role="switch" aria-checked={settings[key]}
              onClick={() => saveSetting({ [key]: !settings[key] } as Partial<typeof settings>)}
              className={`relative w-9 h-5 rounded-full transition-colors ${settings[key] ? 'bg-emerald-500' : dark ? 'bg-slate-700' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings[key] ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-[11px] font-bold text-slate-300">{label}</span>
          </label>
        ))}
        <span className="ml-auto text-[10px] font-mono text-slate-500">{t.autoHint}</span>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {stat(<TrendingUp className="w-4 h-4" />, t.instruments, status.instruments ?? coins.length, 'text-indigo-400')}
        {stat(<Sparkles className="w-4 h-4" />, t.newN, status.universe?.new ?? coins.filter(isNew).length, 'text-emerald-400')}
        {stat(<Clock className="w-4 h-4" />, t.pendingN, status.universe?.pending ?? coins.filter(isPending).length, 'text-amber-400')}
        {/* candle total: trust status.candles, but never show 0 when loaded coins clearly
            hold candles (a stale/early status event can report 0) — fall back to the live sum. */}
        {stat(<Database className="w-4 h-4" />, t.candlesN,
          Math.max(status.candles ?? 0, coins.reduce((s, c) => s + (c.cnt ?? 0), 0)).toLocaleString(),
          'text-fuchsia-400')}
      </div>

      {/* unified progress + up-counting elapsed timer (drives BOTH load & fill flows) */}
      {showProgress && (
        <div className={`p-3 rounded-2xl border ${card}`}>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
            <span className="flex items-center gap-1.5">
              {progressLabel}
              {progress?.inst_id ? <span className="text-slate-500">· {progress.inst_id}</span> : null}
              {progress?.throttled ? <span className="text-amber-400">· ⏳</span> : null}
            </span>
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1 tabular-nums" title={t.elapsed}>
                <Clock className="w-3 h-3" /> {fmtClock(elapsed)}
              </span>
              <span>{progress?.done ?? 0}/{progress?.total ?? 0}</span>
              {/* scope context: the fill total is the SCOPED subset (e.g. USDT pairs),
                  not the full universe — show "/<total instruments>" so 299 vs 1265 is clear. */}
              {progress?.op === 'fill' ? (
                <span className="text-slate-500">· {scope === 'usdt' ? t.scopeUsdt : t.scopeAll}{status.instruments ? ` ${t.ofTotal(status.instruments)}` : ''}</span>
              ) : null}
              {progress?.eta_s != null ? <span>· {t.eta} {progress.eta_s}s</span> : null}
              {progress?.op === 'fill' && progress?.rate != null ? <span>· {progress.rate} req/s</span> : null}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-400 transition-all"
              style={{ width: `${progress?.total ? pct : 0}%` }} />
          </div>
        </div>
      )}

      {/* phase-1 fill DIFF chart (local coverage gap, shown when a fill is started) */}
      {fillPlan && (
        <FillDiffChart plan={fillPlan} t={t} dark={dark} onHide={() => setFillPlan(null)} />
      )}

      {/* selected coin chart */}
      {selected && (
        <div className={`p-3 rounded-2xl border ${card}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-black font-mono text-slate-200 flex items-center gap-2 flex-wrap">
              <CandlestickChart className="w-4 h-4 text-indigo-400" /> {selected}
              {/* full stored history for this coin (NOT capped to the fill window) */}
              <span className="text-[10px] font-normal text-slate-500">{bar} · {selCandles.length} {t.candles}</span>
              {selCandles.length > 1 && (
                <span className="text-[10px] font-normal text-slate-500">
                  {fmtTs(selCandles[0][0])} → {fmtTs(selCandles[selCandles.length - 1][0])}
                </span>
              )}
              {(() => {
                // listing time + state for ANY coin (works for new + every other coin)
                const row = coins.find((c) => c.inst_id === selected);
                if (!row) return null;
                return (
                  <span className="text-[10px] font-normal text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {t.listed}: {fmtTs(row.list_time)}
                    {row.state ? <span>· {row.state}</span> : null}
                  </span>
                );
              })()}
            </span>
            <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"><X className="w-4 h-4" /></button>
          </div>
          {(() => {
            const s = candleStats(selCandles);
            if (!s) return null;
            const item = (label: string, val: React.ReactNode, cls = 'text-slate-200') => (
              <div className="flex flex-col"><span className="text-[8px] uppercase tracking-wider text-slate-500">{label}</span>
                <span className={`text-[11px] font-bold tabular-nums ${cls}`}>{val}</span></div>
            );
            return (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3 font-mono">
                {item(t.sOpen, s.open)}
                {item(t.sClose, s.close)}
                {item(t.sHigh, s.hi, 'text-emerald-400')}
                {item(t.sLow, s.lo, 'text-rose-400')}
                {item(t.sChg, `${s.chg >= 0 ? '+' : ''}${s.chg.toFixed(2)}%`, s.chg >= 0 ? 'text-emerald-400' : 'text-rose-400')}
                {item(t.sRange, `${s.range.toFixed(2)}%`, 'text-amber-400')}
              </div>
            );
          })()}
          {selLoading ? <div className="h-44 flex items-center justify-center text-xs text-slate-500">…</div>
            : <CandleChart candles={selCandles} />}
        </div>
      )}

      {/* filters + type + search + view toggle */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['all', 'new', 'pending', 'incomplete'] as Filter[]).map((f) => (
          <button key={f} className={chip(filter === f)} onClick={() => setFilter(f)}>
            {f === 'all' ? t.all : f === 'new' ? t.newC : f === 'pending' ? t.pending : t.incomplete}
          </button>
        ))}
        {/* quote quick-select (persisted in pycore settings): USDT default / USDC / All */}
        <div className={`flex items-center rounded-xl border ${card} overflow-hidden`} title={t.quoteFilter}>
          {([['usdt', 'USDT'], ['usdc', 'USDC'], ['all', t.scopeAll]] as const).map(([q, label]) => {
            const active = typeFilter === quoteToType(q);
            return (
              <button key={q} onClick={() => saveQuote(q)}
                className={`px-2.5 py-1.5 text-[11px] font-bold font-mono transition ${active ? 'bg-indigo-500/15 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}>
                {label}
              </button>
            );
          })}
        </div>
        {/* full quote-currency dropdown (TRY/EUR/… power users) */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border ${card}`} title={t.type}>
          <FilterIcon className="w-3.5 h-3.5 text-slate-500" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-transparent outline-none text-[11px] font-mono font-bold text-slate-300 cursor-pointer">
            <option value="all" className={dark ? 'bg-slate-900' : 'bg-white'}>{t.allTypes}</option>
            {types.map((ty) => (
              <option key={ty} value={ty} className={dark ? 'bg-slate-900' : 'bg-white'}>{ty}</option>
            ))}
          </select>
        </div>
        <div className={`ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${card}`}>
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="BTC…"
            className="bg-transparent outline-none text-[11px] font-mono w-24 text-slate-200 placeholder:text-slate-600" />
          {search && <button onClick={() => setSearch('')} className="text-slate-500 hover:text-rose-400"><X className="w-3 h-3" /></button>}
        </div>
        {/* view toggle: table vs charts grid */}
        <div className={`flex items-center rounded-xl border ${card} overflow-hidden`}>
          <button onClick={() => setView('table')} title={t.viewTable}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold transition ${view === 'table' ? 'bg-indigo-500/15 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}>
            <Table2 className="w-3.5 h-3.5" /> {t.viewTable}
          </button>
          <button onClick={() => setView('charts')} title={t.viewCharts}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold transition ${view === 'charts' ? 'bg-indigo-500/15 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}>
            <LayoutGrid className="w-3.5 h-3.5" /> {t.viewCharts}
          </button>
          <button onClick={() => setView('compare')} title={t.viewCompare}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold transition ${view === 'compare' ? 'bg-indigo-500/15 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}>
            <LineChart className="w-3.5 h-3.5" /> {t.viewCompare}
          </button>
        </div>
        <button onClick={exportCsv} disabled={!filtered.length} title={t.export}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${card} text-[11px] font-bold text-slate-400 hover:text-indigo-400 disabled:opacity-40 transition`}>
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
        <span className="text-[11px] font-mono text-slate-500">{filtered.length}</span>
      </div>

      {/* charts grid — alternate view: a sparkline card per coin that HAS data (capped at 60) */}
      {view === 'charts' && (
        chartCoins.length === 0 ? (
          <div className={`rounded-2xl border ${card} h-40 flex items-center justify-center text-center text-xs text-slate-500 px-6`}>{t.chartsEmpty}</div>
        ) : (
          <div className={`rounded-2xl border ${card} p-3`}>
            <div className="px-1 pb-2 text-[10px] font-mono text-slate-500">{t.withDataN(withData, filtered.length)}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {chartCoins.map((c) => {
                const series = spark[c.inst_id] || [];
                return (
                  <button key={c.inst_id} onClick={() => openChart(c.inst_id)}
                    className={`text-left p-2.5 rounded-xl border transition ${card} hover:border-indigo-500/40 ${selected === c.inst_id ? 'ring-1 ring-indigo-500/50' : ''}`}>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] font-bold font-mono text-slate-200 truncate">{c.inst_id}</span>
                      {isNew(c) && <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-emerald-500/15 text-emerald-400 shrink-0">{t.newC}</span>}
                    </div>
                    <div className="flex items-baseline justify-between gap-1 mb-1 font-mono">
                      <span className="text-[11px] tabular-nums text-slate-300 truncate">{c.last != null ? c.last : '—'}</span>
                      {c.chg24h != null && (
                        <span className={`text-[10px] tabular-nums shrink-0 ${c.chg24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {c.chg24h >= 0 ? '+' : ''}{c.chg24h}%
                        </span>
                      )}
                    </div>
                    {series.length >= 2
                      ? <Sparkline series={series} />
                      : <div className="h-10 flex items-center justify-center text-[10px] text-slate-600">{t.noData}</div>}
                  </button>
                );
              })}
            </div>
            {withData > CHART_CAP && (
              <div className="px-1 pt-2.5 text-[10px] font-mono text-slate-500">{t.showingN(CHART_CAP, withData)}</div>
            )}
          </div>
        )
      )}

      {/* compare overlay — all coins on ONE canvas + rankings dashboard + detail panel */}
      {view === 'compare' && (
        <div className={`rounded-2xl border ${card} p-3`}>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {/* compare metric: % change (default) vs raw price */}
            <div className={`flex items-center rounded-xl border ${card} overflow-hidden`}>
              {(['change', 'price'] as const).map((m) => (
                <button key={m} onClick={() => setCmpMode(m)}
                  className={`px-2.5 py-1.5 text-[11px] font-bold font-mono transition ${cmpMode === m ? 'bg-indigo-500/15 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}>
                  {m === 'change' ? t.cmpChange : t.cmpPrice}
                </button>
              ))}
            </div>
            {/* rankings dashboard selector */}
            <div className={`flex items-center rounded-xl border ${card} overflow-hidden`}>
              {([['change', t.rankGainers], ['loss', t.rankLosers], ['volatility', t.rankVol], ['vol_quote', t.rankVolume]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setCmpRank(k)}
                  className={`px-2.5 py-1.5 text-[11px] font-bold font-mono transition ${cmpRank === k ? 'bg-fuchsia-500/15 text-fuchsia-400' : 'text-slate-400 hover:text-slate-200'}`}>
                  {label}
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
              <ZoomIn className="w-3.5 h-3.5" /> {t.cmpHint}
            </span>
            <span className="ml-auto text-[10px] font-mono text-slate-500">
              {cmpLoading ? t.cmpLoading : t.withDataN(Math.min(cmpCoins.length, CMP_CAP), filtered.length)}
            </span>
          </div>
          {cmpCoins.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-center text-xs text-slate-500 px-6">{t.cmpEmpty}</div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-3">
              {/* chart + selected-coin detail */}
              <div className="flex-1 min-w-0">
                <CompareChart series={cmp} mode={cmpMode} dark={dark} selected={cmpSel}
                  onPick={(id) => pickCompare(id)} focus={cmpFocus}
                  emptyText={cmpLoading ? t.cmpLoading : t.cmpEmpty} />
                {/* selected-coin detail (volume / buy-pressure / 24h window stats) */}
                {cmpSel && cmpMetrics[cmpSel] ? (() => {
                  const m = cmpMetrics[cmpSel];
                  const cell = (label: string, val: React.ReactNode, cls = 'text-slate-200') => (
                    <div className="flex flex-col"><span className="text-[8px] uppercase tracking-wider text-slate-500">{label}</span>
                      <span className={`text-[11px] font-bold tabular-nums ${cls}`}>{val}</span></div>
                  );
                  const buyPct = m.buy_ratio != null ? Math.round(m.buy_ratio * 100) : null;
                  return (
                    <div className={`mt-3 p-3 rounded-2xl border ${card}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorOf(cmpSel) }} />
                        <span className="text-sm font-black font-mono text-slate-200">{cmpSel}</span>
                        <span className="text-[10px] text-slate-500">{t.dWindow} {hours}h · {m.n} {t.dCandles}</span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 font-mono">
                        {cell(t.dChange, `${m.change >= 0 ? '+' : ''}${m.change}%`, m.change >= 0 ? 'text-emerald-400' : 'text-rose-400')}
                        {cell(t.dRange, `${m.range}%`, 'text-amber-400')}
                        {cell(t.dVolatility, `${m.volatility}%`, 'text-fuchsia-400')}
                        {cell(t.dVolQuote, fmtBig(m.vol_quote))}
                        {cell(t.dVolBase, fmtBig(m.vol_base))}
                        {cell(t.dHi, m.hi, 'text-emerald-400')}
                        {cell(t.dLo, m.lo, 'text-rose-400')}
                        {cell(t.dMaxMove, `${m.max_move.pct >= 0 ? '+' : ''}${m.max_move.pct}%`, m.max_move.pct >= 0 ? 'text-emerald-400' : 'text-rose-400')}
                      </div>
                      {/* buy/sell pressure bar */}
                      {buyPct != null && (
                        <div className="mt-2.5">
                          <div className="flex justify-between text-[9px] font-mono mb-1">
                            <span className="text-emerald-400">{t.dBuyRatio} {buyPct}%</span>
                            <span className="text-rose-400">{100 - buyPct}%</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden flex">
                            <div className="h-full bg-emerald-500" style={{ width: `${buyPct}%` }} />
                            <div className="h-full bg-rose-500" style={{ width: `${100 - buyPct}%` }} />
                          </div>
                          <div className="text-[9px] font-mono text-slate-500 mt-1">{t.dMaxMove} {t.dAt} {fmtTs(m.max_move.ts)}</div>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <div className="mt-3 text-[11px] font-mono text-slate-500 px-1">{t.detailPick}</div>
                )}
              </div>
              {/* rankings list (click = select line; volatility = jump to its move) */}
              <div className={`lg:w-60 shrink-0 rounded-2xl border ${card} p-2 max-h-[440px] overflow-auto`}>
                {cmpRanked.map((r, i) => {
                  const v = cmpRank === 'vol_quote' ? fmtBig(r.m.vol_quote)
                    : cmpRank === 'volatility' ? `${r.m.volatility}%`
                      : `${r.m.change >= 0 ? '+' : ''}${r.m.change}%`;
                  const vc = cmpRank === 'change' ? (r.m.change >= 0 ? 'text-emerald-400' : 'text-rose-400')
                    : cmpRank === 'loss' ? (r.m.change >= 0 ? 'text-emerald-400' : 'text-rose-400')
                      : cmpRank === 'volatility' ? 'text-fuchsia-400' : 'text-slate-300';
                  return (
                    <button key={r.id} onClick={() => pickCompare(r.id, cmpRank === 'volatility')}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-mono transition ${cmpSel === r.id ? 'bg-indigo-500/15' : 'hover:bg-indigo-500/5'}`}>
                      <span className="text-slate-600 w-4 text-right">{i + 1}</span>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorOf(r.id) }} />
                      <span className="flex-1 text-left truncate text-slate-200">{r.id}</span>
                      <span className={`tabular-nums ${vc}`}>{v}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* table */}
      {view === 'table' && (
      <div className={`rounded-2xl border overflow-hidden ${card}`}>
        <div className="max-h-[460px] overflow-auto">
          {filtered.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-center text-xs text-slate-500 px-6">{t.empty}</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className={`sticky top-0 z-10 ${dark ? 'bg-slate-900/95' : 'bg-white/95'} backdrop-blur`}>
                <tr className="text-slate-400 uppercase text-[10px] font-mono">
                  <th className="py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-indigo-400" onClick={() => toggleSort('coin')}>
                    {t.coin}{sortArrow('coin')}</th>
                  <th className="py-2.5 px-3 font-semibold">{t.state}</th>
                  <th className="py-2.5 px-3 font-semibold text-right cursor-pointer select-none hover:text-indigo-400" onClick={() => toggleSort('last')}>
                    {t.last}{sortArrow('last')}</th>
                  <th className="py-2.5 px-3 font-semibold text-right cursor-pointer select-none hover:text-indigo-400" onClick={() => toggleSort('chg')}>
                    {t.sChg}{sortArrow('chg')}</th>
                  <th className="py-2.5 px-3 font-semibold text-right cursor-pointer select-none hover:text-indigo-400" onClick={() => toggleSort('candles')}>
                    {t.candles}{sortArrow('candles')}</th>
                  <th className="py-2.5 px-3 font-semibold">{t.coverage}</th>
                  <th className="py-2.5 px-3 font-semibold text-center">{t.done}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {filtered.slice(0, 600).map((c) => (
                  <tr key={c.inst_id} onClick={() => openChart(c.inst_id)}
                    className={`cursor-pointer transition-colors ${selected === c.inst_id ? 'bg-indigo-500/10' : 'hover:bg-indigo-500/5'}`}>
                    <td className="py-2 px-3 font-bold text-slate-200">
                      {c.inst_id}
                      {isNew(c) && <span title={c.list_time ? `Listed ${fmtTs(c.list_time)}` : undefined}
                        className="ml-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/15 text-emerald-400">{t.newC}</span>}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        isPending(c) ? 'bg-amber-500/15 text-amber-400' : c.state === 'live' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                        {isPending(c) ? t.pending : (c.state || '—')}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {c.last != null ? <span className="text-slate-200">{c.last}</span> : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {c.chg24h != null
                        ? <span className={`text-[10px] ${c.chg24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{c.chg24h >= 0 ? '+' : ''}{c.chg24h}%</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-300">{(c.cnt ?? 0).toLocaleString()}</td>
                    <td className="py-2 px-3 text-[10px] text-slate-500">{fmtTs(c.first_ts)} → {fmtTs(c.last_ts)}</td>
                    <td className="py-2 px-3 text-center">{c.complete ? <span className="text-emerald-400">✓</span> : <span className="text-slate-600">·</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {filtered.length > 600 && (
          <div className="px-3 py-2 text-[10px] font-mono text-slate-500 border-t border-white/5">
            {t.showingN(600, filtered.length)}
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default OkxBacktestPanel;
