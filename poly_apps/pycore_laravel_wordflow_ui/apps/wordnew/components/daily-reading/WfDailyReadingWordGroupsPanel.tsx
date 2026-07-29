/** Word Groups linkage panel for the Daily Reading article page: shows the
 * Word Groups (with the Default Vocabulary Group highlighted) and how the
 * current article's words map into them — played / new / not yet grouped.
 * Refreshes when the article changes and after playback marks words played. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookMarked, RefreshCw, Sparkles } from 'lucide-react';
import { wfNewApi } from '../../api';
import { DEFAULT_VOCAB_GROUP_NAME, type WordGroup } from '../../api/types/core';
import { getSentenceWordTable } from '../../services/WfSentenceWordTable';
import type { DailyReadingRow } from './dailyReadingApi';

interface Props {
  article: DailyReadingRow;
  trans: (k: string, r?: Record<string, string | number>) => string;
  /** Bumped by the parent when playback finishes an article pass (words just
   *  got marked played) so the panel re-reads the backend state. */
  refreshToken?: number;
}

interface PanelState {
  groups: WordGroup[];
  defaultGroup: WordGroup | null;
  defaultWords: Set<string>;
  articleWords: { word: string; played: boolean; inDefault: boolean }[];
}

export const WfDailyReadingWordGroupsPanel: React.FC<Props> = ({ article, trans, refreshToken = 0 }) => {
  const [state, setState] = useState<PanelState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const groups = await wfNewApi.getWordGroups().catch(() => [] as WordGroup[]);
      const defaultGroup = groups.find((g) => g.name === DEFAULT_VOCAB_GROUP_NAME) ?? null;

      let defaultWords = new Set<string>();
      if (defaultGroup) {
        try {
          const words = await wfNewApi.getVocabulary(defaultGroup.id);
          defaultWords = new Set(words.map((w) => (w.text || '').trim().toLowerCase()).filter(Boolean));
        } catch {
          /* default group words unavailable — badges fall back to played state */
        }
      }

      let articleWords: PanelState['articleWords'] = [];
      if (article.article_en) {
        try {
          const table = await getSentenceWordTable(article.article_en, 'en', 'zh');
          const seen = new Set<string>();
          for (const row of table) {
            const key = row.word.trim().toLowerCase();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            articleWords.push({ word: row.word, played: row.played, inDefault: defaultWords.has(key) });
          }
        } catch {
          /* sentence word table unavailable — show groups only */
        }
      }

      if (mounted.current) {
        setState({ groups, defaultGroup, defaultWords, articleWords });
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [article.article_en]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, [load, refreshToken]);

  const newInArticle = state?.articleWords.filter((w) => !w.played) ?? [];
  const playedInArticle = state?.articleWords.filter((w) => w.played) ?? [];

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-black font-mono uppercase tracking-widest text-indigo-300 flex items-center gap-2">
          <BookMarked className="w-3.5 h-3.5" />
          {trans('home.dailyReading.wordGroups')}
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          className="p-1.5 rounded-lg border border-white/10 text-zinc-500 hover:text-indigo-300 transition-colors"
          title={trans('home.dailyReading.refresh')}
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="text-[11px] text-rose-400">{error}</p>}

      {state?.defaultGroup && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-indigo-200 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              {state.defaultGroup.name}
            </span>
            <span className="font-mono text-[10px] text-indigo-300">
              {state.defaultGroup.count} {trans('home.dailyReading.wordsUnit')}
              {typeof state.defaultGroup.progress === 'number'
                ? ` · ${Math.round(state.defaultGroup.progress)}%`
                : ''}
            </span>
          </div>
          <div className="text-[10px] text-zinc-400">
            {trans('home.dailyReading.articleWordsSummary', {
              total: state.articleWords.length,
              fresh: newInArticle.length,
              played: playedInArticle.length,
            })}
          </div>
        </div>
      )}

      {state && state.groups.filter((g) => g.name !== DEFAULT_VOCAB_GROUP_NAME).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {state.groups
            .filter((g) => g.name !== DEFAULT_VOCAB_GROUP_NAME)
            .map((g) => (
              <span
                key={g.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 text-[10px] text-zinc-400"
                title={g.description || g.name}
              >
                {g.name}
                <span className="font-mono text-zinc-600">{g.count}</span>
              </span>
            ))}
        </div>
      )}

      {state && state.articleWords.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600">
            {trans('home.dailyReading.articleWords')}
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
            {state.articleWords.map((w) => (
              <span
                key={w.word}
                className={`px-2 py-0.5 rounded-md text-[11px] border ${
                  w.played
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : w.inDefault
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      : 'border-white/10 bg-white/5 text-zinc-300'
                }`}
                title={
                  w.played
                    ? trans('home.dailyReading.wordPlayed')
                    : w.inDefault
                      ? trans('home.dailyReading.wordInDefaultGroup')
                      : trans('home.dailyReading.wordNew')
                }
              >
                {w.word}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
