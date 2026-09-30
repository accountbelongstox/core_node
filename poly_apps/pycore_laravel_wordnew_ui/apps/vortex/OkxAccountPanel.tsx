/** OKX account surface of the /vortex ledger tab: live OKX data beside the local simulated account. */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw, AlertTriangle, Wallet, Radio, FlaskConical, TrendingUp, TrendingDown, Receipt,
} from 'lucide-react';
import { classifyPycoreAccess, connectPycoreHttp, requestPycoreHttp, onHttpStatus, type PycoreAccess } from '@/apps/vortex/api';
import { VORTEX_PYCORE_HTTP_ROUTES } from '@/apps/vortex/api';
import { VortexPycoreNotice } from './VortexPycoreNotice';
import { formatNumber, formatTimestamp } from '../../core/utils/formatters';

interface BalanceDetail { ccy: string; eq: string; availBal: string }
interface OkxPosition { instId: string; pos: string; avgPx: string; upl: string; uplRatio?: string }
interface OkxBill { billId?: string; ts: string; type?: string; ccy: string; balChg?: string; bal?: string }
interface AccountOverview {
  configured?: boolean; has_passphrase?: boolean; ok?: boolean; error?: string | null;
  balance?: { totalEq?: string; details?: BalanceDetail[] } | null;
  positions?: OkxPosition[];
  bills?: OkxBill[];
}

const signCls = (v?: string) => (v != null && parseFloat(v) < 0 ? 'text-rose-400' : 'text-emerald-400');

interface Props { dark: boolean; simCash: number; simPositionsCount: number; simEquity: number }

