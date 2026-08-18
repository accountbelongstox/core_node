import React, { useEffect, useRef } from 'react';
import { BookMarked, CircleDashed, ListMusic } from 'lucide-react';
import {
  countSentenceWordsAddedToTargetGroup,
  sentenceWordMeaning,
  sentenceWordTranslations,
  type WordNewSentenceWordRow,
} from '../../services/WordNewSentenceWordTable';
import { WordNewResourceStatusIcon } from '../WordNewResourceStatusIcon';
import { wordAudioQueueKey, wordTranslationQueueKey } from '../../services/WordNewQueueRuntime';
import { useDailyReadingViewportSpacing } from '../../hooks/useDailyReadingViewportSpacing';

interface Props {
  words: WordNewSentenceWordRow[];
  activeWord: string | null;
  activeWordIndex: number;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WordNewDailyReadingPlaybackWordsPanel: React.FC<Props> = ({
  words,
  activeWord,
  activeWordIndex,
  trans,
}) => {
  const containerRef = useRef<HTMLOListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const viewportSpacing = useDailyReadingViewportSpacing(containerRef, 'words');
  const addedCount = countSentenceWordsAddedToTargetGroup(words);

  // Word mode has no centering spacers. The active row is centered only within
  // the list's natural scroll range, so the first word starts at the top.
  useEffect(() => {
    if (activeWordIndex < 0) return;
    const container = containerRef.current;
    const element = itemRefs.current[activeWordIndex];
    if (!container || !element) return;
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const nextTop = container.scrollTop
      + (elementRect.top - containerRect.top)
      - container.clientHeight / 2
      + element.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  }, [activeWordIndex]);

  if (words.length === 0) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-transparent p-3 space-y-2 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-200">
          <ListMusic className="w-3.5 h-3.5" />
          {trans('home.dailyReading.playingWords')}
        </h3>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 font-mono text-[10px] text-indigo-300">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-200">
            {trans('home.dailyReading.articleTargetGroupAdded', { count: addedCount })}
          </span>
          {activeWord && <span className="truncate text-fuchsia-200">{activeWord}</span>}
          <span className="shrink-0">
            {trans('home.dailyReading.wordProgress', {
              current: Math.max(1, activeWordIndex + 1),
              total: words.length,
            })}
          </span>
        </div>
      </div>
      <ol ref={containerRef} className="max-h-[80vh] space-y-1 overflow-y-auto overscroll-contain pr-1">
        {viewportSpacing > 0 && <li aria-hidden="true" style={{ height: viewportSpacing }} />}
        {words.map((word, wordIndex) => {
          const translations = sentenceWordTranslations(word);
          const meaning = sentenceWordMeaning(word) || trans('home.dailyReading.meaningPending');
          const isActive = wordIndex === activeWordIndex;
          const hasAudio = word.audio_status === 'ready' && !!word.audio_url;
          const groupLabel = trans(word.in_target_group
            ? 'home.dailyReading.targetGroupLinked'
            : 'home.dailyReading.targetGroupPending');
          return (
            <li
              key={`${word.word}-${wordIndex}`}
              ref={(element) => { itemRefs.current[wordIndex] = element; }}
              aria-current={isActive ? 'true' : undefined}
              className={`grid grid-cols-[minmax(5rem,0.6fr)_minmax(0,1.25fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors ${
                isActive
                  ? 'border-fuchsia-400/50 bg-fuchsia-500/15 text-white'
                  : 'border-white/5 bg-white/[0.025] text-zinc-400'
              }`}
            >
              <span className="truncate text-xs font-semibold">{word.word}</span>
              <span className="truncate text-[11px]" title={meaning}>{meaning}</span>
              <span className="flex items-center gap-1.5 text-[10px]">
                <WordNewResourceStatusIcon
                  state={hasAudio ? 'ready' : 'waiting'}
                  queueKey={wordAudioQueueKey(word.word, 'en')}
                  trans={trans}
                />
                {translations.length === 0 ? (
                  <WordNewResourceStatusIcon
                    state="waiting"
                    resource="translation"
                    queueKey={wordTranslationQueueKey(word.word, 'en', 'zh')}
                    trans={trans}
                  />
                ) : null}
                {word.in_target_group
                  ? <span title={groupLabel}><BookMarked className="w-3.5 h-3.5 text-indigo-300" aria-label={groupLabel} /></span>
                  : <span title={groupLabel}><CircleDashed className="w-3.5 h-3.5 text-zinc-500" aria-label={groupLabel} /></span>}
                <span
                  className="min-w-8 text-right font-mono text-zinc-500"
                  title={trans('home.dailyReading.readCount', { count: word.play_count })}
                >
                  {trans('home.dailyReading.readCountShort', { count: word.play_count })}
                </span>
              </span>
            </li>
          );
        })}
        {viewportSpacing > 0 && <li aria-hidden="true" style={{ height: viewportSpacing }} />}
      </ol>
    </section>
  );
};
