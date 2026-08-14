import React from 'react';
import { Languages, Volume2 } from 'lucide-react';
import { WordNewResourceStatusIcon } from '../WordNewResourceStatusIcon';
import {
  sentenceAudioQueueKey,
  wordAudioQueueKey,
  wordTranslationQueueKey,
} from '../../services/WordNewQueueRuntime';
import {
  sentenceWordTranslations,
  type WordNewSentenceWordRow,
} from '../../services/WordNewSentenceWordTable';
import type { DailyReadingResourceStatus } from './DailyReadingPlaybackModel';

interface Props {
  sentence: string;
  words: WordNewSentenceWordRow[];
  status: DailyReadingResourceStatus;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  compact?: boolean;
}

export const WordNewDailyReadingResourceStatus: React.FC<Props> = ({
  sentence,
  words,
  status,
  trans,
  compact = false,
}) => {
  const pendingAudioWord = words.find((word) => !word.audio_url || word.audio_status !== 'ready') ?? words[0];
  const pendingTranslationWord = words.find((word) => sentenceWordTranslations(word).length === 0) ?? words[0];
  const articleReady = status.articleAudioTotal > 0
    && status.articleAudioReady >= status.articleAudioTotal;
  const wordAudioReady = status.wordAudioTotal > 0
    && status.wordAudioReady >= status.wordAudioTotal;
  const translationsReady = status.translationsTotal > 0
    && status.translationsReady >= status.translationsTotal;
  const chipClass = compact
    ? 'inline-flex min-w-0 items-center gap-1 text-[9px] font-mono text-zinc-400'
    : 'inline-flex min-w-0 items-center gap-1 rounded-full border border-white/5 bg-white/[0.025] px-2 py-1 text-[10px] font-mono text-zinc-400';

  return (
    <div className={`flex min-w-0 items-center gap-x-2 gap-y-1 ${compact ? 'flex-nowrap overflow-hidden' : 'flex-wrap'}`}>
      <span className={chipClass}>
        <WordNewResourceStatusIcon
          state={articleReady ? 'ready' : 'waiting'}
          queueKey={sentenceAudioQueueKey(sentence, 'en')}
          trans={trans}
        />
        <span className="truncate">
          {trans('home.dailyReading.articleAudioResource', {
            ready: status.articleAudioReady,
            total: status.articleAudioTotal,
          })}
        </span>
      </span>
      <span className={chipClass}>
        <Volume2 className="h-3 w-3 shrink-0 text-indigo-300" />
        {pendingAudioWord ? (
          <WordNewResourceStatusIcon
            state={wordAudioReady ? 'ready' : 'waiting'}
            queueKey={wordAudioQueueKey(pendingAudioWord.word, 'en')}
            trans={trans}
          />
        ) : null}
        <span className="truncate">
          {trans('home.dailyReading.wordAudioResource', {
            ready: status.wordAudioReady,
            total: status.wordAudioTotal,
          })}
        </span>
      </span>
      <span className={chipClass}>
        <Languages className="h-3 w-3 shrink-0 text-cyan-300" />
        {pendingTranslationWord ? (
          <WordNewResourceStatusIcon
            state={translationsReady ? 'ready' : 'waiting'}
            resource="translation"
            queueKey={wordTranslationQueueKey(pendingTranslationWord.word, 'en', 'zh')}
            trans={trans}
          />
        ) : null}
        <span className="truncate">
          {trans('home.dailyReading.translationResource', {
            ready: status.translationsReady,
            total: status.translationsTotal,
          })}
        </span>
      </span>
    </div>
  );
};
