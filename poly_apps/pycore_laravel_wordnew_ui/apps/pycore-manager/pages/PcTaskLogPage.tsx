/**
 * PcTaskLogPage — search persisted task history by keyword and date range.
 */
import React, { useCallback, useState } from 'react';
import { Search, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pycoreApi } from '@/apps/pycore-manager/api';
import { GLOBAL_TASK_LIMITS } from '@/apps/pycore-manager/api';

const PcTaskLogPage: React.FC = () => {
  const { t } = useTranslation('pc');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [entries, setEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await pycoreApi.searchTaskHistory({
        q: q.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit: GLOBAL_TASK_LIMITS.history_records,
      });
      setEntries(r?.entries ?? []);
      setTotal(r?.total ?? 0);
    } catch (e: any) {
      setErr(e?.message || 'search failed');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [q, dateFrom, dateTo]);

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('taskLog.title')}</h1>
        <p className="text-xs text-slate-500 mt-0.5">{t('taskLog.subtitle')}</p>
      </div>
      <section className="pc-glass p-4 flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1 text-[10px] text-slate-400 flex-1 min-w-[12rem]">
          {t('taskLog.keyword')}
          <input value={q} onChange={(e) => setQ(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm pc-glass border-0 bg-slate-500/5"
            placeholder={t('taskLog.keywordPh')} />
        </label>
        <label className="flex flex-col gap-1 text-[10px] text-slate-400">
          {t('taskLog.from')}
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm pc-glass border-0 bg-slate-500/5" />
        </label>
        <label className="flex flex-col gap-1 text-[10px] text-slate-400">
          {t('taskLog.to')}
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm pc-glass border-0 bg-slate-500/5" />
        </label>
        <button type="button" onClick={search} disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-500/15 text-indigo-500 hover:bg-indigo-500/25 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {t('taskLog.search')}
        </button>
      </section>
      {err && <p className="text-sm text-rose-500 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{err}</p>}
      <section className="pc-glass overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-500/10 text-[10px] uppercase text-slate-400 flex justify-between">
          <span>{t('taskLog.results')}</span>
          <span>{total} {t('taskLog.matches')}</span>
        </div>
        <ul className="divide-y divide-slate-500/10 max-h-[60vh] overflow-y-auto text-xs">
          {!entries.length ? (
            <li className="p-4 text-slate-400">{loading ? t('queueCenter.overview.loading') : t('taskLog.empty')}</li>
          ) : entries.map((e, i) => (
            <li key={`${e.at}-${i}`} className="px-3 py-2">
              <div className="flex gap-2">
                <span className="text-[10px] font-mono text-slate-400 shrink-0">{e.ts?.slice(0, 19) || '—'}</span>
                <span className="text-[10px] uppercase text-indigo-400 shrink-0">{e.task_type}</span>
                <span className={`text-[10px] shrink-0 ${e.success ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {e.success ? 'ok' : 'fail'}
                </span>
              </div>
              <p className="text-slate-700 dark:text-slate-200 mt-0.5 truncate" title={e.title || e.content}>
                {e.title || e.content || '—'}
              </p>
              {e.error && <p className="text-[10px] text-rose-400 truncate">{e.error}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default PcTaskLogPage;
