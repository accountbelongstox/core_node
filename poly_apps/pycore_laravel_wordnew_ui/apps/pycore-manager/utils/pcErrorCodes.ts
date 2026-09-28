/**
 * Stable pycore codes -> localized messages (pc namespace).
 *
 * Pycore returns/persists `error_code` (+ a short diagnostic `detail`) for
 * every UI-facing failure, and coded status lines (`<name>_code` +
 * `<name>_params`); the UI localizes by code, and raw upstream exception or
 * JS error text is never shown.
 */
import i18n from '../../../core/i18n/UiI18n';

const LARAVEL_LOGIN_STATUS = 401;
const LARAVEL_LOGIN_REQUIRED_CODE = 'LARAVEL_LOGIN_REQUIRED';
const LARAVEL_REQUEST_FAILED_CODE = 'LARAVEL_REQUEST_FAILED';
const PC_NAMESPACE = 'pc';
const ERROR_CODE_PREFIX = 'errorCodes';
const GENERIC_FAILURE_KEY = 'common.requestFailed';
const TTS_REASON_PREFIX = 'ttsReasons';

/** UI-side code of a failed pycore call that carries no pycore code (network, timeout). */
export const PC_REQUEST_FAILED_CODE = 'PYCORE_REQUEST_FAILED';

export type PcCodeParams = Record<string, unknown> | null | undefined;

/** Failure fields of a pycore answer or record; older routes put the code in `error`. */
export interface PcFailureFields {
  error_code?: string | null;
  error?: unknown;
  detail?: string | null;
}

/** An error whose message is already localized UI text (safe to render as is). */
export class PcLocalizedError extends Error {}

/** Localized `<prefix>.<code>` with its params, or null when the code has no key. */
export function pcCodeText(prefix: string, code: unknown, params?: PcCodeParams): string | null {
  if (typeof code !== 'string' || !code) return null;
  const key = `${prefix}.${code}`;
  if (!i18n.exists(key, { ns: PC_NAMESPACE })) return null;
  return String(i18n.t(key, { ns: PC_NAMESPACE, ...(params || {}) }));
}

export function pcErrorCodeMessage(code?: string | null, detail?: string | null): string | null {
  return pcCodeText(ERROR_CODE_PREFIX, code, { detail: detail || '' });
}

export function pcGenericFailureMessage(): string {
  return String(i18n.t(GENERIC_FAILURE_KEY, { ns: PC_NAMESPACE }));
}

/** Localized text of one error code; a missing or unknown code gets the generic localized failure. */
export function pcErrorCodeText(code?: string | null, detail?: string | null): string {
  return pcErrorCodeMessage(code, detail) || pcGenericFailureMessage();
}

/** The pycore code of a failure: `error_code`, else a string `error`. */
export function pcFailureCode(failure: PcFailureFields | null | undefined): string | null {
  if (failure?.error_code) return failure.error_code;
  return typeof failure?.error === 'string' && failure.error ? failure.error : null;
}

/** Localized message of a failure record or answer (by code only), else the fallback. */
export function pcFailureMessage(
  failure: PcFailureFields | null | undefined,
  fallback: string = pcGenericFailureMessage(),
): string {
  return pcErrorCodeMessage(failure?.error_code, failure?.detail)
    || pcErrorCodeMessage(typeof failure?.error === 'string' ? failure.error : null)
    || fallback;
}

/**
 * Localized TTS engine availability reason (pycore `tts_reason_codes`:
 * `disabled_reason_code` / `error_code` + params). The fallback is pycore's
 * English rendering of the same reason, for rows without a code.
 */
export function pcTtsReasonText(code: string | null | undefined, params: PcCodeParams, fallback?: string | null): string {
  return pcCodeText(TTS_REASON_PREFIX, code, params) || fallback || '';
}

/** Renderable text of a caught error: a PcLocalizedError's own text, else the localized fallback. */
export function pcCaughtErrorMessage(error: unknown, fallback: string = pcGenericFailureMessage()): string {
  return error instanceof PcLocalizedError && error.message ? error.message : fallback;
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
