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
import { errorText } from './value';
import { normalizeBackendUrl } from './backendUrl';

interface BackendLicenseDTO {
  mode?: 'member' | 'locked';
  tier?: string;
  features?: string[];
  permissions?: string[];
  max_binds?: number;
  expires_at?: number | string | null;
  label?: string;
  remark?: string;
  username?: string;
  token?: string;
}

const REQUEST_TIMEOUT_MS = 15_000;

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
    features: dto.features ?? dto.permissions ?? [],
    maxBinds: dto.max_binds ?? 1,
    expiresAt,
    label: dto.label ?? dto.remark ?? dto.username,
    verifiedAt: Date.now(),
    offline: false,
  };
}

async function call<T>(cfg: BackendConfig, path: string, body?: unknown): Promise<T> {
  const url = `${normalizeBackendUrl(cfg.baseUrl)}/api/ding_duo_duo_v1/${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(cfg.memberToken ? { 'X-DD-Token': cfg.memberToken } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(errorText(json, `后台请求失败（HTTP ${res.status}）`));
    }
    if (json && typeof json === 'object' && 'success' in json && json.success === false) {
      throw new Error(errorText(json, `后台请求 ${path} 失败`));
    }
    if (json && typeof json === 'object' && 'data' in json) {
      return (json as { data: T }).data;
    }
    return json as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('后台连接超时');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
