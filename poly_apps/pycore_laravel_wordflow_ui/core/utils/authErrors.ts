import i18n from '../i18n';
import type { Language } from '../../types';

/** Auth error codes returned by backend login/register (must match App\\Constants\\AuthErrorCodes). */
export const AUTH_ERROR_CODES = {
  AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
  AUTH_INVALID_PASSWORD: 'AUTH_INVALID_PASSWORD',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_VALIDATION_FAILED: 'AUTH_VALIDATION_FAILED',
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERROR_CODES;

/**
 * Resolve auth error message from backend error_code and current language.
 * Uses central i18n layer (no language branching).
 */
export function getAuthErrorMessage(
  errorCode: string | undefined,
  fallback: string,
  lang: Language
): string {
  if (!errorCode) return fallback;
  const key = `login.errors.${errorCode}`;
  const msg = i18n.t(key, { lng: lang });
  if (msg !== key) return msg;
  const defaultMsg = i18n.t('login.errors.default', { lng: lang });
  return defaultMsg !== 'login.errors.default' ? defaultMsg : fallback;
}
