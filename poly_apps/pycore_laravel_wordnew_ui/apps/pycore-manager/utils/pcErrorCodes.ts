/**
 * Stable pycore error codes -> localized messages (pc namespace `errorCodes`).
 *
 * Pycore returns/persists `error_code` (+ a short diagnostic `detail`) for
 * every UI-facing failure; raw upstream exception text is never shown.
 */
import i18n from '../../../core/i18n/UiI18n';

const LARAVEL_LOGIN_STATUS = 401;
const LARAVEL_LOGIN_REQUIRED_CODE = 'LARAVEL_LOGIN_REQUIRED';
const LARAVEL_REQUEST_FAILED_CODE = 'LARAVEL_REQUEST_FAILED';

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

/**
 * Localized text for a failed browser call to a Laravel operator route
 * (`dashboard.auth` / `client.key_or_dashboard`). The shared Laravel transport
 * already opens the login window on 401 and localizes 403.
 */
export function pcLaravelErrorMessage(error: unknown, fallback?: string): string {
  const status = Number((error as { status?: unknown } | null)?.status);
  const fallbackText = fallback || pcErrorCodeMessage(LARAVEL_REQUEST_FAILED_CODE) || '';
  if (status === LARAVEL_LOGIN_STATUS) return pcErrorCodeMessage(LARAVEL_LOGIN_REQUIRED_CODE) || fallbackText;
  return error instanceof Error && error.message ? error.message : fallbackText;
}
