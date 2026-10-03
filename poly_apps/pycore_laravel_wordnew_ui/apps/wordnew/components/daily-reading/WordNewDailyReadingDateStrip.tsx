import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { TONE_BAR, TONE_TEXT } from '@/shared/ui/statusTone';
import type { DailyReadingDayCount } from './useDailyReadingFeed';
import {
  DATE_STRIP_WEEKS,
  buildWeekStarts,
  dayOfMonth,
  parseDayKey,
  weekDays,
  weekIndexOf,
} from './dailyReadingDates';

interface Props {
  theme: ElementTheme;
  trans: (k: string, r?: Record<string, string | number>) => string;
  selectedDate: string;
  todayKey: string;
  calendar: Record<string, DailyReadingDayCount>;
  onSelect: (day: string) => void;
  onVisibleWeek: (weekStart: string) => void;
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const SCROLL_SETTLE_MS = 90;
const RENDER_RADIUS = 2;

interface WeekPageProps extends Pick<Props, 'theme' | 'trans' | 'selectedDate' | 'todayKey' | 'calendar' | 'onSelect'> {
  weekStart: string;
}

const WeekPage: React.FC<WeekPageProps> = ({ theme, trans, selectedDate, todayKey, calendar, onSelect, weekStart }) => (
  <div className="grid min-w-full shrink-0 snap-start grid-cols-7 gap-0.5 px-0.5" role="group">
    {weekDays(weekStart).map((day, index) => {
      const count = calendar[day];
      const hasArticles = (count?.total ?? 0) > 0;
      const done = hasArticles && (count?.read ?? 0) >= (count?.total ?? 0);
      const isToday = day === todayKey;
      const isSelected = day === selectedDate;
      const isFuture = day > todayKey;
      const circleTone = isSelected
        ? `${theme.accentBg} font-black scale-105`
        : done
          ? `border border-emerald-500/60 ${TONE_TEXT.emerald} font-bold`
          : `border ${theme.borderClass} ${theme.textPrimaryClass} bg-black/[0.03] font-semibold dark:bg-white/[0.04]`;
      return (
        <button
          key={day}
          type="button"
          disabled={isFuture}
          onClick={() => onSelect(day)}
          aria-pressed={isSelected}
          className={`flex min-w-0 flex-col items-center gap-1 py-0.5 transition-opacity ${isFuture ? 'opacity-30' : hasArticles || isSelected || isToday ? '' : 'opacity-55'}`}
        >
          <span className={`text-[10px] font-medium ${isToday ? `${theme.accentText} font-bold` : theme.textSecondaryClass}`}>
            {trans(`home.dailyReading.weekday.${WEEKDAY_KEYS[index]}`)}
          </span>
          <span className={`relative flex h-8 w-8 items-center justify-center rounded-full text-xs transition-transform ${circleTone} ${isToday && !isSelected ? `ring-1 ring-current ${theme.accentText}` : ''}`}>
            {dayOfMonth(day)}
            {done && (
              <span className={`absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-white ${TONE_BAR.emerald}`}>
                <Check className="h-2 w-2" strokeWidth={3.5} />
              </span>
            )}
          </span>
          <span className={`h-1 w-1 rounded-full ${hasArticles && !done ? `bg-current ${theme.accentText}` : 'bg-transparent'}`} />
        </button>
      );
    })}
  </div>
);

export const WordNewDailyReadingDateStrip: React.FC<Props> = ({
  theme, trans, selectedDate, todayKey, calendar, onSelect, onVisibleWeek,
}) => {
  const weekStarts = useMemo(() => buildWeekStarts(todayKey, DATE_STRIP_WEEKS), [todayKey]);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef(-1);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visibleIndex, setVisibleIndex] = useState(() => Math.max(0, weekIndexOf(weekStarts, selectedDate)));

  const scrollToPage = useCallback((index: number, smooth: boolean) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ left: index * scroller.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useLayoutEffect(() => {
    const index = weekIndexOf(weekStarts, selectedDate);
    if (index < 0 || index === pageRef.current) return;
    const first = pageRef.current < 0;
    pageRef.current = index;
    setVisibleIndex(index);
    scrollToPage(index, !first);
    onVisibleWeek(weekStarts[index]);
  }, [onVisibleWeek, scrollToPage, selectedDate, weekStarts]);

  useEffect(() => {
    const onResize = () => scrollToPage(Math.max(0, pageRef.current), false);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [scrollToPage]);

  const onScroll = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const scroller = scrollerRef.current;
      if (!scroller || scroller.clientWidth === 0) return;
      const index = Math.max(0, Math.min(weekStarts.length - 1, Math.round(scroller.scrollLeft / scroller.clientWidth)));
      if (index === pageRef.current) return;
      pageRef.current = index;
      setVisibleIndex(index);
      onVisibleWeek(weekStarts[index]);
    }, SCROLL_SETTLE_MS);
  }, [onVisibleWeek, weekStarts]);

  const turnPage = useCallback((delta: number) => {
    const target = Math.max(0, Math.min(weekStarts.length - 1, (pageRef.current < 0 ? visibleIndex : pageRef.current) + delta));
    scrollToPage(target, true);
  }, [scrollToPage, visibleIndex, weekStarts.length]);

  const monthLabel = useMemo(() => {
    const anchor = parseDayKey(weekStarts[visibleIndex] ?? todayKey);
    anchor.setDate(anchor.getDate() + 3);
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(anchor);
  }, [todayKey, visibleIndex, weekStarts]);

  return (
    <div className={`rounded-xl border ${theme.borderClass} bg-black/[0.03] px-2 py-1.5 dark:bg-white/[0.03]`}>
      <div className="flex items-center justify-between px-1">
        <span className={`text-xs font-bold ${theme.textPrimaryClass}`}>{monthLabel}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => turnPage(-1)}
            disabled={visibleIndex <= 0}
            className={`rounded-full p-1 ${theme.textSecondaryClass} disabled:opacity-30`}
            aria-label={trans('home.dailyReading.prevWeek')}
            title={trans('home.dailyReading.prevWeek')}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => turnPage(1)}
            disabled={visibleIndex >= weekStarts.length - 1}
            className={`rounded-full p-1 ${theme.textSecondaryClass} disabled:opacity-30`}
            aria-label={trans('home.dailyReading.nextWeek')}
            title={trans('home.dailyReading.nextWeek')}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: 'pan-x pan-y' }}
      >
        {weekStarts.map((weekStart, index) => (
          Math.abs(index - visibleIndex) <= RENDER_RADIUS ? (
            <WeekPage
              key={weekStart}
              theme={theme}
              trans={trans}
              selectedDate={selectedDate}
              todayKey={todayKey}
              calendar={calendar}
              onSelect={onSelect}
              weekStart={weekStart}
            />
          ) : (
            <div key={weekStart} className="min-w-full shrink-0 snap-start" aria-hidden="true" />
          )
        ))}
      </div>
    </div>
  );
};
