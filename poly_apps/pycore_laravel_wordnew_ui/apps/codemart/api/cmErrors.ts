import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';

type CmTranslate = (key: string, options?: Record<string, unknown>) => string;

/** Server error_code of a failed response, when the backend returned one. */
export function cmErrorCode(response: APIResponse<unknown>): string | null {
  const code = response.debugInfo?.error_code;
  return typeof code === 'string' && code ? code : null;
}

/**
 * Localized message for a failed CodeMart response: the `errors.<code>` key
 * when the server returned a known error_code, otherwise the caller fallback.
 */
export function cmErrorMessage(t: CmTranslate, response: APIResponse<unknown>, fallbackKey: string): string {
  const code = cmErrorCode(response);
  if (code) {
    const key = `errors.${code}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
  }
  return t(fallbackKey);
}
