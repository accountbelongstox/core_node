/**
 * Stable pycore error codes -> localized messages (pc namespace `errorCodes`).
 *
 * Pycore returns/persists `error_code` (+ a short diagnostic `detail`) for
 * every UI-facing failure; raw upstream exception text is never shown.
 */
import i18n from '../../../core/i18n/UiI18n';

export function pcErrorCodeMessage(code?: string | null, detail?: string | null): string | null {
  if (!code) return null;
  const key = `errorCodes.${code}`;
  if (!i18n.exists(key, { ns: 'pc' })) return null;
  return String(i18n.t(key, { ns: 'pc', detail: detail || '' }));
}

/** Localized message for a failure record `{error_code, detail}`, else the fallback. */
export function pcFailureMessage(
  failure: { error_code?: string | null; detail?: string | null } | null | undefined,
  fallback: string,
): string {
  return pcErrorCodeMessage(failure?.error_code, failure?.detail) || fallback;
}
