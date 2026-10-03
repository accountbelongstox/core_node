import { BaseAPI } from './transport/BaseAPI';
import {
  createFixedLaravelModuleConfig,
  LARAVEL_API_PREFIX,
  LARAVEL_API_ROUTE,
} from './transport/ApiContract';
import type { APIResponse } from './transport/TransportTypes';
import {
  authNamespaceOf,
  clearAuthSession,
  getAuthHeader,
  setAuthToken,
  setAuthUser,
} from '../../auth/AuthSession';
import { normalizeLaravelUser, type LaravelSessionUser } from '../../auth/LaravelUser';

export const AUTH_INVALID_RESPONSE_CODE = 'AUTH_INVALID_RESPONSE';

export interface LaravelCredentials {
  username: string;
  password: string;
}

export interface LaravelRegistration extends LaravelCredentials {
  email?: string;
  nickname?: string;
  registrationCode?: string;
}

export interface LaravelPublicInviteCode {
  id: number | string;
  code: string;
  is_active: boolean;
  used_count: number;
  max_uses: number;
}

/** A login/register refusal; `errorCode` is the server's `error_code` (localized by the login UI). */
export class LaravelAuthError extends Error {
  readonly errorCode?: string;
  readonly status: number;

  constructor(message: string, status: number, errorCode?: string) {
    super(message);
    this.name = 'LaravelAuthError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

const clients = new Map<string, BaseAPI>();

/** The fixed-endpoint transport of one Laravel API; it only ever carries that API's own token. */
function clientFor(baseUrl: string): BaseAPI {
  const namespace = authNamespaceOf(baseUrl);
  const cached = clients.get(namespace);
  if (cached) return cached;
  const client = new BaseAPI({
    ...createFixedLaravelModuleConfig(LARAVEL_API_PREFIX.common, baseUrl.trim().replace(/\/+$/, '')),
    authToken: () => getAuthHeader(namespace),
    onUnauthorized: () => undefined,
  });
  clients.set(namespace, client);
  return client;
}

function failure(response: APIResponse): LaravelAuthError {
  return new LaravelAuthError(response.error ?? '', response.status, response.debugInfo?.error_code);
}

async function establishSession(baseUrl: string, response: APIResponse): Promise<LaravelSessionUser> {
  if (!response.success) throw failure(response);
  const body = response.data as { data?: { token?: unknown } } | { token?: unknown } | null;
  const payload = (body && 'data' in body && body.data ? body.data : body) as { token?: unknown } | null;
  const token = typeof payload?.token === 'string' && payload.token !== '' ? payload.token : null;
  const user = normalizeLaravelUser(payload);
  if (!token || !user) throw new LaravelAuthError('', response.status, AUTH_INVALID_RESPONSE_CODE);
  setAuthToken(token, baseUrl);
  setAuthUser({ ...user }, baseUrl);
  return (await refreshLaravelSession(baseUrl)) ?? user;
}

export async function loginLaravel(baseUrl: string, credentials: LaravelCredentials): Promise<LaravelSessionUser> {
  return establishSession(baseUrl, await clientFor(baseUrl).post(LARAVEL_API_ROUTE.auth.login, credentials));
}

export async function registerLaravel(baseUrl: string, registration: LaravelRegistration): Promise<LaravelSessionUser> {
  const response = await clientFor(baseUrl).post(LARAVEL_API_ROUTE.auth.register, {
    username: registration.username,
    password: registration.password,
    email: registration.email,
    nickname: registration.nickname,
    name: registration.nickname,
    registration_code: registration.registrationCode,
  });
  return establishSession(baseUrl, response);
}

/** Re-read the signed-in user; a refused token (401) ends that API's session. */
export async function refreshLaravelSession(baseUrl: string): Promise<LaravelSessionUser | null> {
  const response = await clientFor(baseUrl).get(LARAVEL_API_ROUTE.auth.profile);
  if (response.status === 401) {
    clearAuthSession(baseUrl);
    return null;
  }
  const user = response.success ? normalizeLaravelUser(response.data) : null;
  if (user) setAuthUser({ ...user }, baseUrl);
  return user;
}

/** Sign out of one Laravel API only; the server call is best effort, the local session always ends. */
export async function logoutLaravel(baseUrl: string): Promise<void> {
  try {
    await clientFor(baseUrl).post(LARAVEL_API_ROUTE.auth.logout);
  } catch (error) {
    console.warn('Laravel logout request failed:', error);
  } finally {
    clearAuthSession(baseUrl);
  }
}

export async function listLaravelInviteCodes(baseUrl: string): Promise<LaravelPublicInviteCode[]> {
  const response = await clientFor(baseUrl).get<LaravelPublicInviteCode[]>(LARAVEL_API_ROUTE.inviteCodes.public);
  return Array.isArray(response.data) ? response.data : [];
}
