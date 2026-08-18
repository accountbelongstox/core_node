/**
 * TTS Queue tab - queue stats (by status / by type) + a paginated items table
 * filterable by status and type. Loaded directly from Laravel.
 *
 * Params mirror BooksAPI.getTtsQueueItems (status/type/start/limit).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { laravelApi } from '@/apps/pycore-manager/api';
import { GLOBAL_QUEUE_POSITION_TASK_ALIASES } from '@/core/contracts/QueueCenterContract';
import { VocabBanner, VocabLoading, humanInt, vp, toArray } from './vocabShared';

const STATUSES = ['pending', 'processing', 'completed', 'failed', 'leased'] as const;
const TYPES = GLOBAL_QUEUE_POSITION_TASK_ALIASES;
const PAGE_SIZE = 50;

export default function VocabTtsQueueTab() {
  const { t } = useTranslation('pc');
  const [stats, setStats] = useState<{ by_status?: Record<string, number>; by_type?: Record<string, number>; total?: number; current_concurrent?: number } | null>(null);
  const [status, setStatus] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [start, setStart] = useState(0);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);
  const [offline, setOffline] = useState(false);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const r = await laravelApi.getVocabTtsQueueStats();
      setStats(vp<any>(r));
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const params: Record<string, unknown> = { start, limit: PAGE_SIZE };
      if (status) params.status = status;
      if (type) params.type = type;
      const r = await laravelApi.getVocabTtsQueueItems(params);
      const p = vp<any>(r);
      setItems(toArray(p));
      setTotal(Number(p?.total || 0));
      setOffline(false);
    } catch {
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [status, type, start]);

  useEffect(() => { void loadStats(); }, [loadStats]);
  useEffect(() => { void loadItems(); }, [loadItems]);
  useEffect(() => { setStart(0); }, [status, type]);

  if (loadingStats && !stats) return <VocabLoading />;
  if (offline && !stats) {
    return <VocabBanner kind="offline" message={t('vocabularyPage.ttsQueue.offline')} />;
  }

  const statusLabel = (value: string): string => t(
    `vocabularyPage.ttsQueue.statuses.${value}`,
    { defaultValue: value },
  );
  const typeLabel = (value: string): string => t(
    `vocabularyPage.ttsQueue.types.${value}`,
    { defaultValue: value },
  );

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatBox label={t('vocabularyPage.ttsQueue.total')} value={humanInt(stats?.total)} />
        <StatBox label={t('vocabularyPage.ttsQueue.concurrent')} value={humanInt(stats?.current_concurrent)} />
        <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
          <div className="text-xs text-slate-400 mb-1">{t('vocabularyPage.ttsQueue.byStatus')}</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {STATUSES.map((s) => (
              <span key={s} className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-200">
                {statusLabel(s)}: <b>{humanInt(stats?.by_status?.[s])}</b>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
        <div className="text-xs text-slate-400 mb-1">{t('vocabularyPage.ttsQueue.byType')}</div>
        <div className="flex flex-wrap gap-2 text-xs">
          {TYPES.map((value) => (
            <span key={value} className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-200">
              {typeLabel(value)}: <b>{humanInt(stats?.by_type?.[value])}</b>
            </span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{t('vocabularyPage.ttsQueue.status')}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-400">
            <option value="">{t('vocabularyPage.ttsQueue.all')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{t('vocabularyPage.ttsQueue.type')}</span>
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-400">
            <option value="">{t('vocabularyPage.ttsQueue.all')}</option>
            {TYPES.map((value) => <option key={value} value={value}>{typeLabel(value)}</option>)}
          </select>
        </label>
      </div>

      {/* Items table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        {loadingItems ? (
          <div className="py-6"><Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" /></div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-slate-500">{t('vocabularyPage.ttsQueue.empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">{t('vocabularyPage.ttsQueue.type')}</th>
                <th className="px-3 py-2 text-left">{t('vocabularyPage.ttsQueue.status')}</th>
                <th className="px-3 py-2 text-left">{t('vocabularyPage.ttsQueue.text')}</th>
                <th className="px-3 py-2 text-left">{t('vocabularyPage.ttsQueue.language')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={(it.md5 as string) || (it.id as string) || i} className="border-t border-slate-800">
                  <td className="px-3 py-2 text-slate-300">{typeLabel(String(it.type ?? '-'))}</td>
                  <td className="px-3 py-2 text-slate-300">{statusLabel(String(it.status ?? '-'))}</td>
                  <td className="px-3 py-2 text-slate-100"><div className="truncate max-w-md">{String(it.text ?? it.word ?? it.content ?? '-')}</div></td>
                  <td className="px-3 py-2 text-slate-400">{String(it.language ?? '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{humanInt(total)} {t('vocabularyPage.ttsQueue.total')}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setStart(Math.max(0, start - PAGE_SIZE))} disabled={start === 0}
            className="px-3 py-1 rounded border border-slate-600 disabled:opacity-40 hover:bg-slate-700/50">{t('vocabularyPage.ttsQueue.previous')}</button>
          <button onClick={() => setStart(start + PAGE_SIZE)} disabled={start + PAGE_SIZE >= total}
            className="px-3 py-1 rounded border border-slate-600 disabled:opacity-40 hover:bg-slate-700/50">{t('vocabularyPage.ttsQueue.next')}</button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-2xl font-semibold text-slate-100">{value}</div>
    </div>
  );
}
