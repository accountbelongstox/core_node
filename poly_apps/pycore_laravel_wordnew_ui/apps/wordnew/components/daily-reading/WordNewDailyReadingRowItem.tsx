import React from 'react';
import { BookOpen, ChevronDown, Headphones, Loader2 } from 'lucide-react';
import type { DailyReadingRow } from './dailyReadingApi';
import type { DailyReadingPlayer } from './useDailyReadingPlayer';
import { WordNewDailyReadingResourcePreview } from './WordNewDailyReadingResourcePreview';

interface Props {
  row: DailyReadingRow;
  routeMode: boolean;
  expanded: boolean;
  queueing: boolean;
  player: DailyReadingPlayer;
  trans: (k: string, r?: Record<string, string | number>) => string;
  onToggleExpand: () => void;
  onPlay: () => void;
  onQueueAudio: () => void;
  onOpenBook: (sourceKey: string, title: string) => void;
}

export const WordNewDailyReadingRowItem: React.FC<Props> = ({
  row, routeMode, expanded, queueing, player, trans, onToggleExpand, onPlay, onQueueAudio, onOpenBook,
}) => {
  const dateLabel = row.reading_date ?? row.created_at;
  return (
    <li
      className={`rounded-2xl border border-white/5 bg-slate-900/40 p-4 hover:border-indigo-500/30 transition-colors ${routeMode ? 'h-full min-w-0 max-w-full' : ''}`}
      >
        <div className={routeMode
          ? 'flex min-w-0 flex-col gap-3'
          : 'flex items-start justify-between gap-3'}>
          <button
            type="button"
            onClick={onToggleExpand}
            className={`${routeMode ? 'w-full' : 'flex-1'} min-w-0 text-left`}
            title={trans('home.dailyReading.toggleText')}
          >
            <div className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 text-sm font-bold text-zinc-100 truncate">{row.title_en}</span>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${row.audio_generation_type === 'multi_sentence'
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                }`}
              >
                {trans(row.audio_generation_type === 'multi_sentence'
                  ? 'home.dailyReading.multiSentenceAudio'
                  : 'home.dailyReading.legacyAudio')}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </div>
            {row.title_cn && (
              <div className="text-xs text-zinc-400 mt-0.5 truncate">{row.title_cn}</div>
            )}
            <div className="text-[10px] font-mono text-zinc-600 mt-2">
              {row.word_count ? `${trans('home.dailyReading.wordCount', { count: row.word_count })} · ` : ''}
              {dateLabel ? new Date(dateLabel).toLocaleDateString() : ''}
            </div>
          </button>
          <div className={`flex gap-2 ${routeMode
            ? 'min-w-0 max-w-full flex-row flex-wrap'
            : 'shrink-0 flex-col'}`}>
            {routeMode && (
              <WordNewDailyReadingResourcePreview
                articleId={row.id}
                settings={player}
                trans={trans}
              />
            )}
            {row.audio_url && row.audio_ready && (
              <button
                type="button"
                onClick={onPlay}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-indigo-200 hover:border-indigo-300/60 hover:bg-indigo-500/20 transition-colors"
                title={trans('home.dailyReading.playFrom')}
                aria-label={trans('home.dailyReading.playFrom')}
              >
                <Headphones className="w-4 h-4" />
                <span className="text-[10px] font-bold">{trans('home.dailyReading.playFrom')}</span>
              </button>
            )}
            {row.audio_url && !row.audio_ready && (
              <button
                type="button"
                onClick={onQueueAudio}
                disabled={queueing}
                className="inline-flex items-center gap-1.5 p-2 rounded-xl border border-amber-500/20 text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                title={trans('home.dailyReading.audioQueued')}
              >
                {queueing
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Headphones className="w-4 h-4" />}
                {routeMode && <span className="text-[10px] font-bold">{trans('home.dailyReading.audioPending')}</span>}
              </button>
            )}
            {row.source_key && (
              <button
                type="button"
                onClick={() => onOpenBook(row.source_key!, row.title_en)}
                className="inline-flex items-center gap-1.5 p-2 rounded-xl border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                title={trans('home.agentArticles.read')}
              >
                <BookOpen className="w-4 h-4" />
                {routeMode && <span className="text-[10px] font-bold">{trans('home.agentArticles.read')}</span>}
              </button>
            )}
            {routeMode && (row.article_en || row.reference_cn) && (
              <button
                type="button"
                onClick={onToggleExpand}
                className="inline-flex items-center gap-1.5 p-2 rounded-xl border border-white/10 text-zinc-400 hover:text-indigo-300 transition-colors"
                title={trans('home.dailyReading.toggleText')}
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                <span className="text-[10px] font-bold">
                  {trans(expanded ? 'home.dailyReading.hideArticle' : 'home.dailyReading.showArticle')}
                </span>
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
};
