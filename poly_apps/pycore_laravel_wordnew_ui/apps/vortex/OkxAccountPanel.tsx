/**
 * OkxAccountPanel — the OKX account surface of the Vortex "持仓与账本" (ledger) tab.
 * Lives ONLY in /vortex (alongside OkxBacktestPanel). Shows REAL OKX-API account data
 * side-by-side with the LOCAL simulated account so the two can never be confused: a
 * "LIVE" emerald column (balance / positions / bills from the centralized account controller)
 * vs a "SIM" indigo column (sim equity / cash / position count passed in via props).
 *
 * Mirrors OkxBacktestPanel's conventions: bilingual L(lang) (every string en+zh),
 * dark+lang props, card/chip Tailwind helpers, lucide icons, fmtTs timestamps.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw, AlertTriangle, Wallet, Radio, FlaskConical, TrendingUp, TrendingDown, Receipt,
} from 'lucide-react';
import { connectPycoreHttp, requestPycoreHttp, onHttpStatus } from '../../core/api-libs/pycore';
import { VORTEX_PYCORE_HTTP_ROUTES } from '../../core/api-libs/pycore/PycoreHttpRoutes';

interface BalanceDetail { ccy: string; eq: string; availBal: string }
interface OkxPosition { instId: string; pos: string; avgPx: string; upl: string; uplRatio?: string }
interface OkxBill { billId?: string; ts: string; type?: string; ccy: string; balChg?: string; bal?: string }
interface AccountOverview {
  configured?: boolean; has_passphrase?: boolean; ok?: boolean; error?: string | null;
  balance?: { totalEq?: string; details?: BalanceDetail[] } | null;
  positions?: OkxPosition[];
  bills?: OkxBill[];
}

// OKX bill ts can be epoch-ms string or already-formatted; render epoch-ms as a locale time.
const fmtTs = (ts?: string): string => {
  if (!ts) return '—';
  const n = Number(ts);
  if (Number.isFinite(n) && n > 1e10) return new Date(n).toLocaleString();
  return ts;
};
const fmtNum = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signCls = (v?: string) => (v != null && parseFloat(v) < 0 ? 'text-rose-400' : 'text-emerald-400');

const L = (lang: string) => (lang === 'en'
  ? {
      title: 'Account — Real vs Simulated', sub: 'Live OKX API balance alongside the local sandbox',
      refresh: 'Refresh', unreachable: 'pycore unreachable — live account unavailable.',
      // real column
      real: 'Real (OKX API)', live: 'LIVE',
      totalEq: 'Total equity', balances: 'Balances', positions: 'Positions', bills: 'Recent bills',
      ccy: 'Ccy', eq: 'Equity', avail: 'Available', inst: 'Instrument', pos: 'Position', avgPx: 'Avg price', upl: 'uPnL',
      time: 'Time', type: 'Type', change: 'Change',
      notConfigured: 'OKX API not configured — set OKX_API_KEY / OKX_SECRET / OKX_PASSPHRASE.',
      noPassphrase: 'Set OKX_PASSPHRASE to read the live account.',
      noBalances: 'No balances.', noPositions: 'No open positions.', noBills: 'No recent bills.',
      // sim column
      sim: 'Simulated (local)', simChip: 'SIM',
      simEquity: 'Sim equity', simCash: 'Cash', simPositions: 'Open positions', simNote: 'Local sandbox — not real funds.',
    }
  : {
      title: '账户 —— 真实 vs 模拟', sub: '实时 OKX API 余额与本地沙盒并排显示',
      refresh: '刷新', unreachable: 'pycore 不可达 —— 无法获取实时账户。',
      real: '真实账户(API)', live: '真实',
      totalEq: '总权益', balances: '余额', positions: '持仓', bills: '近期账单',
      ccy: '币种', eq: '权益', avail: '可用', inst: '合约', pos: '仓位', avgPx: '均价', upl: '未实现盈亏',
      time: '时间', type: '类型', change: '变动',
      notConfigured: 'OKX API 未配置 —— 请设置 OKX_API_KEY / OKX_SECRET / OKX_PASSPHRASE。',
      noPassphrase: '请设置 OKX_PASSPHRASE 以读取实时账户。',
      noBalances: '暂无余额。', noPositions: '暂无持仓。', noBills: '暂无近期账单。',
      sim: '模拟账户(本地)', simChip: '模拟',
      simEquity: '模拟权益', simCash: '现金', simPositions: '持仓数', simNote: '本地沙盒 —— 非真实资金。',
    });

interface Props { dark: boolean; lang: string; simCash: number; simPositionsCount: number; simEquity: number }

export const OkxAccountPanel: React.FC<Props> = ({ dark, lang, simCash, simPositionsCount, simEquity }) => {
  const t = L(lang);
  const [acct, setAcct] = useState<AccountOverview | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.accountOverview, {}, 12000);
      if (r) setAcct(r);
      setUnreachable(false);
    } catch {
      setUnreachable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load is driven by HTTP readiness, mirroring OkxBacktestPanel.
  useEffect(() => {
    connectPycoreHttp();
    const off = onHttpStatus((c) => { if (c) refresh(); });
    return () => { off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = dark ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-200';
  // real account is healthy only when configured + passphrase + ok
  const realOk = !!acct?.configured && !!acct?.has_passphrase && !!acct?.ok;
  const realError = acct?.error
    || (!acct?.configured ? t.notConfigured : (!acct?.has_passphrase ? t.noPassphrase : null));

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2 text-slate-100">
            <Wallet className="w-5 h-5 text-indigo-400" /> {t.title}
          </h2>
          <p className="text-xs text-slate-400 font-mono">{t.sub}</p>
        </div>
        <button onClick={refresh} title={t.refresh}
          className={`p-2.5 rounded-xl border ${card} text-slate-400 hover:text-indigo-400 transition`}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {unreachable && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{t.unreachable}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ===== REAL (OKX API) — emerald LIVE accent ===== */}
        <div className={`p-4 rounded-2xl border-2 border-emerald-500/30 ${dark ? 'bg-emerald-500/[0.03]' : 'bg-emerald-50/40'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-black flex items-center gap-2 text-slate-200">
              <Radio className="w-4 h-4 text-emerald-400" /> {t.real}
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-500/15 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {t.live}
            </span>
          </div>

          {!realOk ? (
            <div className="flex items-start gap-2 text-xs rounded-xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{realError}</span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* total equity */}
              <div className={`p-3 rounded-xl border ${card}`}>
                <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">{t.totalEq}</div>
                <div className="text-2xl font-black font-mono tabular-nums text-emerald-400 leading-tight">
                  {acct?.balance?.totalEq ?? '—'}
                </div>
              </div>

              {/* balances table */}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">{t.balances}</div>
                <div className={`rounded-xl border overflow-hidden ${card}`}>
                  {(acct?.balance?.details && acct.balance.details.length > 0) ? (
                    <div className="max-h-40 overflow-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className={`sticky top-0 ${dark ? 'bg-slate-900/95' : 'bg-white/95'} backdrop-blur`}>
                          <tr className="text-slate-400 uppercase text-[9px]">
                            <th className="py-1.5 px-2.5 font-semibold">{t.ccy}</th>
                            <th className="py-1.5 px-2.5 font-semibold text-right">{t.eq}</th>
                            <th className="py-1.5 px-2.5 font-semibold text-right">{t.avail}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {acct.balance.details.map((b) => (
                            <tr key={b.ccy} className="hover:bg-emerald-500/5">
                              <td className="py-1.5 px-2.5 font-bold text-slate-200">{b.ccy}</td>
                              <td className="py-1.5 px-2.5 text-right tabular-nums text-slate-300">{b.eq}</td>
                              <td className="py-1.5 px-2.5 text-right tabular-nums text-slate-400">{b.availBal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-12 flex items-center justify-center text-[11px] text-slate-500">{t.noBalances}</div>
                  )}
                </div>
              </div>

              {/* positions table */}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">{t.positions}</div>
                <div className={`rounded-xl border overflow-hidden ${card}`}>
                  {(acct?.positions && acct.positions.length > 0) ? (
                    <div className="max-h-40 overflow-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className={`sticky top-0 ${dark ? 'bg-slate-900/95' : 'bg-white/95'} backdrop-blur`}>
                          <tr className="text-slate-400 uppercase text-[9px]">
                            <th className="py-1.5 px-2.5 font-semibold">{t.inst}</th>
                            <th className="py-1.5 px-2.5 font-semibold text-right">{t.pos}</th>
                            <th className="py-1.5 px-2.5 font-semibold text-right">{t.avgPx}</th>
                            <th className="py-1.5 px-2.5 font-semibold text-right">{t.upl}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {acct.positions.map((p) => (
                            <tr key={p.instId} className="hover:bg-emerald-500/5">
                              <td className="py-1.5 px-2.5 font-bold text-slate-200">{p.instId}</td>
                              <td className="py-1.5 px-2.5 text-right tabular-nums text-slate-300">{p.pos}</td>
                              <td className="py-1.5 px-2.5 text-right tabular-nums text-slate-400">{p.avgPx}</td>
                              <td className={`py-1.5 px-2.5 text-right tabular-nums font-bold ${signCls(p.upl)}`}>
                                {p.upl}{p.uplRatio != null ? <span className="text-[9px] ml-1 opacity-80">({p.uplRatio})</span> : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-12 flex items-center justify-center text-[11px] text-slate-500">{t.noPositions}</div>
                  )}
                </div>
              </div>

              {/* recent bills */}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                  <Receipt className="w-3 h-3" /> {t.bills}
                </div>
                <div className={`rounded-xl border overflow-hidden ${card}`}>
                  {(acct?.bills && acct.bills.length > 0) ? (
                    <div className="max-h-40 overflow-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className={`sticky top-0 ${dark ? 'bg-slate-900/95' : 'bg-white/95'} backdrop-blur`}>
                          <tr className="text-slate-400 uppercase text-[9px]">
                            <th className="py-1.5 px-2.5 font-semibold">{t.time}</th>
                            <th className="py-1.5 px-2.5 font-semibold">{t.type}</th>
                            <th className="py-1.5 px-2.5 font-semibold">{t.ccy}</th>
                            <th className="py-1.5 px-2.5 font-semibold text-right">{t.change}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {acct.bills.map((b, i) => (
                            <tr key={b.billId ?? i} className="hover:bg-emerald-500/5">
                              <td className="py-1.5 px-2.5 text-[10px] text-slate-400">{fmtTs(b.ts)}</td>
                              <td className="py-1.5 px-2.5 text-slate-300">{b.type ?? '—'}</td>
                              <td className="py-1.5 px-2.5 font-bold text-slate-200">{b.ccy}</td>
                              <td className={`py-1.5 px-2.5 text-right tabular-nums font-bold ${signCls(b.balChg)}`}>{b.balChg ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-12 flex items-center justify-center text-[11px] text-slate-500">{t.noBills}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===== SIMULATED (local) — indigo SIM accent ===== */}
        <div className={`p-4 rounded-2xl border-2 border-indigo-500/30 ${dark ? 'bg-indigo-500/[0.03]' : 'bg-indigo-50/40'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-black flex items-center gap-2 text-slate-200">
              <FlaskConical className="w-4 h-4 text-indigo-400" /> {t.sim}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-indigo-500/15 text-indigo-400">{t.simChip}</span>
          </div>

          <div className="space-y-3">
            <div className={`p-3 rounded-xl border ${card}`}>
              <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">{t.simEquity}</div>
              <div className="text-2xl font-black font-mono tabular-nums text-indigo-400 leading-tight">
                ${fmtNum(simEquity)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-3 rounded-xl border ${card} flex items-center gap-2.5`}>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">{t.simCash}</div>
                  <div className="text-base font-black font-mono tabular-nums text-slate-100 leading-none">${fmtNum(simCash)}</div>
                </div>
              </div>
              <div className={`p-3 rounded-xl border ${card} flex items-center gap-2.5`}>
                <TrendingDown className="w-4 h-4 text-fuchsia-400" />
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">{t.simPositions}</div>
                  <div className="text-base font-black font-mono tabular-nums text-slate-100 leading-none">{simPositionsCount}</div>
                </div>
              </div>
            </div>
            <p className="text-[10px] font-mono text-slate-500">{t.simNote}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OkxAccountPanel;
