/**
 * PddRechargePage — recharge / payment records table with a status filter
 * (GET /recharges?status=&page=). Strings via the `pdd` namespace.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/apps/pdd-manager/api';
import type { PddRecharge, PddRechargeStatus } from '@/apps/pdd-manager/api';

const STATUSES: (PddRechargeStatus | '')[] = ['', 'pending', 'paid', 'failed', 'refunded'];

const STATUS_CLS: Record<PddRechargeStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  paid: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  failed: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  refunded: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
};

const PddRechargePage: React.FC = () => {
  const { t } = useTranslation('pdd');
  const [rows, setRows] = useState<PddRecharge[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PddRechargeStatus | ''>('');
  const [loading, setLoading] = useState(false);

  const PER_PAGE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.pddAdmin.listRecharges({ status, page });
      setRows(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { void load(); }, [load]);

  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  const statusLabel = (s: PddRechargeStatus | ''): string => {
    if (s === '') return t('common.all');
    return t(`recharge.status${s.charAt(0).toUpperCase()}${s.slice(1)}`);
  };
  const methodLabel = (m: string): string => (m === 'wechat' ? t('recharge.methodWechat') : t('recharge.methodAlipay'));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('recharge.title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('recharge.subtitle')}</p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">{t('recharge.statusFilter')}:</span>
          <div className="flex gap-1">
            {STATUSES.map((s) => (
              <button
                key={s || 'all'}
                onClick={() => { setPage(1); setStatus(s); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  status === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {statusLabel(s)}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => void load()} className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-2.5 font-medium">{t('recharge.colId')}</th>
                <th className="px-4 py-2.5 font-medium">{t('recharge.colUser')}</th>
                <th className="px-4 py-2.5 font-medium text-right">{t('recharge.colAmount')}</th>
                <th className="px-4 py-2.5 font-medium">{t('recharge.colMethod')}</th>
                <th className="px-4 py-2.5 font-medium">{t('recharge.colStatus')}</th>
                <th className="px-4 py-2.5 font-medium">{t('recharge.colTradeNo')}</th>
                <th className="px-4 py-2.5 font-medium">{t('recharge.colPackage')}</th>
                <th className="px-4 py-2.5 font-medium">{t('recharge.colCreated')}</th>
                <th className="px-4 py-2.5 font-medium">{t('recharge.colPaid')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">{loading ? t('common.loading') : t('recharge.empty')}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                  <td className="px-4 py-2.5 text-slate-500">{r.id}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{r.username}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-300">¥{r.amount}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{methodLabel(r.method)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[r.status]}`}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.out_trade_no}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{r.package_name || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{r.created_at}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{r.paid_at || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500">
          <span>{t('common.page')} {page} {t('common.of')} {lastPage} · {total}</span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className="w-4 h-4" /></button>
            <button disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))} className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PddRechargePage;