export const OkxAccountPanel: React.FC<Props> = ({ dark, simCash, simPositionsCount, simEquity }) => {
  const { t } = useTranslation('vx');
  const [acct, setAcct] = useState<AccountOverview | null>(null);
  const [failure, setFailure] = useState<PycoreAccess | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.accountOverview, {}, 12000);
      if (r) setAcct(r);
      setFailure(null);
    } catch (error) {
      setFailure(classifyPycoreAccess(error));
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
    || (!acct?.configured ? t('account.notConfigured') : (!acct?.has_passphrase ? t('account.noPassphrase') : null));

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2 text-slate-100">
            <Wallet className="w-5 h-5 text-indigo-400" /> {t('account.title')}
          </h2>
          <p className="text-xs text-slate-400 font-mono">{t('account.sub')}</p>
        </div>
        <button onClick={refresh} title={t('account.refresh')}
          className={`p-2.5 rounded-xl border ${card} text-slate-400 hover:text-indigo-400 transition`}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <VortexPycoreNotice failure={failure} unreachableText={t('account.unreachable')} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ===== REAL (OKX API) — emerald LIVE accent ===== */}
        <div className={`p-4 rounded-2xl border-2 border-emerald-500/30 ${dark ? 'bg-emerald-500/[0.03]' : 'bg-emerald-50/40'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-black flex items-center gap-2 text-slate-200">
              <Radio className="w-4 h-4 text-emerald-400" /> {t('account.real')}
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-500/15 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {t('account.live')}
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
                <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">{t('account.totalEq')}</div>
                <div className="text-2xl font-black font-mono tabular-nums text-emerald-400 leading-tight">
                  {acct?.balance?.totalEq ?? '—'}
                </div>
              </div>

              {/* balances table */}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">{t('account.balances')}</div>
                <div className={`rounded-xl border overflow-hidden ${card}`}>
                  {(acct?.balance?.details && acct.balance.details.length > 0) ? (
                    <div className="max-h-40 overflow-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className={`sticky top-0 ${dark ? 'bg-slate-900/95' : 'bg-white/95'} backdrop-blur`}>
                          <tr className="text-slate-400 uppercase text-[9px]">
                            <th className="py-1.5 px-2.5 font-semibold">{t('account.ccy')}</th>
                            <th className="py-1.5 px-2.5 font-semibold text-right">{t('account.eq')}</th>
                            <th className="py-1.5 px-2.5 font-semibold text-right">{t('account.avail')}</th>
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
                    <div className="h-12 flex items-center justify-center text-[11px] text-slate-500">{t('account.noBalances')}</div>
                  )}
                </div>
              </div>

              {/* positions table */}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">{t('account.positions')}</div>
                <div className={`rounded-xl border overflow-hidden ${card}`}>
                  {(acct?.positions && acct.positions.length > 0) ? (
                    <div className="max-h-40 overflow-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className={`sticky top-0 ${dark ? 'bg-slate-900/95' : 'bg-white/95'} backdrop-blur`}>
                          <tr className="text-slate-400 uppercase text-[9px]">
                            <th className="py-1.5 px-2.5 font-semibold">{t('account.inst')}</th>
                            <th className="py-1.5 px-2.5 font-semibold text-right">{t('account.pos')}</th>
                            <th className="py-1.5 px-2.5 font-semibold text-right">{t('account.avgPx')}</th>
                            <th className="py-1.5 px-2.5 font-semibold text-right">{t('account.upl')}</th>
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
                    <div className="h-12 flex items-center justify-center text-[11px] text-slate-500">{t('account.noPositions')}</div>
                  )}
                </div>
              </div>

              {/* recent bills */}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                  <Receipt className="w-3 h-3" /> {t('account.bills')}
                </div>
                <div className={`rounded-xl border overflow-hidden ${card}`}>
                  {(acct?.bills && acct.bills.length > 0) ? (
                    <div className="max-h-40 overflow-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className={`sticky top-0 ${dark ? 'bg-slate-900/95' : 'bg-white/95'} backdrop-blur`}>
                          <tr className="text-slate-400 uppercase text-[9px]">
                            <th className="py-1.5 px-2.5 font-semibold">{t('account.time')}</th>
                            <th className="py-1.5 px-2.5 font-semibold">{t('account.type')}</th>
                            <th className="py-1.5 px-2.5 font-semibold">{t('account.ccy')}</th>
                            <th className="py-1.5 px-2.5 font-semibold text-right">{t('account.change')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {acct.bills.map((b, i) => (
                            <tr key={b.billId ?? i} className="hover:bg-emerald-500/5">
                              <td className="py-1.5 px-2.5 text-[10px] text-slate-400">{formatTimestamp(b.ts)}</td>
                              <td className="py-1.5 px-2.5 text-slate-300">{b.type ?? '—'}</td>
                              <td className="py-1.5 px-2.5 font-bold text-slate-200">{b.ccy}</td>
                              <td className={`py-1.5 px-2.5 text-right tabular-nums font-bold ${signCls(b.balChg)}`}>{b.balChg ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-12 flex items-center justify-center text-[11px] text-slate-500">{t('account.noBills')}</div>
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
              <FlaskConical className="w-4 h-4 text-indigo-400" /> {t('account.sim')}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-indigo-500/15 text-indigo-400">{t('account.simChip')}</span>
          </div>

          <div className="space-y-3">
            <div className={`p-3 rounded-xl border ${card}`}>
              <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">{t('account.simEquity')}</div>
              <div className="text-2xl font-black font-mono tabular-nums text-indigo-400 leading-tight">
                ${formatNumber(simEquity)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-3 rounded-xl border ${card} flex items-center gap-2.5`}>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">{t('account.simCash')}</div>
                  <div className="text-base font-black font-mono tabular-nums text-slate-100 leading-none">${formatNumber(simCash)}</div>
                </div>
              </div>
              <div className={`p-3 rounded-xl border ${card} flex items-center gap-2.5`}>
                <TrendingDown className="w-4 h-4 text-fuchsia-400" />
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">{t('account.simPositions')}</div>
                  <div className="text-base font-black font-mono tabular-nums text-slate-100 leading-none">{simPositionsCount}</div>
                </div>
              </div>
            </div>
            <p className="text-[10px] font-mono text-slate-500">{t('account.simNote')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OkxAccountPanel;
