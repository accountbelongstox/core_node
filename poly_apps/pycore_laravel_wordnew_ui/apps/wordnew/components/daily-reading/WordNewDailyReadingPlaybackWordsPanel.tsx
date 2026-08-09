import React, { useEffect, useRef } from 'react';
import { BookMarked, CircleDashed, ListMusic } from 'lucide-react';
import type { WordNewSentenceWordRow } from '../../services/WordNewSentenceWordTable';
import { WordNewAudioStatusIcon } from '../WordNewAudioStatusIcon';
import { wordAudioQueueKey, wordTranslationQueueKey } from '../../services/WordNewQueueRuntime';

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
  const activeItemRef = useRef<HTMLLIElement | null>(null);
  const addedCount = new Set(words
    .filter((word) => word.added_to_default_group)
    .map((word) => word.word.trim().toLocaleLowerCase())
    .filter(Boolean)).size;

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
            {trans('home.dailyReading.articleDefaultGroupAdded', { count: addedCount })}
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
      <ol className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {words.map((word, wordIndex) => {
          const translations = word.translations?.filter((value) => typeof value === 'string' && value.trim()) ?? [];
          const meaning = translations.join(' / ') || word.explanation || trans('home.dailyReading.meaningPending');
          const isActive = wordIndex === activeWordIndex;
          const hasAudio = word.audio_status === 'ready' && !!word.audio_url;
          const groupLabel = trans(word.in_default_group
            ? 'home.dailyReading.defaultGroupLinked'
            : 'home.dailyReading.defaultGroupPending');
          return (
            <li
              key={`${word.word}-${wordIndex}`}
              ref={isActive ? activeItemRef : undefined}
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
                <WordNewAudioStatusIcon
                  state={hasAudio ? 'ready' : 'waiting'}
                  queueKey={wordAudioQueueKey(word.word, 'en')}
                  trans={trans}
                />
                {translations.length === 0 ? (
                  <WordNewAudioStatusIcon
                    state="waiting"
                    resource="translation"
                    queueKey={wordTranslationQueueKey(word.word, 'en', 'zh')}
                    trans={trans}
                  />
                ) : null}
                {word.in_default_group
                  ? <BookMarked className="w-3.5 h-3.5 text-indigo-300" aria-label={groupLabel} title={groupLabel} />
                  : <CircleDashed className="w-3.5 h-3.5 text-zinc-500" aria-label={groupLabel} title={groupLabel} />}
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
      </ol>
    </section>
  );
};
