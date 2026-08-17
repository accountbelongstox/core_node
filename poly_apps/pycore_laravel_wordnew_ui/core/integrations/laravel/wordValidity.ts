/**
 * Shared word-validity field normalization (single implementation).
 *
 * The dictionary `is_valid` flag is boolean at the database level, but the UI
 * must tolerate string forms: falsy strings ('false'/'0'/'invalid') mean
 * invalid, any other string (e.g. the 'ai_ensure' source marker) still means
 * valid, and null/undefined means "never checked" — valid by default, matching
 * the backend contract.
 */

/** Minimal structural shape every validity-bearing row satisfies. */
export interface WordValidityFields {
  is_valid?: boolean | string;
  is_valid_value?: boolean | string | null;
  validity_source?: string | null;
}

/** True unless the row is explicitly marked invalid. */
export function isWordRowValid(row: WordValidityFields): boolean {
  const raw = row.is_valid_value ?? row.is_valid;
  if (raw === null || raw === undefined) return true;
  if (typeof raw === 'boolean') return raw;
  const normalized = String(raw).trim().toLowerCase();
  return !(normalized === 'false' || normalized === '0' || normalized === 'invalid' || normalized === '');
}

/**
 * Human-facing validity value: the string source marker (e.g. 'ai_ensure')
 * when present, otherwise the raw boolean stringified.
 */
export function wordValidityDisplay(row: WordValidityFields): string {
  const source = typeof row.validity_source === 'string' ? row.validity_source.trim() : '';
  if (source !== '') return source;
  if (row.is_valid_value === null || row.is_valid_value === undefined) return String(row.is_valid);
  return String(row.is_valid_value);
}
