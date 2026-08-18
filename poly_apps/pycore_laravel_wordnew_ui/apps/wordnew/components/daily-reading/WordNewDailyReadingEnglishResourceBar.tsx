import React from 'react';
import type { WordNewSentenceWordRow } from '../../services/WordNewSentenceWordTable';
import type { DailyReadingResourceStatus } from './DailyReadingPlaybackModel';
import { WordNewDailyReadingResourceStatus } from './WordNewDailyReadingResourceStatus';

interface Props {
  sentence: string;
  words: WordNewSentenceWordRow[];
  status: DailyReadingResourceStatus;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WordNewDailyReadingEnglishResourceBar: React.FC<Props> = ({
  sentence,
  words,
  status,
  trans,
}) => (
  <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
      {trans('home.dailyReading.english')}
    </span>
    <div className="min-w-0 flex-1 overflow-hidden">
      <WordNewDailyReadingResourceStatus
        sentence={sentence}
        words={words}
        status={status}
        trans={trans}
        compact
      />
    </div>
  </div>
);
