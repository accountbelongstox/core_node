import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, FileText, Layers, Loader2, Volume2 } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { wfNewApi, type WfNewOrchAudioDetail } from '../../api';
import { WordNewBookReaderVerseRow } from '../reader/WordNewBookReaderVerseRow';
import { WordNewDailyReadingCurrentSentenceWords } from '../daily-reading/WordNewDailyReadingCurrentSentenceWords';
import { getSentenceWordTable, type WordNewSentenceWordRow } from '../../services/WordNewSentenceWordTable';
import { playWordClip } from '../../services/WordNewBookReaderWordCards';
import { formatBookLangLabel } from '../../utils/WordNewBookReaderLangUtils';
import { formatClockTime } from '../../utils/WordNewTimeFormat';
import { useScrollPause } from '../../hooks/useScrollPause';
import { useOrchAudioPlayback } from './useOrchAudioPlayback';
import { WordNewOrchAudioTransport } from './WordNewOrchAudioTransport';
import { WordNewOrchAudioLoginPrompt, WordNewOrchAudioSourceBadge } from './WordNewOrchAudioListPage';
import { ORCH_SENTENCE_GRAIN } from './orchAudioModel';
import type { OrchAudioPlayback } from './useOrchAudioPlayback';
import { useWfNewLoadMoreSentinel } from '../../hooks/useWfNewLoadMoreSentinel';
import { WfNewLoadingDots } from '../WfNewLoadingDots';

type Trans = (key: string, replacements?: Record<string, string | number>) => string;

interface Props {
  itemId: string;
  theme: ElementTheme;
  trans: Trans;
  dark?: boolean;
  onBack: () => void;
}

const sentenceKey = (seq: number) => `${ORCH_SENTENCE_GRAIN}-${seq}`;

const SourceTextPanel: React.FC<{ detail: WfNewOrchAudioDetail; trans: Trans }> = ({ detail, trans }) => {
  const [open, setOpen] = useState(false);
  if (!detail.sourceText) return null;
  const title = trans(detail.item.source === 'prompt_rewrite' ? 'orchAudio.originalPrompt' : 'orchAudio.sourceText');
  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-bold text-zinc-300"
      >
        <FileText className="h-4 w-4 text-fuchsia-300" />
        <span className="flex-1">{title}</span>
        <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words border-t border-white/5 px-4 py-3 text-xs leading-relaxed text-zinc-400">
          {detail.sourceText}
        </p>
      )}
    </section>
  );
};

const WordResourcesPanel: React.FC<{
  detail: WfNewOrchAudioDetail;
  trans: Trans;
  onBeforePlay: () => void;
}> = ({ detail, trans, onBeforePlay }) => {
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  if (detail.words.length === 0) return null;
  return (
    <section className="space-y-2">
      <p className="flex items-center gap-1.5 px-1 text-[10px] font-mono uppercase text-zinc-500">
        <Volume2 className="h-3 w-3" />{trans('orchAudio.words', { count: detail.words.length })}
      </p>
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
        {detail.words.map((word) => (
          <button
            key={`${word.language}:${word.word}`}
            type="button"
            onClick={() => {
              onBeforePlay();
              setPlayingWord(word.word);
              void playWordClip(word.audioUrl, word.word).finally(() => {
                setPlayingWord((current) => (current === word.word ? null : current));
              });
            }}
            className={`rounded-lg border px-2 py-1 text-[11px] transition-colors ${
              playingWord === word.word
                ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200'
                : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
            } ${word.audioUrl ? '' : 'italic text-zinc-500'}`}
            title={word.audioUrl ? undefined : trans('orchAudio.wordAudioMissing')}
          >
            {word.word}
          </button>
        ))}
      </div>
    </section>
  );
};

/** Loaded sentence pages in position order: a gap before a page offers the
 * missing page, and the end sentinel loads the next page on scroll. */
