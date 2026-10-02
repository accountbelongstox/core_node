/** A 401 caused by the client-key signature (not by a missing login): the login window cannot fix it. */
import i18n from '../../i18n/UiI18n';
import { CLIENT_KEY_ERROR_CODES } from '../../contracts/ServiceContract';

const COMMON_NAMESPACE_PREFIX = 'common.';

/** The contract `client_key_*` code of a Laravel error body, else null. */
export function clientKeyFailureCode(body: unknown): string | null {
  const code = (body as { error_code?: unknown } | null)?.error_code;
  return typeof code === 'string' && CLIENT_KEY_ERROR_CODES.includes(code) ? code : null;
}

/** Localized text of one shared `common` message (for example `upload_failed`). */
export function commonMessage(key: string): string {
  return String(i18n.t(`${COMMON_NAMESPACE_PREFIX}${key}`));
}

/** Localized text of one client-key rejection. */
export function clientKeyFailureMessage(code: string): string {
  return commonMessage(code);
}
