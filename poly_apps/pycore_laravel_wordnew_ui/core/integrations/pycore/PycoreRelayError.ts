import i18n from '../../i18n/UiI18n';
import { RELAY_CONTRACT } from '../../contracts/RelayContract';

export type PycoreRelayErrorKind =
  | 'not-paired' | 'peer-offline' | 'device-offline' | 'device-overloaded' | 'rate-limited' | 'request-timeout' | 'too-large' | 'http';

const COMMON_KEY_PREFIX = 'common.relay_';
const BYTES_PER_MIB = 1024 * 1024;

/** Relay failure code -> `common.relay_<suffix>` text key; one table for every relay failure the UI raises. */
const RELAY_ERROR_TEXT_SUFFIX: Readonly<Record<string, string>> = {
  RELAY_DEVICE_OFFLINE: 'device_offline',
  RELAY_DEVICE_UNAVAILABLE: 'device_unavailable',
  RELAY_DEVICE_OVERLOADED: 'device_overloaded',
  RELAY_RATE_LIMITED: 'rate_limited',
  RELAY_OPERATION_TIMEOUT: 'operation_timeout',
  RELAY_REQUEST_BODY_TOO_LARGE: 'body_too_large',
  RELAY_REQUEST_FRAME_TOO_LARGE: 'frame_too_large',
  RELAY_FRAME_INVALID: 'frame_invalid',
  RELAY_RESPONSE_DIGEST_CONFLICT: 'frame_invalid',
  RELAY_BODY_TYPE_UNSUPPORTED: 'body_unsupported',
  RELAY_AUTHENTICATION_REQUIRED: 'authentication_required',
  RELAY_DEVICE_NOT_GRANTED: 'not_ready',
  RELAY_STREAM_UNAVAILABLE: 'not_ready',
  RELAY_GRANT_BACKOFF: 'not_ready',
  RELAY_GRANT_UNAVAILABLE: 'not_ready',
  RELAY_ROUTE_DENIED: 'route_denied',
};

/** Localized text of one relay failure code; the code itself when it has no text. */
export function relayErrorText(code: string): string {
  const suffix = RELAY_ERROR_TEXT_SUFFIX[code];
  if (!suffix) return code;
  return String(i18n.t(`${COMMON_KEY_PREFIX}${suffix}`, { max_mib: Math.round(RELAY_CONTRACT.limits.request_body_bytes / BYTES_PER_MIB) }));
}

export class PycoreRelayError extends Error {
  readonly kind: PycoreRelayErrorKind;
  readonly status: number;
  readonly code: string;

  constructor(kind: PycoreRelayErrorKind, code: string, status = 0) {
    super(relayErrorText(code));
    this.name = 'PycoreRelayError';
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

export function isPycoreRelayError(error: unknown): error is PycoreRelayError {
  return !!error && (error as PycoreRelayError).name === 'PycoreRelayError';
}