const SentencePages: React.FC<{
  playback: OrchAudioPlayback;
  theme: ElementTheme;
  trans: Trans;
  dark?: boolean;
  langName: (code: string) => string;
}> = ({ playback, theme, trans, dark, langName }) => {
  const { sentences, cells, displayLangs, activeSentencePosition } = playback;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const lastPage = sentences.loadedPages[sentences.loadedPages.length - 1] ?? 0;
  const hasMore = lastPage < sentences.pageCount;
  const loading = sentences.loadingPages.length > 0;
  useWfNewLoadMoreSentinel(sentinelRef, hasMore, () => { void sentences.ensurePage(lastPage + 1); }, lastPage);
  const activeKey = activeSentencePosition == null ? null : sentenceKey(activeSentencePosition);
  const verseByPosition = useMemo(
    () => new Map(playback.sentenceVerses.map((verse) => [verse.seq, verse])),
    [playback.sentenceVerses],
  );
  const loadButton = (page: number) => (
    <button
      key={`load-${page}`}
      type="button"
      disabled={loading}
      onClick={() => { void sentences.ensurePage(page); }}
      className="w-full rounded-xl border border-dashed border-white/10 py-2 text-[11px] font-mono text-zinc-500 hover:bg-white/5 disabled:opacity-50"
    >
      {trans('orchAudio.loadSentences', {
        from: (page - 1) * sentences.perPage + 1,
        to: Math.min(page * sentences.perPage, sentences.total),
      })}
    </button>
  );

  return (
    <div className="space-y-2">
      {sentences.loadedPages.map((page, pageIndex) => (
        <React.Fragment key={page}>
          {page > (sentences.loadedPages[pageIndex - 1] ?? 0) + 1 && loadButton(page - 1)}
          {sentences.pageSentences(page).map((sentence) => {
            const verse = verseByPosition.get(sentence.position);
            if (!verse) return null;
            return (
              <WordNewBookReaderVerseRow
                key={sentenceKey(sentence.position)}
                activeTheme={theme}
                dark={dark}
                verse={verse}
                index={sentence.position}
                orderedDisplayLangs={displayLangs}
                displayMode="stacked"
                trans={trans}
                langName={langName}
                playingKey={playback.playingKey}
                activeVerseKey={activeKey}
                cellStatuses={cells.cellStatuses}
                onPlay={playback.playSentence}
                onSectionPlay={playback.playSentence}
                onNeedMedia={cells.requestCellMedia}
                onRetryAudio={cells.retryCellAudio}
              />
            );
          })}
        </React.Fragment>
      ))}
      {hasMore && <div ref={sentinelRef}>{loadButton(lastPage + 1)}</div>}
      {loading && <WfNewLoadingDots className="text-indigo-300" label={trans('content.loading')} />}
    </div>
  );
};

