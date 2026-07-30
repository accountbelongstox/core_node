/**
 * WfNewAdminOverview — the "overview" tab of the SUPER-ADMIN console.
 *
 * Read-only dashboard over two public statistics endpoints (loaded together
 * on mount and via the Refresh chip):
 *   - wfNewAdminApi.getStatistics()        → four KPI stat cards (languages /
 *     libraries / words / TTS coverage from the backend summary block),
 *   - wfNewAdminApi.getLanguageBreakdown() → the per-language dictionary table
 *     (words / translated / audio / invalid, with coverage share per row).
 *
 * Both calls hit the pinned page-origin backend (see WfNewAdminApi BASE-URL
 * POLICY). Loads are guarded against out-of-order responses (reqId ref) and
 * unmount (alive ref); failures render the inline error + retry state.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { ElementTheme } from '../../WfNewTypes';
import { wfNewAdminApi } from '../../api';
import type { WfNewAdminLangRow, WfNewAdminStatistics } from '../../api';

/** Shared 5-column track: language name + four fixed numeric columns. */
const TABLE_GRID = 'grid-cols-[1fr_6rem_6rem_6rem_6rem]';

const fmt = (n: unknown): string => Number(n ?? 0).toLocaleString();

/** Share of `part` over `words` as e.g. '82%' (empty when nothing to divide). */
const pct = (part: number, words: number): string =>
  words > 0 ? `${Math.round((part / words) * 100)}%` : '';

/** Right-aligned numeric cell; zero renders muted, optional tiny share badge. */
const NumCell: React.FC<{ value: number; tone: string; share?: string }> = ({ value, tone, share }) => (
  <span className={`text-right text-[12px] font-mono ${value > 0 ? tone : 'text-zinc-600'}`}>
    {fmt(value)}
    {share && value > 0 ? <span className="ml-1 text-[9px] text-zinc-500">{share}</span> : null}
  </span>
);

interface WfNewAdminOverviewProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type?: 'success' | 'info' | 'warning' | 'star') => void;
}

export const WfNewAdminOverview: React.FC<WfNewAdminOverviewProps> = ({
  activeTheme,
  trans,
  addToast,
}) => {
  const [stats, setStats] = useState<WfNewAdminStatistics | null>(null);
  const [langs, setLangs] = useState<WfNewAdminLangRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Out-of-order / unmount guards: only the latest in-flight load may commit.
  const reqId = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const [s, breakdown] = await Promise.all([
        wfNewAdminApi.getStatistics(),
        wfNewAdminApi.getLanguageBreakdown(),
      ]);
      if (!alive.current || id !== reqId.current) return;
      setStats(s);
      setLangs(breakdown?.languages ?? []);
    } catch (e: any) {
      if (!alive.current || id !== reqId.current) return;
      if (e?.status === 401) addToast(trans('admin.needLogin'), 'warning');
      setError(String(e?.message || 'Request failed'));
    } finally {
      if (alive.current && id === reqId.current) setLoading(false);
    }
  }, [addToast, trans]);

  useEffect(() => { load(); }, [load]);

  const summary = stats?.summary;
  const statCards = useMemo(() => ([
    { key: 'langs', label: trans('admin.ov.totalLangs'), value: fmt(summary?.total_languages), tone: 'text-slate-100' },
    { key: 'libs', label: trans('admin.ov.totalLibs'), value: fmt(summary?.total_libraries), tone: 'text-emerald-300' },
    { key: 'words', label: trans('admin.ov.totalWords'), value: fmt(summary?.total_words), tone: 'text-sky-300' },
    {
      key: 'tts',
      label: trans('admin.ov.ttsCoverage'),
      value: summary?.tts_percentage !== undefined ? `${summary.tts_percentage}%` : '—',
      tone: 'text-violet-300',
    },
  ]), [summary, trans]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Toolbar: refresh both feeds (spinner doubles as the loading hint). */}
      <div className="flex items-center gap-3 px-1">
        <div className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {trans('admin.refresh')}
        </button>
      </div>

      {/* KPI stat cards (statistics summary block) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {statCards.map((c) => (
          <div key={c.key} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
            <p className={`text-xl font-black font-mono ${c.tone}`}>{c.value}</p>
            <p className="text-[10px] font-mono text-zinc-500 uppercase mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Per-language dictionary breakdown table */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/5">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-300">
            {trans('admin.ov.langTable')}
          </span>
        </div>
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-[12px] font-mono text-zinc-500 animate-pulse">{trans('admin.loading')}</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-[12px] font-mono text-rose-400">{error}</p>
            <button
              type="button"
              onClick={load}
              className="px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300"
            >
              {trans('admin.retry')}
            </button>
          </div>
        ) : langs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[12px] font-mono text-zinc-500">{trans('admin.empty')}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5 overflow-x-auto">
            {/* column header */}
            <div className={`hidden sm:grid ${TABLE_GRID} gap-3 px-4 py-2 bg-white/[0.03] text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500`}>
              <span>{trans('admin.ov.col.language')}</span>
              <span className="text-right">{trans('admin.ov.col.words')}</span>
              <span className="text-right">{trans('admin.ov.col.translated')}</span>
              <span className="text-right">{trans('admin.ov.col.audio')}</span>
              <span className="text-right">{trans('admin.ov.col.invalid')}</span>
            </div>
            {langs.map((row) => (
              <div
                key={row.language}
                className={`grid ${TABLE_GRID} gap-3 px-4 py-2.5 items-center hover:bg-white/[0.03] transition`}
              >
                <div className="min-w-0 flex items-baseline gap-2">
                  <span className="text-sm font-bold text-slate-100 truncate">{row.language}</span>
                  {row.language_code && (
                    <span className="text-[10px] font-mono text-zinc-500">{row.language_code}</span>
                  )}
                </div>
                <NumCell value={row.words} tone="text-zinc-200" />
                <NumCell value={row.with_translation} tone="text-emerald-300" share={pct(row.with_translation, row.words)} />
                <NumCell value={row.with_audio} tone="text-sky-300" share={pct(row.with_audio, row.words)} />
                <NumCell value={row.invalid} tone="text-rose-400" />
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};
