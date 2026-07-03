// Backend client — used ONLY when there is no super-code. Talks to the Laravel
// DingDuoDuoV1 sub-app for member login + license verification.
//
// Base routes (Laravel): /api/ding_duo_duo_v1/...
//   POST license/verify     { device_id, token? }  -> license payload
//   POST license/heartbeat  { device_id, token }   -> refreshed license
//   POST member/login       { username, password, device_id } -> { token, member }
//   GET  recharge/packages                          -> packages[]
//   POST recharge/create    { token, package_id }   -> { pay_url }

import type { BackendConfig, LicenseState } from './types';

interface BackendLicenseDTO {
  mode?: 'member' | 'locked';
  tier?: string;
  features?: string[];
  max_binds?: number;
  expires_at?: number | string | null;
  label?: string;
  token?: string;
}

function toLicense(dto: BackendLicenseDTO, token?: string): LicenseState {
  let expiresAt: number | null = null;
  if (dto.expires_at != null) {
    const n = typeof dto.expires_at === 'number' ? dto.expires_at : Date.parse(String(dto.expires_at));
    expiresAt = Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : null;
  }
  return {
    mode: dto.mode === 'locked' ? 'locked' : 'member',
    token: token ?? dto.token,
    tier: dto.tier ?? 'free',
    features: dto.features ?? [],
    maxBinds: dto.max_binds ?? 1,
    expiresAt,
    label: dto.label,
    verifiedAt: Date.now(),
    offline: false,
  };
}

async function call<T>(cfg: BackendConfig, path: string, body?: unknown): Promise<T> {
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/api/ding_duo_duo_v1/${path}`;
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(cfg.memberToken ? { 'X-DD-Token': cfg.memberToken } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`backend ${path} HTTP ${res.status}`);
  const json = await res.json();
  if (json && json.success === false) throw new Error(json.message || `backend ${path} failed`);
  return (json?.data ?? json) as T;
}

export async function memberLogin(
  cfg: BackendConfig,
  username: string,
  password: string,
): Promise<LicenseState> {
  const data = await call<{ token: string; member: BackendLicenseDTO }>(cfg, 'member/login', {
    username,
    password,
    device_id: cfg.deviceId,
  });
  return toLicense(data.member ?? {}, data.token);
}

export async function verifyLicense(cfg: BackendConfig): Promise<LicenseState> {
  const data = await call<BackendLicenseDTO>(cfg, 'license/verify', {
    device_id: cfg.deviceId,
    token: cfg.memberToken,
  });
  return toLicense(data, cfg.memberToken);
}

export async function heartbeat(cfg: BackendConfig): Promise<LicenseState> {
  const data = await call<BackendLicenseDTO>(cfg, 'license/heartbeat', {
    device_id: cfg.deviceId,
    token: cfg.memberToken,
  });
  return toLicense(data, cfg.memberToken);
}
