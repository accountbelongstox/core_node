// Super code: offline, login-free unlock issued by the DingDuoDuoV1 backend.
//
// Format: DDK2.<payload>.<signature>
//   payload   = base64url(JSON { v, device, exp, iat, tier, features, maxBinds })
//   signature = base64url(Ed25519 over the ASCII text "DDK2.<payload>")
// Only the backend holds the private key; the extension ships the public key
// (config/service_contract.json#dingdoudou.super_code_public_key). A code is valid
// only for the device id it names and only until `exp` (unix seconds).

import { dingdoudou } from '../../../config/service_contract.json';
import type { LicenseState } from './types';

interface SuperCodeContract {
  super_code_format?: string;
  super_code_public_key?: string;
}

export interface SuperCodeClaims {
  v: number;
  device: string;
  exp: number;
  iat?: number;
  tier?: string;
  features?: string[];
  maxBinds?: number;
}

const SUPER_CODE_CONTRACT: SuperCodeContract = dingdoudou || {};
const SUPER_CODE_PREFIX = SUPER_CODE_CONTRACT.super_code_format || '';
const SUPER_CODE_VERSION = 2;
const SUPER_CODE_SEPARATOR = '.';
const SUPER_CODE_ALGORITHM = 'Ed25519';
const MS_PER_SECOND = 1000;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
const DEFAULT_TIER = 'unlimited';
const DEFAULT_FEATURES = ['*'];
const SUPER_CODE_PUBLIC_KEY = SUPER_CODE_CONTRACT.super_code_public_key || '';

export const SUPER_CODE_PLACEHOLDER = `${SUPER_CODE_PREFIX}${SUPER_CODE_SEPARATOR}…`;

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!value || !BASE64URL_RE.test(value)) return null;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function parseClaims(bytes: Uint8Array): SuperCodeClaims | null {
  try {
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as SuperCodeClaims;
    return claims && typeof claims === 'object' ? claims : null;
  } catch {
    return null;
  }
}

// Verify a super code against this device; returns its claims or null.
export async function verifySuperCode(raw: string, deviceId: string): Promise<SuperCodeClaims | null> {
  const parts = (raw || '').trim().split(SUPER_CODE_SEPARATOR);
  if (parts.length !== 3 || !SUPER_CODE_PREFIX || parts[0] !== SUPER_CODE_PREFIX || !deviceId) return null;

  const publicKey = base64UrlToBytes(SUPER_CODE_PUBLIC_KEY);
  const payload = base64UrlToBytes(parts[1]);
  const signature = base64UrlToBytes(parts[2]);
  if (!publicKey || !payload || !signature) return null;

  try {
    const key = await crypto.subtle.importKey('raw', publicKey, { name: SUPER_CODE_ALGORITHM }, false, ['verify']);
    const signed = new TextEncoder().encode(`${parts[0]}${SUPER_CODE_SEPARATOR}${parts[1]}`);
    if (!(await crypto.subtle.verify({ name: SUPER_CODE_ALGORITHM }, key, signature, signed))) return null;
  } catch {
    return null;
  }

  const claims = parseClaims(payload);
  if (!claims || claims.v !== SUPER_CODE_VERSION || claims.device !== deviceId) return null;
  if (!Number.isFinite(claims.exp) || claims.exp * MS_PER_SECOND <= Date.now()) return null;
  return claims;
}

// Build the LicenseState a verified super code grants: its tier and features until it expires.
export function superLicense(raw: string, claims: SuperCodeClaims): LicenseState {
  return {
    mode: 'super',
    code: raw.trim(),
    tier: claims.tier || DEFAULT_TIER,
    features: Array.isArray(claims.features) && claims.features.length ? claims.features : DEFAULT_FEATURES,
    maxBinds: Number.isInteger(claims.maxBinds) ? Number(claims.maxBinds) : Number.MAX_SAFE_INTEGER,
    expiresAt: claims.exp * MS_PER_SECOND,
    verifiedAt: Date.now(),
    offline: true,
  };
}

// A locked license: no super-code, backend unreachable / no membership.
export function lockedLicense(): LicenseState {
  return {
    mode: 'locked',
    tier: 'free',
    features: [],
    maxBinds: 0,
    expiresAt: null,
    verifiedAt: Date.now(),
    offline: true,
  };
}

export function hasFeature(license: LicenseState | null, feature: string): boolean {
  if (!license) return false;
  if (license.mode === 'locked') return false;
  if (license.features.includes('*')) return true;
  return license.features.includes(feature);
}

export function isLicenseActive(license: LicenseState | null): boolean {
  if (!license) return false;
  if (license.mode === 'locked') return false;
  if (license.expiresAt && Date.now() > license.expiresAt) return false;
  return true;
}