const OrchAudioPlayerBody: React.FC<Omit<Props, 'itemId'> & { detail: WfNewOrchAudioDetail }> = ({
  detail, theme, trans, dark, onBack,
}) => {
  const playback = useOrchAudioPlayback(detail);
  const { activeSentencePosition, activeSegmentIndex, langs, sentences } = playback;
  const { isScrolling, onScroll } = useScrollPause();
  const [sentenceWords, setSentenceWords] = useState<WordNewSentenceWordRow[]>([]);
  const langName = useCallback((code: string) => formatBookLangLabel(code, trans), [trans]);
  const activeSentence = activeSentencePosition == null ? null : sentences.sentenceAt(activeSentencePosition) ?? null;

  useEffect(() => {
    if (activeSentencePosition == null || isScrolling || typeof document === 'undefined') return;
    document.getElementById(`verse-${sentenceKey(activeSentencePosition)}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeSentencePosition, isScrolling, sentences.loaded]);

  useEffect(() => {
    if (!activeSentence?.text || activeSentence.language !== 'en') {
      setSentenceWords([]);
      return undefined;
    }
    let alive = true;
    void getSentenceWordTable(activeSentence.text, 'en', 'zh')
      .then((rows) => { if (alive) setSentenceWords(rows); })
      .catch(() => { if (alive) setSentenceWords([]); });
    return () => { alive = false; };
  }, [activeSentence]);

  return (
    <div className="space-y-4 pb-4" onWheel={onScroll} onTouchMove={onScroll}>
      <div className="flex items-start gap-3 border-b border-white/5 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300 hover:bg-white/10"
          aria-label={trans('orchAudio.backToList')}
          title={trans('orchAudio.backToList')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-zinc-100">{detail.item.title}</h2>
            <WordNewOrchAudioSourceBadge source={detail.item.source} trans={trans} />
          </div>
          <p className="text-[10px] font-mono text-zinc-500">
            {trans('orchAudio.segmentCount', { count: detail.segments.length })}
            {' · '}
            {trans('orchAudio.sentenceCount', { count: sentences.total })}
            {detail.item.durationSec != null && ` · ${formatClockTime(detail.item.durationSec)}`}
            {detail.item.createdAt && ` · ${new Date(detail.item.createdAt).toLocaleString()}`}
          </p>
        </div>
      </div>

      <SourceTextPanel detail={detail} trans={trans} />

      {detail.segments.length > 0 && (
        <section className="space-y-2">
          <p className="flex items-center gap-1.5 px-1 text-[10px] font-mono uppercase text-zinc-500">
            <Layers className="h-3 w-3" />{trans('orchAudio.segments')}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {detail.segments.map((segment) => {
              const active = segment.index === activeSegmentIndex;
              const count = Math.max(0, segment.end - segment.start + 1);
              return (
                <button
                  key={segment.index}
                  type="button"
                  onClick={() => playback.playSegment(segment.index)}
                  disabled={!segment.url}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-left text-[11px] transition-colors disabled:opacity-40 ${
                    active ? theme.accentBg : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                  }`}
                  title={segment.url ? undefined : trans('orchAudio.segmentPending')}
                >
                  <span className="block font-bold">{trans('orchAudio.segmentN', { n: segment.index })}</span>
                  <span className="block font-mono text-[10px] opacity-70">
                    {trans('orchAudio.sentenceCount', { count })}
                    {segment.durationSec != null && ` · ${formatClockTime(segment.durationSec)}`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <WordResourcesPanel
        detail={detail}
        trans={trans}
        onBeforePlay={() => { if (playback.playing && !playback.paused) playback.playPause(); }}
      />

      {activeSentence && activeSentence.language === 'en' && (
        <WordNewDailyReadingCurrentSentenceWords sentence={activeSentence.text} words={sentenceWords} trans={trans} />
      )}

      {sentences.total === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-500">{trans('orchAudio.noSentences')}</div>
      ) : (
        <SentencePages playback={playback} theme={theme} trans={trans} dark={dark} langName={langName} />
      )}

      <WordNewOrchAudioTransport theme={theme} trans={trans} playback={playback} hasTranslations={langs.length > 1} />
    </div>
  );
};

/** Player page for one orchestrated audio item: segment playlist, sentence
 * resources with the audible sentence highlighted, and the source text. */
export const WordNewOrchAudioPlayerPage: React.FC<Props> = ({ itemId, ...props }) => {
  const [detail, setDetail] = useState<WfNewOrchAudioDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setDetail(null);
    wfNewApi.getOrchAudioDetail(itemId)
      .then((next) => { if (alive) setDetail(next); })
      .catch(() => { if (alive) setDetail(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [itemId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-mono">{props.trans('content.loading')}</span>
      </div>
    );
  }
  if (!detail && !wfNewApi.isAuthenticated()) {
    return <WordNewOrchAudioLoginPrompt theme={props.theme} trans={props.trans} />;
  }
  if (!detail) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-sm text-zinc-500">{props.trans('orchAudio.notFound')}</p>
        <button type="button" onClick={props.onBack} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300 hover:bg-white/10">
          {props.trans('orchAudio.backToList')}
        </button>
      </div>
    );
  }
  return <OrchAudioPlayerBody key={detail.item.id} detail={detail} {...props} />;
};
