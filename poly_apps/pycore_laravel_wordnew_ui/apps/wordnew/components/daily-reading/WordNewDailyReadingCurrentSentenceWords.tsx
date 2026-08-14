import React, { useMemo } from 'react';
import { ScanText } from 'lucide-react';
import {
  sentenceWordTranslationText,
  type WordNewSentenceWordRow,
} from '../../services/WordNewSentenceWordTable';
import {
  normalizeEnglishWord,
  selectEnglishContentWords,
} from '../../services/WordNewCommonWordFilter';

interface Props {
  sentence: string;
  words: WordNewSentenceWordRow[];
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WordNewDailyReadingCurrentSentenceWords: React.FC<Props> = ({ sentence, words, trans }) => {
  const visibleWords = useMemo(() => {
    const rowsByWord = new Map(words.map((word) => [normalizeEnglishWord(word.word), word]));
    return selectEnglishContentWords(sentence).map((word) => ({
      key: word,
      row: rowsByWord.get(word),
    }));
  }, [sentence, words]);

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-xl border border-indigo-500/15 bg-indigo-500/[0.04] p-2">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold text-indigo-300">
        <ScanText className="h-3 w-3" />
        {trans('home.dailyReading.currentSentenceWords')}
      </div>
      {visibleWords.length > 0 ? (
        <ol>
          {visibleWords.map(({ key, row }) => {
            const meaning = row
              ? sentenceWordTranslationText(row) || trans('home.dailyReading.meaningPending')
              : trans('home.dailyReading.meaningPending');
            return (
              <li
                key={key}
                className="grid min-w-0 grid-cols-[minmax(4.5rem,0.7fr)_minmax(0,1.3fr)] gap-2 border-b border-white/[0.035] py-0.5 text-[11px] last:border-0"
              >
                <span className="truncate text-right font-semibold text-zinc-200" title={key}>{key}</span>
                <span className="truncate text-left text-zinc-500" title={meaning}>{meaning}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="truncate py-2 text-center text-[10px] text-zinc-600">
          {trans('home.dailyReading.noContentWords')}
        </p>
      )}
    </section>
  );
};
