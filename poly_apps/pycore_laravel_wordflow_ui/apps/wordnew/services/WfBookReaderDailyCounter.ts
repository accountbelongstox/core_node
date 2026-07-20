/**
 * WfBookReaderDailyCounter — the book reader's "read today" counter.
 * Local, device-persisted day counter (localStorage, keyed by local calendar
 * day) so the reader can show how many sentences were read today without any
 * backend dependency — best-effort, never blocks, resets at local midnight.
 * Mirrors the daily-set pattern of WfNewStudyProgress (dailyDate + daily).
 */

const STORAGE_KEY = 'wfnew_reader_daily_v1';

interface DailyShape {
  /** local calendar day (YYYY-MM-DD) the counter belongs to. */
  date: string;
  /** sentences read (playback activations) on that day. */
  sentences: number;
}

const localDateKey = (): string => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

function load(): DailyShape {
  const today = localDateKey();
  try {
    if (typeof localStorage === 'undefined') return { date: today, sentences: 0 };
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as DailyShape) : null;
    if (parsed && parsed.date === today && Number.isFinite(parsed.sentences)) {
      return parsed;
    }
  } catch {
    /* corrupt / unavailable → start fresh */
  }
  return { date: today, sentences: 0 };
}

function save(shape: DailyShape): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shape));
  } catch {
    /* quota / unavailable → keep counting in memory only */
  }
}

/** Sentences read today (0 on a fresh day or unreadable storage). */
export function getReaderTodayCount(): number {
  return load().sentences;
}

/** Count one more sentence read today; returns the new total. Never throws. */
export function bumpReaderTodayCount(): number {
  const shape = load();
  shape.sentences += 1;
  save(shape);
  return shape.sentences;
}
