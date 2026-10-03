import { useCallback, useEffect, useRef, useState } from 'react';
import { wfNewApi } from '../../api';
import {
  fetchDailyReadingFeed,
  type DailyReadingRow,
} from './dailyReadingApi';
import {
  DATE_STRIP_PAD_DAYS,
  addDays,
  toDayKey,
  weekStartKey,
} from './dailyReadingDates';
import { clearGuestReads, guestReadIds, setGuestRead } from './dailyReadingGuestReads';

export interface DailyReadingDayCount {
  total: number;
  read: number;
}

export interface DailyReadingFeed {
  todayKey: string;
  selectedDate: string;
  selectDate: (day: string) => void;
  calendar: Record<string, DailyReadingDayCount>;
  ensureWeek: (weekStart: string) => void;
  items: DailyReadingRow[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  refresh: (silent?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  loadAll: () => Promise<DailyReadingRow[]>;
  setRead: (articleId: string, read: boolean) => Promise<void>;
  markRead: (articleId: string) => void;
  patchItems: (patch: (row: DailyReadingRow) => DailyReadingRow) => void;
}

function overlayGuestReads(rows: DailyReadingRow[]): DailyReadingRow[] {
  if (wfNewApi.isAuthenticated()) return rows;
  const guest = guestReadIds();
  if (guest.size === 0) return rows;
  return rows.map((row) => (guest.has(row.id) && !row.read ? { ...row, read: true } : row));
}

function mergeById(current: DailyReadingRow[], incoming: DailyReadingRow[]): DailyReadingRow[] {
  const seen = new Set(current.map((row) => row.id));
  return [...current, ...incoming.filter((row) => !seen.has(row.id))];
}

/** Day-scoped, cursor-paged Daily Reading feed plus the date-strip calendar; read state lives in Laravel. */
export function useDailyReadingFeed(pageSize: number, fallbackError: string): DailyReadingFeed {
  const [todayKey] = useState(() => toDayKey(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [calendar, setCalendar] = useState<Record<string, DailyReadingDayCount>>({});
  const [items, setItems] = useState<DailyReadingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const requestId = useRef(0);
  const cursorRef = useRef<number | null>(null);
  const itemsRef = useRef<DailyReadingRow[]>([]);
  const selectedRef = useRef(todayKey);
  const loadingMoreRef = useRef(false);
  const visibleWeekRef = useRef(weekStartKey(todayKey));
  const loadedWeeksRef = useRef(new Set<string>());
  const initialPickedRef = useRef(false);
  itemsRef.current = items;
  selectedRef.current = selectedDate;

  const applyCalendar = useCallback((from: string, to: string, days: Array<{ date: string; total: number; read: number }>) => {
    if (!mounted.current) return;
    setCalendar((current) => {
      const next = { ...current };
      const byDate = new Map(days.map((day) => [day.date, day]));
      for (let key = from; key <= to; key = addDays(key, 1)) {
        const day = byDate.get(key);
        next[key] = { total: day?.total ?? 0, read: day?.read ?? 0 };
      }
      return next;
    });
  }, []);

  const fetchCalendarRange = useCallback(async (from: string, to: string) => {
    const result = await wfNewApi.getDailyReadingCalendar(from, to);
    applyCalendar(from, to, result.days);
    return result;
  }, [applyCalendar]);

  const ensureWeek = useCallback((weekStart: string) => {
    visibleWeekRef.current = weekStart;
    if (loadedWeeksRef.current.has(weekStart)) return;
    loadedWeeksRef.current.add(weekStart);
    const to = addDays(weekStart, 6 + DATE_STRIP_PAD_DAYS);
    void fetchCalendarRange(addDays(weekStart, -DATE_STRIP_PAD_DAYS), to).catch(() => {
      loadedWeeksRef.current.delete(weekStart);
    });
  }, [fetchCalendarRange]);

  const loadFirstPage = useCallback(async (day: string, silent: boolean) => {
    const id = ++requestId.current;
    if (!silent) {
      setLoading(true);
      setItems([]);
      setHasMore(false);
      setTotal(0);
    }
    try {
      const page = await fetchDailyReadingFeed(day, null, pageSize);
      if (!mounted.current || id !== requestId.current) return;
      const rows = overlayGuestReads(page.items);
      const keepLaterPages = silent && itemsRef.current.length > rows.length;
      setItems((current) => (keepLaterPages ? mergeById(rows, current) : rows));
      setTotal(page.total);
      if (!keepLaterPages) {
        cursorRef.current = page.nextCursor;
        setHasMore(page.hasMore);
      }
      setError(null);
    } catch (loadError) {
      if (mounted.current && id === requestId.current) {
        setError(loadError instanceof Error ? loadError.message : fallbackError);
      }
    } finally {
      if (mounted.current && id === requestId.current) setLoading(false);
    }
  }, [fallbackError, pageSize]);

  const refresh = useCallback(async (silent = false) => {
    const week = visibleWeekRef.current;
    const calendarTask = fetchCalendarRange(
      addDays(week, -DATE_STRIP_PAD_DAYS),
      addDays(week, 6 + DATE_STRIP_PAD_DAYS),
    ).catch(() => undefined);
    await Promise.all([loadFirstPage(selectedRef.current, silent), calendarTask]);
  }, [fetchCalendarRange, loadFirstPage]);

  const selectDate = useCallback((day: string) => {
    initialPickedRef.current = true;
    if (day === selectedRef.current) return;
    selectedRef.current = day;
    cursorRef.current = null;
    setSelectedDate(day);
    void loadFirstPage(day, false);
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (loadingMoreRef.current || cursor === null) return;
    const day = selectedRef.current;
    const id = requestId.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchDailyReadingFeed(day, cursor, pageSize);
      if (!mounted.current || id !== requestId.current || day !== selectedRef.current) return;
      cursorRef.current = page.nextCursor;
      setHasMore(page.hasMore);
      setTotal(page.total);
      setItems((current) => mergeById(current, overlayGuestReads(page.items)));
    } catch (loadError) {
      if (mounted.current) setError(loadError instanceof Error ? loadError.message : fallbackError);
    } finally {
      loadingMoreRef.current = false;
      if (mounted.current) setLoadingMore(false);
    }
  }, [fallbackError, pageSize]);

  const loadAll = useCallback(async (): Promise<DailyReadingRow[]> => {
    const day = selectedRef.current;
    let rows = itemsRef.current;
    let cursor = cursorRef.current;
    while (cursor !== null && day === selectedRef.current) {
      const page = await fetchDailyReadingFeed(day, cursor, pageSize);
      if (!mounted.current || day !== selectedRef.current) break;
      rows = mergeById(rows, overlayGuestReads(page.items));
      cursor = page.nextCursor;
      cursorRef.current = cursor;
      setItems(rows);
      setHasMore(page.hasMore);
    }
    return rows;
  }, [pageSize]);

  const adjustDayRead = useCallback((day: string, delta: number) => {
    setCalendar((current) => {
      const entry = current[day];
      if (!entry) return current;
      return { ...current, [day]: { ...entry, read: Math.max(0, Math.min(entry.total, entry.read + delta)) } };
    });
  }, []);

  const setRead = useCallback(async (articleId: string, read: boolean) => {
    const row = itemsRef.current.find((item) => item.id === articleId);
    if (row && (row.read === true) === read) return;
    const day = selectedRef.current;
    const patch = (value: boolean) => setItems((current) => current.map((item) => (
      item.id === articleId ? { ...item, read: value, read_at: value ? new Date().toISOString() : null } : item
    )));
    if (row) {
      patch(read);
      adjustDayRead(day, read ? 1 : -1);
    }
    if (!wfNewApi.isAuthenticated()) {
      setGuestRead(articleId, read);
      return;
    }
    const states = await wfNewApi.setDailyReadingRead([articleId], read);
    if (states || !mounted.current) return;
    if (row) {
      patch(!read);
      adjustDayRead(day, read ? -1 : 1);
    }
  }, [adjustDayRead]);

  const markRead = useCallback((articleId: string) => {
    void setRead(articleId, true);
  }, [setRead]);

  const patchItems = useCallback((patch: (row: DailyReadingRow) => DailyReadingRow) => {
    setItems((current) => current.map(patch));
  }, []);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const start = async () => {
      if (wfNewApi.isAuthenticated()) {
        const local = [...guestReadIds()];
        if (local.length > 0) {
          const states = await wfNewApi.setDailyReadingRead(local, true);
          if (states) clearGuestReads();
        }
      }
      const week = visibleWeekRef.current;
      loadedWeeksRef.current.add(week);
      const result = await fetchCalendarRange(
        addDays(week, -DATE_STRIP_PAD_DAYS),
        addDays(week, 6 + DATE_STRIP_PAD_DAYS),
      ).catch(() => null);
      if (cancelled) return;
      const latest = result?.latestDate ?? null;
      const todayCount = result?.days.find((day) => day.date === todayKey)?.total ?? 0;
      if (!initialPickedRef.current && todayCount === 0 && latest && latest < todayKey) {
        initialPickedRef.current = true;
        selectedRef.current = latest;
        setSelectedDate(latest);
        void loadFirstPage(latest, false);
        return;
      }
      initialPickedRef.current = true;
      void loadFirstPage(selectedRef.current, false);
    };
    void start();
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [fetchCalendarRange, loadFirstPage, todayKey]);

  return {
    todayKey,
    selectedDate,
    selectDate,
    calendar,
    ensureWeek,
    items,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    refresh,
    loadMore,
    loadAll,
    setRead,
    markRead,
    patchItems,
  };
}
