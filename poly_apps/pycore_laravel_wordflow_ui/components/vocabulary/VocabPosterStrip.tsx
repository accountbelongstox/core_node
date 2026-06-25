import React, { useState } from 'react';
import { RefreshCw, AlertTriangle, Clapperboard, KeyRound, Image as ImageIcon } from 'lucide-react';
import { api } from '../../core/api';
import type { PosterStatusData, PosterStatusCounts } from '../../core/api/modules/AppQyV1';
import { commonClasses } from '../../styles/theme';
import { useToast } from '../admin';
import { logError, logInfo, logSuccess } from '../../core/logstore/logStore';
import { useApiResource } from '../../hooks';

const POSTER_COUNT_FIELDS: Array<{ key: keyof PosterStatusCounts; label: string; cls: string }> = [
  { key: 'pending', label: 'Pending', cls: 'text-yellow-600 dark:text-yellow-400' },
  { key: 'ready', label: 'Ready', cls: 'text-green-600 dark:text-green-400' },
  { key: 'failed', label: 'Failed', cls: 'text-red-600 dark:text-red-400' },
  { key: 'none', label: 'None', cls: 'text-slate-500 dark:text-slate-400' },
];

const VocabPosterStrip: React.FC = () => {
  const toast = useToast();
  const [fetching, setFetching] = useState(false);

  // Shape-check folded into the fetcher: a real snapshot carries a `counts` object
  // plus a `providers` array. A stale-backend 404 resolves (via BaseAPI) to
  // {success:false} OR a 200 body without counts. Either is "endpoint missing" —
  // throw so the hook leaves data null and surfaces the restart notice instead of
  // rendering empty/zero counts silently.
  const { data, loading, error, refresh } = useApiResource<PosterStatusData>(
    async () => {
      const res = await api.appQyV1.getPosterStatus();
      if (res.success && res.data && (res.data as any).counts && Array.isArray((res.data as any).providers)) {
        return res.data;
      }
      throw new Error('Poster status endpoint missing — restart the laravel backend.');
    },
    { pollMs: 10000 }
  );
  // null = not loaded; otherwise message (mirrors the old `err` one-liner string).
  const err: string | null = error;

  // "Fetch / retry" is informational here (per-row fetch needs a media id) — it
  // simply re-reads the snapshot so freshly-claimed posters surface. The real
  // per-row fetch lives in the media views; this card monitors progress.
  const handleRefresh = async () => {
    setFetching(true);
    logInfo('posters', 'Refreshing movie/TV poster pipeline status…');
    try {
      const result = await refresh();
      if (result) {
        logSuccess('posters', 'Poster pipeline status refreshed');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to refresh poster status');
      logError('posters', `Poster status refresh failed: ${e?.message || e}`);
    } finally {
      setFetching(false);
    }
  };

  // Offline / endpoint-missing: one muted line, never a broken card.
  if (!data) {
    return (
      <div className={`${commonClasses.card} p-3 mb-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400`}>
        <Clapperboard className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="font-semibold text-slate-600 dark:text-slate-300">Movie Posters</span>
        <span className="truncate text-slate-400" title={err || undefined}>
          {err ? err : 'loading…'}
        </span>
        <button
          onClick={handleRefresh}
          disabled={loading || fetching}
          className="ml-auto text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0"
          title="Refresh poster status"
        >
          <RefreshCw className={`w-3 h-3 ${(loading || fetching) ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  const providers = data.providers ?? [];
  const renderCounts = (label: string, c: PosterStatusCounts | undefined) => (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
        <ImageIcon className="w-3.5 h-3.5 text-indigo-400" /> {label}
        <span className="ml-auto text-[11px] font-normal text-slate-400">{(c?.total ?? 0).toLocaleString()} total</span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        {POSTER_COUNT_FIELDS.map((f) => (
          <div key={f.key as string}>
            <div className="text-[11px] text-slate-400">{f.label}</div>
            <div className={`font-bold ${f.cls}`}>{(c?.[f.key] ?? 0).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`${commonClasses.card} p-4 mb-4`}>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="font-semibold flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <Clapperboard className="w-4 h-4 text-indigo-400" />
          Movie / TV Posters
        </h3>
        <div className="flex items-center gap-3">
          {/* provider key badges (TMDB / OMDB) */}
          <div className="flex items-center gap-1.5" title="Poster provider keys">
            <KeyRound className="w-3.5 h-3.5 text-slate-400" />
            {providers.length === 0 && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400">no providers</span>
            )}
            {providers.map((p) => (
              <span
                key={p.name}
                title={p.configured ? `${String(p.name).toUpperCase()} key configured` : `${String(p.name).toUpperCase()} key missing`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase ${
                  p.configured
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-slate-100 text-slate-400 line-through dark:bg-slate-800/60'
                }`}
              >
                {p.name}
                {p.name === 'tmdb' && p.has_v4_token && (
                  <span className="not-italic text-[10px] text-green-500">v4</span>
                )}
              </span>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading || fetching}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 disabled:opacity-50"
            title="Refresh / retry pending posters"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loading || fetching) ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {providers.every((p) => !p.configured) && (
        <p className="mb-3 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          No poster provider key configured — set TMDB_API_KEY / OMDB_API_KEY to enable poster fetch.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {renderCounts('Books', data.counts?.book)}
        {renderCounts('Subtitles', data.counts?.subtitle)}
      </div>
    </div>
  );
};

export default VocabPosterStrip;
