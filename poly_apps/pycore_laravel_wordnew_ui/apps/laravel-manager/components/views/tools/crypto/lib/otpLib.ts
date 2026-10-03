/** HOTP (RFC 4226) and TOTP (RFC 6238) generation, verification and otpauth URIs in the browser. */
import { fromBase32, hmac, randomBytes, toBase32 } from './cryptoCore';

export type OtpKind = 'totp' | 'hotp';
export type OtpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export interface OtpParams {
  kind: OtpKind;
  secret: string;
  algorithm: OtpAlgorithm;
  digits: number;
  period: number;
  counter: number;
}

export interface OtpUriFields {
  issuer: string;
  account: string;
}

export interface OtpVerification {
  valid: boolean;
  drift: number | null;
}

const URI_ALGORITHM: Record<OtpAlgorithm, string> = { 'SHA-1': 'SHA1', 'SHA-256': 'SHA256', 'SHA-512': 'SHA512' };
const URI_ALGORITHM_REVERSE: Record<string, OtpAlgorithm> = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512' };
const SECRET_BYTES = 20;

export const OTP_ALGORITHMS: readonly OtpAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-512'];
export const OTP_DIGITS: readonly number[] = [6, 7, 8];
export const OTP_PERIODS: readonly number[] = [15, 30, 60];
export const DEFAULT_OTP_PARAMS: OtpParams = { kind: 'totp', secret: '', algorithm: 'SHA-1', digits: 6, period: 30, counter: 0 };

export const randomOtpSecret = (): string => toBase32(randomBytes(SECRET_BYTES));

export const isValidOtpSecret = (secret: string): boolean => fromBase32(secret) !== null;

export const groupOtpSecret = (secret: string): string => secret.replace(/[\s-]/g, '').replace(/(.{4})/g, '$1 ').trim();

export const hotp = async (secret: Uint8Array, counter: number, algorithm: OtpAlgorithm, digits: number): Promise<string> => {
  const message = new Uint8Array(8);
  new DataView(message.buffer).setBigUint64(0, BigInt(counter));
  const mac = await hmac(algorithm, secret, message);
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
};

export const totpCounter = (params: OtpParams, nowMs: number): number => Math.floor(nowMs / 1000 / params.period);

export const otpAt = async (params: OtpParams, nowMs: number): Promise<string | null> => {
  const secret = fromBase32(params.secret);
  if (!secret) return null;
  const counter = params.kind === 'totp' ? totpCounter(params, nowMs) : params.counter;
  return hotp(secret, counter, params.algorithm, params.digits);
};

export const secondsLeft = (period: number, nowMs: number): number => period - ((nowMs / 1000) % period);

/** Checks a code inside +-window steps (TOTP periods or HOTP counters) and reports the drift of the match. */
export const verifyOtp = async (params: OtpParams, code: string, window: number, nowMs: number): Promise<OtpVerification> => {
  const secret = fromBase32(params.secret);
  const candidate = code.replace(/\s/g, '');
  if (!secret || !candidate) return { valid: false, drift: null };
  const base = params.kind === 'totp' ? totpCounter(params, nowMs) : params.counter;
  for (let drift = 0; drift <= window; drift++) {
    for (const signed of drift === 0 ? [0] : [-drift, drift]) {
      if (base + signed < 0) continue;
      if (await hotp(secret, base + signed, params.algorithm, params.digits) === candidate) return { valid: true, drift: signed };
    }
  }
  return { valid: false, drift: null };
};

export const buildOtpUri = (params: OtpParams, fields: OtpUriFields): string => {
  const label = fields.issuer ? `${encodeURIComponent(fields.issuer)}:${encodeURIComponent(fields.account)}` : encodeURIComponent(fields.account);
  const query = new URLSearchParams({ secret: params.secret.replace(/[\s=-]/g, '').toUpperCase() });
  if (fields.issuer) query.set('issuer', fields.issuer);
  query.set('algorithm', URI_ALGORITHM[params.algorithm]);
  query.set('digits', String(params.digits));
  if (params.kind === 'totp') query.set('period', String(params.period));
  else query.set('counter', String(params.counter));
  return `otpauth://${params.kind}/${label}?${query.toString()}`;
};

/** Reads an otpauth:// URI back into parameters and label fields; null when it is not one. */
export const parseOtpUri = (uri: string): { params: OtpParams; fields: OtpUriFields } | null => {
  try {
    const url = new URL(uri.trim());
    const kind = url.hostname as OtpKind;
    if (url.protocol !== 'otpauth:' || (kind !== 'totp' && kind !== 'hotp')) return null;
    const label = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const [labelIssuer, labelAccount] = label.includes(':') ? [label.slice(0, label.indexOf(':')), label.slice(label.indexOf(':') + 1)] : ['', label];
    const query = url.searchParams;
    const digits = Number(query.get('digits') ?? DEFAULT_OTP_PARAMS.digits);
    const period = Number(query.get('period') ?? DEFAULT_OTP_PARAMS.period);
    const counter = Number(query.get('counter') ?? 0);
    return {
      params: {
        kind,
        secret: (query.get('secret') ?? '').toUpperCase(),
        algorithm: URI_ALGORITHM_REVERSE[(query.get('algorithm') ?? 'SHA1').toUpperCase()] ?? 'SHA-1',
        digits: OTP_DIGITS.includes(digits) ? digits : DEFAULT_OTP_PARAMS.digits,
        period: Number.isFinite(period) && period > 0 ? period : DEFAULT_OTP_PARAMS.period,
        counter: Number.isInteger(counter) && counter >= 0 ? counter : 0,
      },
      fields: { issuer: query.get('issuer') ?? labelIssuer, account: labelAccount.trim() },
    };
  } catch {
    return null;
  }
};
