import React, { useCallback, useEffect, useRef } from 'react';
import type { WordNewArticleSentenceSegment } from '../../services/WordNewArticlePlaybackHighlighter';
import {
  useDailyReadingViewportSpacing,
  type DailyReadingViewportMode,
} from '../../hooks/useDailyReadingViewportSpacing';

interface Props {
  segments: WordNewArticleSentenceSegment[];
  activeIndex: number;
  language: 'en' | 'cn';
  underline: boolean;
  scrollRatio: number;
  scrollPaused: boolean;
  onScroll: (ratio: number) => void;
  viewportMode: DailyReadingViewportMode;
  className?: string;
}

/** Scrollable sentence list with explicit word/article viewport modes.
 * Article mode centers playback with half-height spacers; word mode has none. */
export const WordNewDailyReadingSentencePane: React.FC<Props> = ({
  segments,
  activeIndex,
  language,
  underline,
  scrollRatio,
  scrollPaused,
  onScroll,
  viewportMode,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const viewportSpacing = useDailyReadingViewportSpacing(containerRef, viewportMode);

  useEffect(() => {
    if (scrollPaused) return;
    const container = containerRef.current;
    if (!container) return;
    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll <= 0) return;
    const targetTop = Math.max(0, Math.min(maxScroll, scrollRatio * maxScroll));
    if (Math.abs(container.scrollTop - targetTop) < 1) return;
    isProgrammaticScrollRef.current = true;
    container.scrollTop = targetTop;
  }, [scrollRatio, scrollPaused, viewportSpacing]);

  const handleScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) {
      isProgrammaticScrollRef.current = false;
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const maxScroll = container.scrollHeight - container.clientHeight;
    const ratio = maxScroll > 0 ? container.scrollTop / maxScroll : 0;
    onScroll(ratio);
  }, [onScroll]);

  const textClass = language === 'en'
    ? 'text-base text-zinc-200'
    : 'text-sm text-zinc-500';

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`min-w-0 max-w-full overflow-x-hidden overflow-y-auto overscroll-contain ${className ?? ''}`}
    >
      {viewportSpacing > 0 && <div aria-hidden="true" style={{ height: viewportSpacing }} />}
      {segments.map((segment, index) => {
        const isActive = index === activeIndex;
        return (
          <p
            key={`${language}-${index}`}
            className={`max-w-full break-words [overflow-wrap:anywhere] whitespace-pre-wrap rounded-lg px-2 py-1 leading-relaxed transition-colors duration-300 ${textClass} ${
              isActive ? 'bg-indigo-500/10' : ''
            }`}
          >
            <span
              className={
                isActive && underline
                  ? 'underline decoration-indigo-300/50 decoration-1 underline-offset-4'
                  : undefined
              }
            >
              {segment.text}
            </span>
          </p>
        );
      })}
      {viewportSpacing > 0 && <div aria-hidden="true" style={{ height: viewportSpacing }} />}
    </div>
  );
};
