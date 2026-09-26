import { useMemo } from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import type { CmListPage, CmPagination } from '../../api/CmApiTypes';

const LIST_SEPARATOR = /[,\n]/;
const DATE_LENGTH = 10;
const DATE_TIME_LENGTH = 16;
const MONEY_FRACTION_DIGITS = 2;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
export function cmFormatMoney(value: string | number | null | undefined, currency: string | null | undefined, language: string): string {
  if (value === null || value === undefined || value === '') return '';
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);
  const digits = { minimumFractionDigits: MONEY_FRACTION_DIGITS, maximumFractionDigits: MONEY_FRACTION_DIGITS };
  if (currency) {
    try {
      return new Intl.NumberFormat(language, { style: 'currency', currency, ...digits }).format(amount);
    } catch {
      return `${currency} ${new Intl.NumberFormat(language, digits).format(amount)}`;
    }
  }
  return new Intl.NumberFormat(language, digits).format(amount);
}

export function cmFormatNumber(value: string | number | null | undefined, language: string): string {
  if (value === null || value === undefined || value === '') return '';
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat(language).format(amount) : String(value);
}

function parseDate(value: string): Date | null {
  const date = DATE_ONLY_PATTERN.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function cmFormatDate(value: string | null | undefined, language: string): string {
  if (!value) return '';
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date) : value;
}

export function cmFormatDateTime(value: string | null | undefined, language: string): string {
  if (!value) return '';
  const date = parseDate(value);
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
