/**
 * PcHistoryList — the ONE history UI: kind filter chips, normalized rows (thumb,
 * audio play, ok/fail, time), per-row load / delete and a scoped clear. It renders
 * the result of usePcHistory; it never talks to a store itself.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, Loader2, Pause, Play, RefreshCcw, Trash2,
} from 'lucide-react';
import { fetchPycoreBlobUrl } from '@/apps/pycore-manager/api';
import { PcBlobImage } from '../PcBlobMedia';
import { usePcSingleAudio } from '../../hooks/usePcSingleAudio';
import type { PcHistory } from '../../hooks/usePcHistory';
import { PC_HISTORY_SOURCES, type PcHistoryKind, type PcHistoryRow } from '../../utils/pcHistorySources';
import { pcFailureMessage } from '../../utils/pcErrorCodes';
import { absoluteTime } from '../../utils/pcFormat';
import { PcDot } from './PcStatusPill';

const FILTER_ALL = 'all';
type FilterKey = typeof FILTER_ALL | PcHistoryKind;

export interface PcHistoryListProps {
  history: PcHistory;
  title?: React.ReactNode;
  showFilters?: boolean;
  onLoadRow?: (row: PcHistoryRow) => void;
  renderLeading?: (row: PcHistoryRow) => React.ReactNode;
  maxHeightClass?: string;
}

const PcHistoryList: React.FC<PcHistoryListProps> = ({
  history, title, showFilters = true, onLoadRow, renderLeading, maxHeightClass = 'max-h-[560px]',
}) => {
  const { t } = useTranslation('pc');
  const [filter, setFilter] = useState<FilterKey>(FILTER_ALL);
  const [busy, setBusy] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const { play, stop } = usePcSingleAudio();

  const shown = useMemo(
    () => (filter === FILTER_ALL ? history.rows : history.rows.filter((row) => row.kind === filter)),
    [history.rows, filter],
  );
  const filterKinds: FilterKey[] = history.kinds.length > 1 ? [FILTER_ALL, ...history.kinds] : [];

  const togglePlay = useCallback(async (row: PcHistoryRow) => {
    if (!row.audioPath) return;
    if (playingKey === row.key) {
      stop();
      setPlayingKey(null);
      return;
    }
    setPlayingKey(row.key);
    try {
      const src = await fetchPycoreBlobUrl(row.audioPath);
      if (src) await play(src);
    } catch { /* playback failure leaves the row idle */ }
    setPlayingKey((current) => (current === row.key ? null : current));
  }, [playingKey, play, stop]);

  const clearShown = useCallback(async () => {
    if (!window.confirm(t('aiHub.history.clearConfirm'))) return;
    setBusy(true);
    try {
      await history.clear(filter === FILTER_ALL ? undefined : filter);
    } finally {
      setBusy(false);
    }
  }, [filter, history, t]);

  const removeRow = useCallback(async (row: PcHistoryRow) => {
    setBusy(true);
    try {
      await history.remove(row);
    } finally {
      setBusy(false);
    }
  }, [history]);

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          {title}
          <span className="text-[11px] font-mono font-normal text-slate-400">
            {t('aiHub.history.records', { count: history.rows.length })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => { void history.refresh(); }}
            title={t('common.refresh')}
            className="p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition">
            <RefreshCcw className={`w-3.5 h-3.5 ${history.loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => { void clearShown(); }}
            disabled={busy || shown.length === 0}
            title={filter === FILTER_ALL ? t('aiHub.history.clearAll') : t('aiHub.history.clearKind')}
            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition disabled:opacity-40">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {history.unreachable && (
        <div className="flex items-start gap-2 text-xs rounded-xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-500">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{t('aiHub.history.unreachable')}</span>
        </div>
      )}

      {showFilters && filterKinds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filterKinds.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                filter === key ? 'bg-indigo-500/15 text-indigo-500' : 'text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
              }`}>
              {key === FILTER_ALL ? t('aiHub.history.all') : t(PC_HISTORY_SOURCES[key].labelKey)}
              <span className="ml-1 opacity-60 font-mono">{history.counts[key] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {shown.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-center text-xs text-slate-500 px-6">
            {history.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('aiHub.history.empty')}
          </div>
        ) : (
          <ul className={`divide-y divide-slate-200/70 dark:divide-slate-800/70 overflow-auto ${maxHeightClass}`}>
            {shown.map((row) => {
              const source = PC_HISTORY_SOURCES[row.kind];
              const Icon = source.Icon;
              const leading = renderLeading?.(row);
              const playing = playingKey === row.key;
              return (
                <li key={row.key} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-100/50 dark:hover:bg-white/5 transition">
                  {leading ?? (row.thumbPath ? (
                    <PcBlobImage
                      path={row.thumbPath}
                      alt=""
                      loading="lazy"
                      className="w-10 h-10 rounded-lg object-cover bg-slate-200 dark:bg-slate-800 shrink-0"
                    />
                  ) : row.audioPath ? (
                    <button
                      type="button"
                      onClick={() => { void togglePlay(row); }}
                      title={playing ? t('aiHub.history.pause') : t('aiHub.history.play')}
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25">
                      {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                  ) : (
                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 shrink-0 ${source.accent}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                  ))}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                      <PcDot tone={row.ok ? 'ok' : 'bad'} />
                      <Icon className={`w-3 h-3 shrink-0 ${source.accent}`} />
                      <span className="truncate">{row.title || '—'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{row.subtitle}</div>
                    {!row.ok && row.error && (
                      <div className="text-[11px] text-rose-500 truncate" title={row.error}>
                        {pcFailureMessage({ error_code: row.error }, t('aiHub.history.failed'))}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 hidden sm:block">{absoluteTime(row.ts)}</span>
                  {onLoadRow && (
                    <button
                      type="button"
                      onClick={() => onLoadRow(row)}
                      className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:border-fuchsia-300 hover:text-fuchsia-500 transition shrink-0">
                      {t('aiHub.history.load')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { void removeRow(row); }}
                    disabled={busy}
                    title={t('aiHub.history.delete')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition shrink-0 disabled:opacity-40">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PcHistoryList;
