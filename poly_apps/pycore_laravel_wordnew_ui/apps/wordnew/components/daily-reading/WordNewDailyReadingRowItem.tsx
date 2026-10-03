import React from 'react';
import { BookOpen, ChevronDown, Check, Clock, Headphones, Loader2, Newspaper, Play } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { TONE_TEXT, TONE_TINT } from '@/shared/ui/statusTone';
import type { DailyReadingRow } from './dailyReadingApi';
import type { DailyReadingPlayer } from './useDailyReadingPlayer';
import { WordNewDailyReadingResourcePreview } from './WordNewDailyReadingResourcePreview';

interface Props {
  row: DailyReadingRow;
  theme: ElementTheme;
  routeMode: boolean;
  expanded: boolean;
  queueing: boolean;
  player: DailyReadingPlayer;
  trans: (k: string, r?: Record<string, string | number>) => string;
  onToggleExpand: () => void;
  onToggleRead: () => void;
  onPlay: () => void;
  onQueueAudio: () => void;
  onOpenBook: (sourceKey: string, title: string) => void;
}

export const WordNewDailyReadingRowItem: React.FC<Props> = ({
  row, theme, routeMode, expanded, queueing, player, trans,
  onToggleExpand, onToggleRead, onPlay, onQueueAudio, onOpenBook,
}) => {
  const dateLabel = row.reading_date ?? row.created_at;
  const isRead = row.read === true;
  const audioReady = !!row.audio_url && row.audio_ready === true;
  const hasText = !!(row.article_en || row.reference_cn);
  const openCard = () => {
    if (row.source_key) onOpenBook(row.source_key, row.title_en);
    else if (hasText) onToggleExpand();
  };
  const SubtitleIcon = audioReady ? Headphones : Clock;
  const subtitleParts = [
    audioReady
      ? trans(row.audio_generation_type === 'multi_sentence'
        ? 'home.dailyReading.multiSentenceAudio'
        : 'home.dailyReading.legacyAudio')
      : trans('home.dailyReading.audioPendingShort'),
    dateLabel ? new Date(dateLabel).toLocaleDateString() : '',
  ].filter(Boolean);
  return (
    <li className={`rounded-xl border ${theme.borderClass} bg-black/[0.03] px-2.5 py-2 transition-colors dark:bg-white/[0.04] ${routeMode ? 'h-full min-w-0 max-w-full' : ''}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openCard}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          title={trans('home.dailyReading.openReader')}
          aria-label={`${trans('home.dailyReading.openReader')}: ${row.title_en}`}
        >
          <span className={`flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-0.5 rounded-full border ${theme.borderClass} bg-black/[0.04] dark:bg-white/[0.06] ${theme.textSecondaryClass}`}>
            <Newspaper className="h-3 w-3" />
            <span className="text-[8px] font-semibold leading-none">
              {row.word_count ? trans('home.dailyReading.wordsCaption', { count: row.word_count }) : '–'}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className={`line-clamp-2 break-words text-[13px] font-semibold leading-snug ${isRead ? theme.textSecondaryClass : theme.textPrimaryClass}`}>
              {row.title_en}
            </span>
            <span className={`mt-0.5 flex min-w-0 items-center gap-1 text-[10px] ${theme.textSecondaryClass}`}>
              <SubtitleIcon className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{subtitleParts.join(' · ')}</span>
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {audioReady && (
            <button
              type="button"
              onClick={onPlay}
              className={`flex h-8 w-8 items-center justify-center rounded-full ${theme.textSecondaryClass} transition-colors hover:bg-black/5 dark:hover:bg-white/10`}
              title={trans('home.dailyReading.playFrom')}
              aria-label={trans('home.dailyReading.playFrom')}
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          {row.audio_url && !audioReady && (
            <button
              type="button"
              onClick={onQueueAudio}
              disabled={queueing}
              className={`flex h-8 w-8 items-center justify-center rounded-full ${TONE_TEXT.amber} disabled:opacity-50`}
              title={trans('home.dailyReading.audioQueued')}
              aria-label={trans('home.dailyReading.audioQueued')}
            >
              {queueing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />}
            </button>
          )}
          {routeMode && hasText && (
            <button
              type="button"
              onClick={onToggleExpand}
              className={`flex h-8 w-8 items-center justify-center rounded-full ${theme.textSecondaryClass} transition-colors hover:bg-black/5 dark:hover:bg-white/10`}
              title={trans(expanded ? 'home.dailyReading.hideArticle' : 'home.dailyReading.showArticle')}
              aria-label={trans('home.dailyReading.toggleText')}
              aria-expanded={expanded}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleRead}
            role="checkbox"
            aria-checked={isRead}
            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${isRead
              ? `border-emerald-500/60 ${TONE_TINT.emerald} ${TONE_TEXT.emerald}`
              : `${theme.borderClass} ${theme.textSecondaryClass} opacity-70 hover:opacity-100`}`}
            title={trans(isRead ? 'home.dailyReading.markUnread' : 'home.dailyReading.markRead')}
            aria-label={trans(isRead ? 'home.dailyReading.markUnread' : 'home.dailyReading.markRead')}
          >
            {isRead && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          </button>
        </div>
      </div>
      {expanded && hasText && (
        <div className={`mt-3 space-y-3 border-t ${theme.borderClass} pt-3`}>
          <div className="flex flex-wrap items-center gap-2">
            {routeMode && (
              <WordNewDailyReadingResourcePreview
                articleId={row.id}
                settings={player}
                trans={trans}
              />
            )}
            {row.source_key && (
              <button
                type="button"
                onClick={() => onOpenBook(row.source_key!, row.title_en)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold ${theme.borderClass} ${theme.accentText}`}
              >
                <BookOpen className="h-4 w-4" />
                {trans('home.agentArticles.read')}
              </button>
            )}
          </div>
          {row.title_cn && (
            <div className={`text-xs font-semibold ${theme.textSecondaryClass}`}>{row.title_cn}</div>
          )}
          {row.article_en && (
            <p className={`whitespace-pre-wrap text-sm leading-relaxed ${theme.textPrimaryClass}`}>
              {row.article_en}
            </p>
          )}
          {row.reference_cn && (
            <p className={`whitespace-pre-wrap text-xs leading-relaxed ${theme.textSecondaryClass}`}>
              {row.reference_cn}
            </p>
          )}
        </div>
      )}
    </li>
  );
};
