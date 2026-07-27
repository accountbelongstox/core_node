/** Daily Reading block on the wordnew home tab. Lists the latest reading
 * articles (title_en + title_cn + date); clicking a row expands the reading
 * text inline (article_en with reference_cn). A Play button (header = play
 * all, per row = start from that article) opens the fullscreen sequential
 * player overlay; the book button opens the read-along reader. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, Headphones, ListMusic, Loader2, Newspaper } from 'lucide-react';
import type { ElementTheme } from '../../WfNewTypes';
import { fetchDailyReadings, type DailyReadingRow } from './dailyReadingApi';
import { useDailyReadingPlayer } from './useDailyReadingPlayer';
import { WfDailyReadingPlayerOverlay } from './WfDailyReadingPlayerOverlay';
import { connectPycoreWs, subscribe } from '../../../../core/api-libs/pycore';

interface Props {
  theme: ElementTheme;
  trans: (k: string, r?: Record<string, string | number>) => string;
  onOpenBook: (sourceKey: string, title: string) => void;
  routeMode?: boolean;
}

const POLL_MS = 12_000;
type ArticleSort = 'latest' | 'oldest' | 'source' | 'unread' | 'random';

function initialArticleSort(): ArticleSort {
  if (typeof window === 'undefined') return 'latest';
  const match = window.location.hash.match(/^#\/article(\/(latest|oldest|source|unread|random))?$/);
  return (match?.[2] as ArticleSort | undefined) ?? 'latest';
}

export const WfDailyReadingSection: React.FC<Props> = ({ theme, trans, onOpenBook, routeMode = false }) => {
  const [rows, setRows] = useState<DailyReadingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [articleSort, setArticleSort] = useState<ArticleSort>(initialArticleSort);
  const mounted = useRef(true);
  const player = useDailyReadingPlayer();
  const visibleRows = useMemo(() => {
    const sorted = [...rows];
    if (articleSort === 'oldest') return sorted.reverse();
    if (articleSort === 'source') return sorted.sort((left, right) => (left.source_key || '').localeCompare(right.source_key || ''));
    if (articleSort === 'random') return sorted.sort(() => Math.random() - 0.5);
    // unread and latest default to the original order for now
    return sorted;
  }, [articleSort, rows]);

  const changeSort = useCallback((next: ArticleSort) => {
    setArticleSort(next);
    if (routeMode && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#/article/${next}`);
    }
  }, [routeMode]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const items = await fetchDailyReadings(20);
      if (mounted.current) {
        setRows(items);
        setError(null);
      }
    } catch (loadError) {
      if (mounted.current) {
        setError(loadError instanceof Error ? loadError.message : 'Daily reading unavailable');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load(false);
    const id = setInterval(() => load(true), POLL_MS);
    connectPycoreWs();
    const onArticlePublished = () => load(true);
    const unsubscribe = subscribe('article.published', onArticlePublished);
    return () => {
      mounted.current = false;
      clearInterval(id);
      unsubscribe();
    };
  }, [load]);

  const playableCount = visibleRows.filter((r) => !!r.audio_url).length;

  return (
    <section className={`${theme.cardClass} rounded-3xl border border-white/5 p-5 space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black font-mono uppercase tracking-widest text-indigo-400 flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            {trans('home.dailyReading.title')}
          </h2>
          <p className="text-[11px] text-zinc-500 mt-1">{trans('home.dailyReading.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {routeMode && (
            <select
              value={articleSort}
              onChange={(event) => changeSort(event.target.value as ArticleSort)}
              className="rounded-xl border border-white/10 bg-slate-950 px-2 py-1.5 text-[11px] text-zinc-300"
              aria-label="Article sort"
            >
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
              <option value="source">Source</option>
              <option value="unread">Unread</option>
              <option value="random">Random</option>
            </select>
          )}
          {loading && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
          {playableCount > 0 && (
            <button
              type="button"
              onClick={() => player.start(visibleRows)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-gradient-to-tr from-indigo-500 to-fuchsia-500 text-white shadow-md shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-transform"
              title={trans('home.dailyReading.playAll')}
            >
              <ListMusic className="w-3.5 h-3.5" />
              {trans('home.dailyReading.playAll')}
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className={`text-xs ${error ? 'text-rose-400' : 'text-zinc-500'}`}>
          {loading ? '…' : error || trans('home.dailyReading.empty')}
        </p>
      ) : (
        <ul className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {visibleRows.map((row) => {
            const expanded = expandedId === row.id;
            const dateLabel = row.reading_date ?? row.created_at;
            return (
              <li
                key={row.id}
                className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 hover:border-indigo-500/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : row.id)}
                    className="min-w-0 flex-1 text-left"
                    title={trans('home.dailyReading.toggleText')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-zinc-100 truncate">{row.title_en}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                    {row.title_cn && (
                      <div className="text-xs text-zinc-400 mt-0.5 truncate">{row.title_cn}</div>
                    )}
                    <div className="text-[10px] font-mono text-zinc-600 mt-2">
                      {row.word_count ? `${row.word_count} words · ` : ''}
                      {dateLabel ? new Date(dateLabel).toLocaleDateString() : ''}
                    </div>
                  </button>
                  <div className="shrink-0 flex flex-col gap-2">
                    {row.audio_url && (
                      <button
                        type="button"
                        onClick={() => player.start(visibleRows, row.id)}
                        className="p-2 rounded-xl border border-white/10 text-zinc-400 hover:text-indigo-300 transition-colors"
                        title={trans('home.dailyReading.playFrom')}
                      >
                        <Headphones className="w-4 h-4" />
                      </button>
                    )}
                    {row.source_key && (
                      <button
                        type="button"
                        onClick={() => onOpenBook(row.source_key!, row.title_en)}
                        className="p-2 rounded-xl border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                        title={trans('home.agentArticles.read')}
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {expanded && (row.article_en || row.reference_cn) && (
                  <div className="mt-3 space-y-3 border-t border-white/5 pt-3">
                    {row.article_en && (
                      <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                        {row.article_en}
                      </p>
                    )}
                    {row.reference_cn && (
                      <p className="text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap">
                        {row.reference_cn}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <WfDailyReadingPlayerOverlay player={player} trans={trans} />
    </section>
  );
};
