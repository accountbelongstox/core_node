export const DATE_STRIP_WEEKS = 52;
export const DATE_STRIP_PAD_DAYS = 7;
const DAY_MS = 86_400_000;

export function toDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

export function addDays(key: string, days: number): string {
  return toDayKey(new Date(parseDayKey(key).getTime() + days * DAY_MS));
}

/** Monday of the week containing the day. */
export function weekStartKey(key: string): string {
  const weekday = (parseDayKey(key).getDay() + 6) % 7;
  return addDays(key, -weekday);
}

/** Week start keys, oldest first, ending with the week of `todayKey`. */
export function buildWeekStarts(todayKey: string, weeks: number): string[] {
  const current = weekStartKey(todayKey);
  return Array.from({ length: weeks }, (_, index) => addDays(current, -7 * (weeks - 1 - index)));
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/** Index of the week page containing the day, or -1 outside the window. */
export function weekIndexOf(weekStarts: string[], key: string): number {
  return weekStarts.indexOf(weekStartKey(key));
}

export function dayOfMonth(key: string): number {
  return parseDayKey(key).getDate();
}

/** The article's own day: reading date, else creation date, as a local day key. */
export function rowDayKey(readingDate: string | null | undefined, createdAt: string | null | undefined): string | null {
  const value = readingDate || createdAt;
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : toDayKey(parsed);
}
