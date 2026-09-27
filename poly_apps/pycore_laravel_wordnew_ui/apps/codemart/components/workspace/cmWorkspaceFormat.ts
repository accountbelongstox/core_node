import { useMemo } from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import type { CmListPage, CmPagination } from '../../api/CmApiTypes';

const LIST_SEPARATOR = /[,\n]/;
const DATE_LENGTH = 10;
const DATE_TIME_LENGTH = 16;
const MONEY_FRACTION_DIGITS = 2;
export const CM_WHOLE_MONEY_DIGITS = 0;
const PERCENT_FRACTION_DIGITS = 2;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UTC_MIDNIGHT_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ]00:00:00(?:\.0+)?(?:Z|[+-]00:?00)$/;

export function cmSplitList(value: string): string[] {
  return Array.from(new Set(value.split(LIST_SEPARATOR).map((item) => item.trim()).filter((item) => item !== '')));
}

export function cmJoinList(values: string[] | null | undefined): string {
  return Array.isArray(values) ? values.join(', ') : '';
}

/** ISO date part (yyyy-mm-dd) for date inputs. */
export function cmShortDate(value: string | null | undefined): string {
  return value ? value.slice(0, DATE_LENGTH) : '';
}

export function cmDateTime(value: string | null | undefined): string {
  return value ? value.slice(0, DATE_TIME_LENGTH).replace('T', ' ') : '';
}

export function cmTotalPages(source: Partial<CmListPage<unknown>> | Partial<CmPagination> | null | undefined): number {
  if (!source) return 1;
  const explicit = (source as { total_pages?: number }).total_pages ?? (source as { totalPages?: number }).totalPages;
  if (typeof explicit === 'number' && explicit > 0) return explicit;
  const size = (source as { page_size?: number }).page_size ?? (source as { pageSize?: number }).pageSize ?? 0;
  const total = source.total ?? 0;
  return size > 0 ? Math.max(1, Math.ceil(total / size)) : 1;
}

export function cmUserLabel(user: { name?: string | null; username?: string | null; id?: number } | null | undefined, fallback: string): string {
  return user?.name || user?.username || fallback;
}

/** Locale money: "¥185,000.00" / "CN¥185,000.00"; plain grouped number when no currency is known. */
export function cmFormatMoney(
  value: string | number | null | undefined,
  currency: string | null | undefined,
  language: string,
  fractionDigits: number = MONEY_FRACTION_DIGITS,
): string {
  if (value === null || value === undefined || value === '') return '';
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);
  const digits = { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits };
  if (currency) {
    try {
      return new Intl.NumberFormat(language, { style: 'currency', currency, ...digits }).format(amount);
    } catch {
      return `${currency} ${new Intl.NumberFormat(language, digits).format(amount)}`;
    }
  }
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: Math.max(fractionDigits, MONEY_FRACTION_DIGITS),
  }).format(amount);
}

/** Locale "min – max" money range; uses Intl range formatting where the runtime has it. */
export function cmFormatMoneyRange(
  min: string | number,
  max: string | number,
  currency: string | null | undefined,
  language: string,
  fractionDigits: number = MONEY_FRACTION_DIGITS,
): string {
  const low = Number(min);
  const high = Number(max);
  if (currency && Number.isFinite(low) && Number.isFinite(high)) {
    try {
      const formatter = new Intl.NumberFormat(language, {
        style: 'currency',
        currency,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }) as Intl.NumberFormat & { formatRange?: (start: number, end: number) => string };
      if (typeof formatter.formatRange === 'function') return formatter.formatRange(low, high);
    } catch {
      /* fall through to the joined form */
    }
  }
  return `${cmFormatMoney(min, currency, language, fractionDigits)} – ${cmFormatMoney(max, currency, language, fractionDigits)}`;
}

export function cmFormatNumber(value: string | number | null | undefined, language: string): string {
  if (value === null || value === undefined || value === '') return '';
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat(language).format(amount) : String(value);
}

/** Locale percent from a rate: 0.1 -> "10%". */
export function cmFormatPercent(value: string | number | null | undefined, language: string): string {
  if (value === null || value === undefined || value === '') return '';
  const rate = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(rate)
    ? new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: PERCENT_FRACTION_DIGITS }).format(rate)
    : String(value);
}

/** Calendar mode reads a UTC-midnight timestamp (a serialized Laravel `date`) as that local calendar day. */
export function cmParseDate(value: string, calendar = false): Date | null {
  const day = DATE_ONLY_PATTERN.test(value) ? value : (calendar ? UTC_MIDNIGHT_PATTERN.exec(value)?.[1] : undefined);
  const date = day ? new Date(`${day}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function cmFormatDate(value: string | null | undefined, language: string): string {
  if (!value) return '';
  const date = cmParseDate(value, true);
  return date ? new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date) : value;
}

export function cmFormatDateTime(value: string | null | undefined, language: string): string {
  if (!value) return '';
  const date = cmParseDate(value);
  return date ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : value;
}

export interface CmFormatters {
  language: string;
  money: (value: string | number | null | undefined, currency?: string | null) => string;
  number: (value: string | number | null | undefined) => string;
  date: (value: string | null | undefined) => string;
  dateTime: (value: string | null | undefined) => string;
}

/** Formatters bound to the active interface language. */
export function useCmFormat(): CmFormatters {
  const { i18n } = useTranslation('cm');
  const language = i18n.language || 'en';
  return useMemo<CmFormatters>(() => ({
    language,
    money: (value, currency) => cmFormatMoney(value, currency, language),
    number: (value) => cmFormatNumber(value, language),
    date: (value) => cmFormatDate(value, language),
    dateTime: (value) => cmFormatDateTime(value, language),
  }), [language]);
}
