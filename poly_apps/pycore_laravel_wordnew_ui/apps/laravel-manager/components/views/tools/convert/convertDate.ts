/** Pure date/time parsing, zone math (Intl) and format builders for the date/time workbench. */

export type DateFormatId =
  | 'unixSeconds' | 'unixMillis' | 'iso' | 'isoOffset' | 'rfc2822' | 'httpDate' | 'mysql' | 'locale' | 'relative' | 'dayOfWeek' | 'dayOfYear' | 'isoWeek';

export interface ZoneView {
  zone: string;
  date: string;
  time: string;
  offset: string;
  abbreviation: string;
  iso: string;
}

export const LOCAL_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export const DEFAULT_ZONES: string[] = Array.from(new Set(['UTC', LOCAL_ZONE, 'America/New_York', 'Europe/London', 'Asia/Shanghai', 'Asia/Tokyo']));
export const DATE_FORMAT_IDS: DateFormatId[] = ['unixSeconds', 'unixMillis', 'iso', 'isoOffset', 'rfc2822', 'httpDate', 'mysql', 'locale', 'relative', 'dayOfWeek', 'dayOfYear', 'isoWeek'];

const FALLBACK_ZONES = ['UTC', 'America/Los_Angeles', 'America/New_York', 'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NAIVE_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?)?$/;
const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [['year', 31557600], ['month', 2629800], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];

const pad = (value: number, length = 2): string => String(Math.abs(value)).padStart(length, '0');
const formatterCache = new Map<string, Intl.DateTimeFormat>();

const zoneFormatter = (zone: string): Intl.DateTimeFormat => {
  let formatter = formatterCache.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
    });
    formatterCache.set(zone, formatter);
  }
  return formatter;
};

export const isValidZone = (zone: string): boolean => {
  try {
    zoneFormatter(zone);
    return true;
  } catch {
    return false;
  }
};

export const listZones = (): string[] => {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const zones = supported ? supported('timeZone') : FALLBACK_ZONES;
  return zones.includes('UTC') ? zones : ['UTC', ...zones];
};

export const zoneParts = (date: Date, zone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number } => {
  const map: Record<string, string> = {};
  zoneFormatter(zone).formatToParts(date).forEach((part) => { map[part.type] = part.value; });
  return {
    year: Number(map.year), month: Number(map.month), day: Number(map.day), hour: Number(map.hour) % 24, minute: Number(map.minute), second: Number(map.second), weekday: WEEKDAYS.indexOf(map.weekday),
  };
};

/** Offset of the zone from UTC at the given instant, in minutes. */
export const zoneOffsetMinutes = (date: Date, zone: string): number => {
  const p = zoneParts(date, zone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
};

const offsetLabel = (minutes: number, colon: boolean): string => {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}${colon ? ':' : ''}${pad(abs % 60)}`;
};

const zonedToUtc = (y: number, mo: number, d: number, h: number, mi: number, s: number, ms: number, zone: string): number => {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  const first = zoneOffsetMinutes(new Date(guess), zone);
  const utc = guess - first * 60000;
  const second = zoneOffsetMinutes(new Date(utc), zone);
  return second === first ? utc : guess - second * 60000;
};

/** Parses unix seconds/ms/us/ns, ISO 8601, RFC 2822 or any Date-parsable text; naive times use `zone`. */
export const parseDateInput = (input: string, zone: string): Date | null => {
  const text = input.trim();
  if (!text) return null;
  let date: Date | null = null;
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const value = Number(text);
    const abs = Math.abs(value);
    const millis = abs < 1e11 ? value * 1000 : abs < 1e14 ? value : abs < 1e17 ? value / 1000 : value / 1e6;
    date = new Date(millis);
  } else {
    const naive = NAIVE_DATE.exec(text);
    if (naive) {
      const ms = naive[7] ? parseInt(naive[7].padEnd(3, '0').slice(0, 3), 10) : 0;
      date = new Date(zonedToUtc(Number(naive[1]), Number(naive[2]), Number(naive[3]), Number(naive[4] ?? 0), Number(naive[5] ?? 0), Number(naive[6] ?? 0), ms, zone));
    } else {
      date = new Date(text);
    }
  }
  return date && Number.isFinite(date.getTime()) ? date : null;
};

export const isoWeekOf = (date: Date, zone: string): { year: number; week: number } => {
  const p = zoneParts(date, zone);
  const day = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  return { year: day.getUTCFullYear(), week: Math.ceil(((day.getTime() - yearStart) / 86400000 + 1) / 7) };
};

export const dayOfYearOf = (date: Date, zone: string): number => {
  const p = zoneParts(date, zone);
  return Math.round((Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(p.year, 0, 1)) / 86400000) + 1;
};

export const formatIsoInZone = (date: Date, zone: string, withMillis = true): string => {
  const p = zoneParts(date, zone);
  const millis = withMillis ? `.${pad(date.getUTCMilliseconds(), 3)}` : '';
  const offset = zoneOffsetMinutes(date, zone);
  const suffix = zone === 'UTC' ? 'Z' : offsetLabel(offset, true);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${millis}${suffix}`;
};

export const formatRfc2822 = (date: Date, zone: string): string => {
  const p = zoneParts(date, zone);
  return `${WEEKDAYS[p.weekday]}, ${pad(p.day)} ${MONTHS[p.month - 1]} ${pad(p.year, 4)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)} ${offsetLabel(zoneOffsetMinutes(date, zone), false)}`;
};

export const formatMysql = (date: Date, zone: string): string => {
  const p = zoneParts(date, zone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
};

export const formatRelative = (date: Date, now: Date, locale: string): string => {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const unit = RELATIVE_UNITS.find(([, size]) => Math.abs(seconds) >= size) ?? RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
  return formatter.format(Math.round(seconds / unit[1]), unit[0]);
};

export const zoneAbbreviation = (date: Date, zone: string, locale: string): string => {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'short' }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
};

export const buildZoneView = (date: Date, zone: string, locale: string): ZoneView => {
  const p = zoneParts(date, zone);
  return {
    zone,
    date: `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`,
    offset: `UTC${offsetLabel(zoneOffsetMinutes(date, zone), true)}`,
    abbreviation: zoneAbbreviation(date, zone, locale),
    iso: formatIsoInZone(date, zone, false),
  };
};

export const buildDateFormats = (date: Date, zone: string, now: Date, locale: string): Record<DateFormatId, string> => ({
  unixSeconds: String(Math.floor(date.getTime() / 1000)),
  unixMillis: String(date.getTime()),
  iso: formatIsoInZone(date, 'UTC'),
  isoOffset: formatIsoInZone(date, zone),
  rfc2822: formatRfc2822(date, zone),
  httpDate: date.toUTCString(),
  mysql: formatMysql(date, zone),
  locale: new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'long', timeZone: zone }).format(date),
  relative: formatRelative(date, now, locale),
  dayOfWeek: new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: zone }).format(date),
  dayOfYear: String(dayOfYearOf(date, zone)),
  isoWeek: (() => {
    const { year, week } = isoWeekOf(date, zone);
    return `${year}-W${pad(week)}`;
  })(),
});

export const toLocalInputValue = (date: Date, zone: string): string => {
  const p = zoneParts(date, zone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
};
