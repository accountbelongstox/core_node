import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { wordNewArticlePlaybackHighlighter } from '../../services/WordNewArticlePlaybackHighlighter';
import type { WordNewSentenceWordRow } from '../../services/WordNewSentenceWordTable';
import { useScrollPause } from '../../hooks/useScrollPause';
import { useDailyReadingScrollOffset } from '../../hooks/useDailyReadingScrollOffset';
import { WordNewDailyReadingSentencePane } from './WordNewDailyReadingSentencePane';
import { WordNewDailyReadingCurrentSentenceWords } from './WordNewDailyReadingCurrentSentenceWords';
import { WordNewDailyReadingEnglishResourceBar } from './WordNewDailyReadingEnglishResourceBar';
import type {
  DailyReadingPlaybackStep,
  DailyReadingResourceStatus,
} from './DailyReadingPlaybackModel';

interface Props {
  articleId: string;
  articleEn: string | null;
  referenceCn: string | null;
  articleWords: WordNewSentenceWordRow[];
  resourceStatus: DailyReadingResourceStatus;
  currentTime: number;
  duration: number;
  activeStepType: DailyReadingPlaybackStep['type'] | null;
  activeSentenceLanguage: 'en' | 'cn' | null;
  bilingual: boolean;
  underline: boolean;
  hideEnglishResourceBar: boolean;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export const WordNewDailyReadingArticleView: React.FC<Props> = ({
  articleId,
  articleEn,
  referenceCn,
  articleWords,
  resourceStatus,
  currentTime,
  duration,
  activeStepType,
  activeSentenceLanguage,
  bilingual,
  underline,
  hideEnglishResourceBar,
  trans,
}) => {
  const englishSegments = useMemo(
    () => wordNewArticlePlaybackHighlighter.segment(articleEn ?? ''),
    [articleEn],
  );
  const chineseSegments = useMemo(
    () => wordNewArticlePlaybackHighlighter.segment(referenceCn ?? ''),
    [referenceCn],
  );
  const { isScrolling, onScroll: markScrolling } = useScrollPause();
  const { getOffset, setOffset } = useDailyReadingScrollOffset();
  const [userOffset, setUserOffset] = useState(() => getOffset(articleId));
  const [sentenceRatio, setSentenceRatio] = useState(0);
  const [englishExpanded, setEnglishExpanded] = useState(true);

  useEffect(() => {
    setUserOffset(getOffset(articleId));
    setSentenceRatio(0);
    setEnglishExpanded(true);
  }, [articleId, getOffset]);

  useEffect(() => {
    if (activeStepType !== 'sentence' || duration <= 0) return;
    setSentenceRatio(Math.max(0, Math.min(1, currentTime / duration)));
  }, [activeStepType, currentTime, duration]);

  const scrollRatio = clampRatio(sentenceRatio + userOffset);
  const handlePaneScroll = useCallback((ratio: number) => {
    markScrolling();
    const offset = ratio - sentenceRatio;
    setUserOffset(offset);
    setOffset(articleId, offset);
  }, [markScrolling, sentenceRatio, articleId, setOffset]);

  if (!articleEn) return null;

  const enActiveIndex = wordNewArticlePlaybackHighlighter.indexAtRatio(englishSegments, scrollRatio);
  const cnActiveIndex = wordNewArticlePlaybackHighlighter.indexAtRatio(chineseSegments, scrollRatio);
  const currentSentence = englishSegments[enActiveIndex]?.text ?? '';
  const showChinese = Boolean((bilingual || activeSentenceLanguage === 'cn') && referenceCn && chineseSegments.length > 0);
  const showEnglish = bilingual || activeSentenceLanguage !== 'cn';
  const panesHeight = 'h-[calc(100dvh-14rem)] min-h-48 max-h-[42rem]';
  const viewportMode = activeStepType === 'words' ? 'words' : 'article';

  return (
    <div className="min-w-0 max-w-full space-y-2 overflow-hidden">
      {activeStepType === 'sentence' && (
        <WordNewDailyReadingCurrentSentenceWords
          sentence={currentSentence}
          words={articleWords}
          trans={trans}
        />
      )}
      {!showEnglish && !hideEnglishResourceBar && (
        <div className="flex min-w-0 max-w-full items-center overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
          <WordNewDailyReadingEnglishResourceBar
            sentence={articleEn}
            words={articleWords}
            status={resourceStatus}
            trans={trans}
          />
        </div>
      )}
      <div className={`flex min-w-0 max-w-full flex-col gap-2 overflow-hidden ${panesHeight}`}>
        {showEnglish && (
          <section className={`flex min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-white/5 ${englishExpanded ? 'min-h-0 flex-1' : 'shrink-0'}`}>
            {!hideEnglishResourceBar && (
              <button
                type="button"
                onClick={() => setEnglishExpanded((expanded) => !expanded)}
                className="flex min-w-0 max-w-full items-center gap-2 bg-white/[0.02] px-2.5 py-1.5 text-left"
                title={trans(englishExpanded
                  ? 'home.dailyReading.collapseEnglish'
                  : 'home.dailyReading.expandEnglish')}
              >
                <WordNewDailyReadingEnglishResourceBar
                  sentence={articleEn}
                  words={articleWords}
                  status={resourceStatus}
                  trans={trans}
                />
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform ${englishExpanded ? 'rotate-180' : ''}`} />
              </button>
            )}
            {englishExpanded && (
              <WordNewDailyReadingSentencePane
                segments={englishSegments}
                activeIndex={enActiveIndex}
                language="en"
                underline={underline}
                scrollRatio={scrollRatio}
                scrollPaused={isScrolling}
                onScroll={handlePaneScroll}
                viewportMode={viewportMode}
                className="min-h-0 min-w-0 max-w-full flex-1"
              />
            )}
          </section>
        )}
        {showChinese && (
          <section className="min-h-0 min-w-0 max-w-full flex-1 overflow-hidden rounded-xl border border-white/5">
            <WordNewDailyReadingSentencePane
              segments={chineseSegments}
              activeIndex={cnActiveIndex}
              language="cn"
              underline={underline}
              scrollRatio={scrollRatio}
              scrollPaused={isScrolling}
              onScroll={handlePaneScroll}
              viewportMode={viewportMode}
              className="h-full min-h-0 min-w-0 max-w-full"
            />
          </section>
        )}
      </div>
    </div>
  );
};
