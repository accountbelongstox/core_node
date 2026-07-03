// 超级码 (Super-code) — offline, login-free, full-permission unlock.
//
// A valid super-code grants the extension full access with NO backend and NO login.
// It can manage unlimited bound Pinduoduo users (cross-user management).
//
// Two ways a code can be valid:
//   1. It is one of the built-in MASTER_CODES (always valid, offline).
//   2. It matches the signed format  DDK-<BASE>-<SIG>  where
//        SIG = last 6 hex chars of FNV-1a-32(BASE_UPPER + SUPER_SALT), upper-cased.
//
// The Laravel backend (DingDuoDuoV1) mints codes with the SAME algorithm + salt so
// an admin can issue new super-codes that verify fully offline inside the extension.
// IMPORTANT: keep SUPER_SALT identical to the PHP side (DingDuoDuoV1SuperCodeService).

import type { LicenseState } from './types';

export const SUPER_SALT = 'dingduoduo::supercode::v1';

// Built-in master codes. Always valid, offline, unlimited.
export const MASTER_CODES: ReadonlySet<string> = new Set([
  'DDK-MASTER-0000',
  'DINGDUODUO-VIP',
  'DDK-SUPER-FOREVER',
]);

// FNV-1a 32-bit hash (must match the PHP implementation exactly).
function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function signatureFor(base: string): string {
  const hex = fnv1a32(base.toUpperCase() + SUPER_SALT)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase();
  return hex.slice(-6);
}

// Mint a signed super-code from an arbitrary base label (A-Z0-9, <=12 chars).
export function mintSuperCode(base: string): string {
  const b = base.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'CODE';
  return `DDK-${b}-${signatureFor(b)}`;
}

const SIGNED_RE = /^DDK-([A-Z0-9]{1,12})-([0-9A-F]{6})$/;

export function verifySuperCode(raw: string): boolean {
  const code = (raw || '').trim().toUpperCase();
  if (!code) return false;
  if (MASTER_CODES.has(code)) return true;
  const m = code.match(SIGNED_RE);
  if (!m) return false;
  return signatureFor(m[1]) === m[2];
}

// Build the LicenseState a verified super-code yields: everything, forever, offline.
export function superLicense(raw: string): LicenseState {
  return {
    mode: 'super',
    code: raw.trim().toUpperCase(),
    tier: 'unlimited',
    features: ['*'],
    maxBinds: Number.MAX_SAFE_INTEGER,
    expiresAt: null,
    label: '超级码 · 全功能离线版',
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
