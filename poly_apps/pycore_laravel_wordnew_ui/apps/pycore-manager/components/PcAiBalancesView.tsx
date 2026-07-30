/**
 * PcAiBalancesView — "Account balances" section of the AI / Keys sub-view.
 *
 * Surfaces the RPC v2 AI balance response: remaining credit for the handful of
 * providers that publish a machine-readable balance endpoint (openrouter /
 * deepseek / siliconflow / moonshot). Balances are NEVER auto-fetched on mount
 * (a balance call spends nothing but does hit the provider) — the user clicks
 * "Check balances" (or the page Refresh button) to query them live.
 *
 * Every other registered provider has no balance API and is listed compactly as
 * "No balance endpoint" so the user understands the coverage, not a gap.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet, RefreshCcw, AlertTriangle, CheckCircle2, MinusCircle, XCircle, Info,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { AiBalance, AiBalanceResponse } from '../../../core/api-libs/pycore';
import { logInfo, logSuccess, logError } from '../../../core/logstore/logStore';

const LOG_SRC = 'pc-ai-balance';

/** Compact currency-aware amount, e.g. "4.2 USD". Falls back to a dash. */
const fmtAmount = (v: number | null, currency: string | null): string => {
  if (v === null || v === undefined) return '—';
  const num = Math.abs(v) >= 100 ? v.toFixed(2) : v.toFixed(v % 1 === 0 ? 0 : 4);
  return `${parseFloat(num)}${currency ? ` ${currency}` : ''}`;
};

const BalanceCard: React.FC<{ b: AiBalance; t: (k: string, o?: any) => string }> = ({ b, t }) => {
  const ok = b.ok && b.balance !== null;
  return (
    <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{b.name}</span>
        {!b.configured ? (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-slate-500/15 text-slate-400">
            <MinusCircle className="w-3 h-3" /> {t('aiKeys.noKey')}
          </span>
        ) : ok ? (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-500">
            <CheckCircle2 className="w-3 h-3" /> {b.is_free_tier ? t('aiBalance.freeTier') : 'OK'}
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-rose-500/15 text-rose-500">
            <XCircle className="w-3 h-3" /> {t('aiBalance.failed')}
          </span>
        )}
      </div>

      {ok ? (
        <>
          <div className="flex items-baseline gap-1.5">
            <Wallet className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {fmtAmount(b.balance, b.currency)}
            </span>
            <span className="text-[10px] text-slate-400">{t('aiBalance.remaining')}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
            {b.total !== null && <span>{t('aiBalance.total')}: {fmtAmount(b.total, b.currency)}</span>}
            {b.used !== null && <span>{t('aiBalance.used')}: {fmtAmount(b.used, b.currency)}</span>}
            {b.granted !== null && <span>{t('aiBalance.granted')}: {fmtAmount(b.granted, b.currency)}</span>}
            {b.topped_up !== null && <span>{t('aiBalance.toppedUp')}: {fmtAmount(b.topped_up, b.currency)}</span>}
          </div>
        </>
      ) : !b.configured ? (
        <p className="text-[11px] italic text-slate-400">{t('aiBalance.notConfigured')}</p>
      ) : (
        <p className="text-[11px] text-rose-500 break-words">{b.error || t('aiBalance.failed')}</p>
      )}

      {b.key_masked && (
        <span className="text-[10px] font-mono text-slate-400 truncate">{b.key_masked}</span>
      )}
    </div>
  );
};

const PcAiBalancesView: React.FC<{ refreshSignal?: number }> = ({ refreshSignal }) => {
  const { t } = useTranslation('pc');
  const [data, setData] = useState<AiBalanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    logInfo(LOG_SRC, 'Checking AI account balances…');
    try {
      const r = await pycoreApi.getAiBalances();
      if (!Array.isArray(r?.providers)) {
        // getJSON does not throw on non-2xx: a 404 from a STALE pycore arrives
        // as {detail:"Not Found"}. Surface it instead of showing empty balances.
        const detail = (r as any)?.detail || (r as any)?.error;
        setData(null);
        setUnreachable(false);
        setError(detail
          ? `${detail} — AI balance endpoint missing; restart pycore to load it.`
          : 'AI balance endpoint returned nothing; restart pycore to load it.');
        logError(LOG_SRC, 'Balance endpoint returned no providers.');
        return;
      }
      setData(r);
      setUnreachable(false);
      const okCount = (r?.providers ?? []).filter((b) => b.ok).length;
      logSuccess(LOG_SRC, `Balances checked — ${okCount} provider(s) reported.`);
    } catch (e: any) {
      setUnreachable(true);
      setError(e?.message || 'pycore unreachable');
      logError(LOG_SRC, e?.message || 'Balance check failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // External refresh signal (PcAiPage Refresh button) re-queries IF already loaded.
  useEffect(() => {
    if (refreshSignal === undefined || data === null) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const providers = data?.providers ?? [];
  const unsupported = data?.unsupported ?? [];

  return (
    <section className="pc-glass p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <Wallet className="w-4 h-4 text-indigo-500" /> {t('aiBalance.section')}
        </h2>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          title={t('aiBalance.refreshTitle')}
          className="shrink-0 px-3 py-1.5 pc-glass hover:bg-indigo-500/10 text-xs font-bold rounded-xl flex items-center gap-1.5 transition text-slate-700 dark:text-slate-200 disabled:opacity-50">
          {loading ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
          {loading ? t('aiBalance.checking') : t('aiBalance.check')}
        </button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('aiBalance.hint')}</p>

      {(unreachable || error) && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 mb-4 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">
            {t('aiBalance.unreachable')}{error ? ` (${error})` : ''}
          </span>
        </div>
      )}

      {data === null ? (
        !loading && (
          <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
            {t('aiBalance.check')} →
          </div>
        )
      ) : providers.length === 0 ? (
        <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
          {t('aiBalance.empty')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {providers.map((b) => <BalanceCard key={b.name} b={b} t={t} />)}
        </div>
      )}

      {loading && data === null && (
        <div className="text-xs text-slate-500 py-8 text-center flex flex-col items-center gap-2">
          <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" /> {t('aiBalance.loading')}
        </div>
      )}

      {unsupported.length > 0 && (
        <div className="mt-4 flex items-start gap-2 text-[11px] rounded-2xl p-3 border bg-slate-500/8 border-slate-400/20 text-slate-500 dark:text-slate-400">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-600 dark:text-slate-300">{t('aiBalance.unsupportedTitle')}</p>
            <p className="leading-snug">{t('aiBalance.unsupportedHint', { count: unsupported.length })}</p>
            <p className="mt-1 font-mono text-[10px] break-words opacity-80">{unsupported.join(' · ')}</p>
          </div>
        </div>
      )}
    </section>
  );
};

export default PcAiBalancesView;
