/** Locale-aware money formatting for public CodeMart figures. */
export function formatCmAmount(value: string | number, currency: string | null | undefined, language: string): string {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);
  try {
    return new Intl.NumberFormat(language, currency
      ? { style: 'currency', currency, maximumFractionDigits: 0 }
      : { maximumFractionDigits: 2 }).format(amount);
  } catch {
    return new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(amount);
  }
}

/** Locale-aware "min – max" money range. */
export function formatCmAmountRange(
  min: string | number,
  max: string | number,
  currency: string | null | undefined,
  language: string,
): string {
  const low = Number(min);
  const high = Number(max);
  if (currency && Number.isFinite(low) && Number.isFinite(high)) {
    try {
      const formatter = new Intl.NumberFormat(language, { style: 'currency', currency, maximumFractionDigits: 0 }) as Intl.NumberFormat & {
        formatRange?: (start: number, end: number) => string;
      };
      if (typeof formatter.formatRange === 'function') return formatter.formatRange(low, high);
    } catch {
      /* fall through to the joined form */
    }
  }
  return `${formatCmAmount(min, currency, language)} – ${formatCmAmount(max, currency, language)}`;
}

export function formatCmDate(value: string | null | undefined, language: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date);
}
