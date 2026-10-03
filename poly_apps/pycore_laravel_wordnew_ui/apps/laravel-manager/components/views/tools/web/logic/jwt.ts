/** JWT decoding, claim timing and signature verification through Web Crypto. */
import type { JsonValue } from './json';

export type JwtErrorCode = 'format' | 'header_invalid' | 'payload_invalid';

export interface DecodedJwt {
  parts: [string, string, string];
  header: { [key: string]: JsonValue };
  payload: { [key: string]: JsonValue };
  alg: string;
}

export type JwtDecodeResult = { ok: true; jwt: DecodedJwt } | { ok: false; code: JwtErrorCode };

export type JwtTimeStatus = 'valid' | 'expired' | 'not_yet_valid' | 'no_expiry';

export interface JwtTiming {
  status: JwtTimeStatus;
  /** Milliseconds until expiry (negative once expired). */
  expiresInMs: number | null;
  /** Milliseconds until nbf (positive while the token is not yet valid). */
  notBeforeInMs: number | null;
}

export type JwtVerifyResult = 'valid' | 'invalid' | 'key_format' | 'unsupported_alg' | 'none_alg' | 'no_crypto';

export const JWT_TIME_CLAIMS = ['exp', 'iat', 'nbf'] as const;

const HASH_BY_BITS: Record<string, string> = { '256': 'SHA-256', '384': 'SHA-384', '512': 'SHA-512' };
const CURVE_BY_BITS: Record<string, string> = { '256': 'P-256', '384': 'P-384', '512': 'P-521' };
const BEARER = /^bearer\s+/i;

const base64UrlBytes = (segment: string): Uint8Array => {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const decodeSegment = (segment: string): { [key: string]: JsonValue } | null => {
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(base64UrlBytes(segment))) as JsonValue;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

export const normalizeToken = (raw: string): string => raw.trim().replace(BEARER, '').replace(/\s+/g, '');

export function decodeJwt(raw: string): JwtDecodeResult {
  const parts = normalizeToken(raw).split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1]) return { ok: false, code: 'format' };
  const header = decodeSegment(parts[0]);
  if (!header) return { ok: false, code: 'header_invalid' };
  const payload = decodeSegment(parts[1]);
  if (!payload) return { ok: false, code: 'payload_invalid' };
  return { ok: true, jwt: { parts: [parts[0], parts[1], parts[2]], header, payload, alg: typeof header.alg === 'string' ? header.alg : '' } };
}

export const claimSeconds = (payload: { [key: string]: JsonValue }, claim: string): number | null => {
  const value = payload[claim];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

export function jwtTiming(payload: { [key: string]: JsonValue }, nowMs: number): JwtTiming {
  const exp = claimSeconds(payload, 'exp');
  const nbf = claimSeconds(payload, 'nbf');
  const expiresInMs = exp === null ? null : exp * 1000 - nowMs;
  const notBeforeInMs = nbf === null ? null : nbf * 1000 - nowMs;
  const status: JwtTimeStatus = expiresInMs !== null && expiresInMs <= 0 ? 'expired'
    : notBeforeInMs !== null && notBeforeInMs > 0 ? 'not_yet_valid'
      : expiresInMs === null ? 'no_expiry' : 'valid';
  return { status, expiresInMs, notBeforeInMs };
}

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export const durationParts = (ms: number): DurationParts => {
  let rest = Math.floor(Math.abs(ms) / 1000);
  const days = Math.floor(rest / 86400);
  rest -= days * 86400;
  const hours = Math.floor(rest / 3600);
  rest -= hours * 3600;
  const minutes = Math.floor(rest / 60);
  return { days, hours, minutes, seconds: rest - minutes * 60 };
};

const toBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const pemToDer = (pem: string): ArrayBuffer | null => {
  const body = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
  if (!body || !/^[A-Za-z0-9+/=]+$/.test(body)) return null;
  return toBuffer(Uint8Array.from(atob(body), (char) => char.charCodeAt(0)));
};

/** Verifies HS*, RS*, PS* and ES* tokens; `key` is a shared secret (HS*), a SPKI PEM, or a JWK JSON for any family. */
export async function verifyJwt(parts: [string, string, string], alg: string, key: string): Promise<JwtVerifyResult> {
  if (alg.toLowerCase() === 'none') return 'none_alg';
  if (!globalThis.crypto?.subtle) return 'no_crypto';
  const family = alg.slice(0, 2);
  const bits = alg.slice(2);
  const hash = HASH_BY_BITS[bits];
  if (!['HS', 'RS', 'PS', 'ES'].includes(family) || !hash) return 'unsupported_alg';
  if (!key.trim()) return 'key_format';
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  let signature: Uint8Array;
  try {
    signature = base64UrlBytes(parts[2]);
  } catch {
    return 'invalid';
  }
  const subtle = globalThis.crypto.subtle;
  try {
    const trimmed = key.trim();
    const isJwk = trimmed.startsWith('{');
    if (family === 'HS') {
      const algorithm = { name: 'HMAC', hash };
      const material = isJwk
        ? await subtle.importKey('jwk', JSON.parse(trimmed) as JsonWebKey, algorithm, false, ['verify'])
        : await subtle.importKey('raw', new TextEncoder().encode(key), algorithm, false, ['verify']);
      return (await subtle.verify('HMAC', material, toBuffer(signature), data)) ? 'valid' : 'invalid';
    }
    const algorithm = family === 'ES' ? { name: 'ECDSA', namedCurve: CURVE_BY_BITS[bits] }
      : family === 'PS' ? { name: 'RSA-PSS', hash } : { name: 'RSASSA-PKCS1-v1_5', hash };
    let material: CryptoKey;
    if (isJwk) {
      material = await subtle.importKey('jwk', JSON.parse(trimmed) as JsonWebKey, algorithm, false, ['verify']);
    } else {
      const der = pemToDer(trimmed);
      if (!der) return 'key_format';
      material = await subtle.importKey('spki', der, algorithm, false, ['verify']);
    }
    const verifyAlgorithm = family === 'ES' ? { name: 'ECDSA', hash }
      : family === 'PS' ? { name: 'RSA-PSS', saltLength: Number(bits) / 8 } : { name: 'RSASSA-PKCS1-v1_5' };
    return (await subtle.verify(verifyAlgorithm, material, toBuffer(signature), data)) ? 'valid' : 'invalid';
  } catch {
    return 'key_format';
  }
}
