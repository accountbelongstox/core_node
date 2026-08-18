/** WfNewApiTransport - shared transport core (token state, fetch helpers,
 * auth-expiry self-heal, envelope unwrap) extracted from WfNewApiHttp so the http
 * impl + method modules stay under the 800-line modular limit. authToken /
 * authExpiredSubs are live bindings so the composer's isAuthenticated/onAuthExpired
 * reflect token changes. */
import { wfNewEndpoints, WORDNEW_API_HEALTH_EVENT } from './WfNewEndpoints';
import { MasterApiClient } from '../../../core/network/api-client';
import {
  mirrorServerResponse,
  queryServerResource,
  requestVariant,
} from '../runtime-store/WfNewServerMirror';
import type { WfNewAuthResult, WfNewAuthUser } from './WfNewApiTypes';
import { WordNewStorageKeys as StorageKeys } from '../persistence/WordNewStorageKeys';
import { coordinateRequest } from '../../../core/network/RequestCoordinator';
import { unwrapLaravelData } from '../../../core/integrations/laravel/transport/LaravelEnvelope';
import { getAuthToken, setAuthToken } from '../../../core/auth/AuthSession';
import { requestAuthLogin } from '../../../core/auth/AuthRequestCenter';

// --- auth token ------------------------------------------------------------ #

/** Read the canonical Sanctum token shared by authenticated app transports. */
export function loadToken(): string | null {
  return getAuthToken();
}

export let authToken: string | null = loadToken();

/** Pull a token written by the Core API service into the WordNew transport. */
export function syncPersistedToken(): void {
  const stored = loadToken();
  if (stored !== authToken) setToken(stored);
}

export function setToken(token: string | null): void {
  if (token !== authToken) authenticatedReadDeniedUntil.clear();
  authToken = setAuthToken(token);
  // A fresh, real token re-arms the one-shot expiry notifier for the new session.
  if (token) expiredNotified = false;
}

/** Stop protected writes before transport when no authenticated session exists. */
export function requireAuthToken(): string {
  syncPersistedToken();
  if (authToken) return authToken;
  requestAuthLogin({ source: 'wordnew-api', reason: 'protected-request' });
  const error = new Error('AUTHENTICATION_REQUIRED') as Error & {
    status: number;
    code: string;
  };
  error.status = 401;
  error.code = 'AUTHENTICATION_REQUIRED';
  throw error;
}

/** Backend success/error bodies can carry repeated UTF-8 BOMs — strip them all. */
export function stripBom(text: string): string {
  return text.replace(/^(﻿|ï»¿)+/, '');
}

/** Merge the Bearer header in when a session token is present. CustomAuthenticate
 *  and auth:sanctum both read this Bearer token, so it covers every authed route. */
export function authHeaders(base: Record<string, string>): Record<string, string> {
  if (authToken) return { ...base, Authorization: `Bearer ${authToken}` };
  return base;
}

// --- auth-expiry self-heal -------------------------------------------------- #
// A 401 from any authed call means the session is dead (expired / missing token).
// We drop the local token and notify subscribers (WfNewApp) so the UI can flip to
// logged-out and route to the login screen — one handler fixes EVERY endpoint.

export const authExpiredSubs = new Set<() => void>();

/**
 * One-shot guard so a burst of concurrent 401s (a page fires profile + friends +
 * leaderboard + activities at once) produces a SINGLE "session expired" + logout,
 * not one per request. Re-armed by setToken() on the next successful login.
 */
export let expiredNotified = false;

/** In-flight protected reads are shared so concurrent views issue one request. */
const authenticatedReadFlights = new Map<string, Promise<unknown>>();
/** Permission failures are suppressed briefly instead of being requested in a loop. */
const authenticatedReadDeniedUntil = new Map<string, number>();
const AUTH_PERMISSION_COOLDOWN_MS = 30 * 1000;

export function notifyAuthExpired(): void {
  for (const cb of authExpiredSubs) {
    try { cb(); } catch { /* ignore subscriber errors */ }
  }
}

/** If a response is a 401, clear the token and notify ONCE. Returns the status' 401-ness.
 *  Only a token that JUST expired flips the UI to logged-out + toast — a 401 with NO
 *  token present must never trigger a spurious "session expired" (there was no session). */
export function handleMaybe401(status: number, expectedToken?: string | null): boolean {
  if (status !== 401) return false;
  if (expectedToken !== undefined && authToken !== expectedToken) return true;
  const hadToken = !!authToken;
  if (hadToken) setToken(null);
  if (hadToken && !expiredNotified) {
    expiredNotified = true;
    requestAuthLogin({ source: 'wordnew-api', reason: 'session-expired' });
    notifyAuthExpired();
  }
  return true;
}

/**
 * Unwrap the AppQyV1 `{ success, message, data }` envelope to its `data` payload
 * (the data mappers read groups/words/user off `data`). Raw (non-enveloped)
 * bodies pass through untouched.
 */
export function unwrapEnvelope(body: any): any {
  return unwrapLaravelData(body);
}

// --- transport ------------------------------------------------------------- #

class WfNewQueuedTransport extends MasterApiClient {
  constructor() {
    super({ queueStorageKey: StorageKeys.WORDNEW_API_QUEUE });
    if (typeof window !== 'undefined') {
      window.addEventListener(WORDNEW_API_HEALTH_EVENT, () => {
        if (wfNewEndpoints.hasHealthyEndpoint()) void this.drainQueue();
      });
    }
  }

  protected async resolveBaseUrl(): Promise<string> {
    await wfNewEndpoints.whenReady();
    return wfNewEndpoints.getCurrentBaseUrl();
  }

  protected resolveAuthHeaders(): Record<string, string> {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }

  protected queuedMessage(): string {
    return 'Saved offline — will sync when the connection returns.';
  }
}

const queuedTransport = new WfNewQueuedTransport();

async function requestJSON<T>(path: string, authenticated: boolean): Promise<T> {
  await wfNewEndpoints.whenReady();
  const requestToken = authenticated ? authToken : null;
  const flightKey = authenticated && requestToken ? `${requestToken}:${path}` : null;
  if (flightKey) {
    const deniedUntil = authenticatedReadDeniedUntil.get(path) ?? 0;
    if (deniedUntil > Date.now()) {
      const denied = new Error(`Permission denied for ${path}`) as Error & { status: number };
      denied.status = 403;
      throw denied;
    }
    const active = authenticatedReadFlights.get(flightKey) as Promise<T> | undefined;
    if (active) return active;
  }
  const fetchRemote = async (): Promise<T> => {
    const headers = requestToken
      ? { Accept: 'application/json', Authorization: `Bearer ${requestToken}` }
      : { Accept: 'application/json' };
    const res = await fetch(wfNewEndpoints.buildUrl(path), {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      if (authenticated) handleMaybe401(res.status, requestToken);
      if (authenticated && (res.status === 401 || res.status === 403)) {
        authenticatedReadDeniedUntil.set(path, Date.now() + AUTH_PERMISSION_COOLDOWN_MS);
      }
      throw new Error(`HTTP ${res.status} for ${path}`);
    }
    const rawText = stripBom(await res.text());
    const parsed = rawText ? JSON.parse(rawText) : null;
    return unwrapEnvelope(parsed) as T;
  };
  const operation = coordinateRequest(
    `wordnew-get:${requestToken || 'anonymous'}:${wfNewEndpoints.buildUrl(path)}`,
    () => queryServerResource(path, requestToken, fetchRemote),
    5000,
  );
  if (!flightKey) return operation;
  authenticatedReadFlights.set(flightKey, operation);
  try {
    return await operation;
  } finally {
    authenticatedReadFlights.delete(flightKey);
  }
}

/** GET a public endpoint without leaking or invalidating the current Bearer token. */
export async function getJSON<T>(path: string): Promise<T> {
  return requestJSON<T>(path, false);
}

/**
 * GET an AUTH-REQUIRED endpoint. With NO session token it short-circuits to
 * `fallback` WITHOUT issuing the request — so no auth-only call ever fires (and
 * 401s) before login. This is THE single gate every authed reader goes through;
 * public endpoints keep calling getJSON directly. Centralizing it here keeps the
 * "never hit protected APIs while logged out" rule in exactly one place.
 */
export async function authedGetJSON<T>(path: string, fallback: T): Promise<T> {
  syncPersistedToken();
  if (!authToken) return fallback;
  return requestJSON<T>(path, true);
}

/**
 * POST <currentEndpoint>/path with a JSON body. BOM-tolerant parse; on a non-2xx
 * it throws an Error carrying the backend's `message` (Laravel validation / auth
 * errors) plus `.status`, so callers can branch on it.
 */
export async function postJSON<T>(path: string, body: Record<string, any>): Promise<T> {
  return requestPostJSON<T>(path, body, false);
}

/** POST an auth-required endpoint without issuing a logged-out request. */
export async function authedPostJSON<T>(path: string, body: Record<string, any>): Promise<T> {
  requireAuthToken();
  return requestPostJSON<T>(path, body, false);
}

/** POST a replay-safe write through the shared persistent offline queue. */
export async function queueablePostJSON<T>(path: string, body: Record<string, any>): Promise<T> {
  const requestToken = authToken;
  const res = await queuedTransport.request(path, {
    method: 'POST',
    queueable: true,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const rawText = stripBom(await res.text());
  let parsed: any = null;
  if (rawText) {
    try { parsed = JSON.parse(rawText); } catch { parsed = null; }
  }
  if (!res.ok) {
    handleMaybe401(res.status, requestToken);
    const message = parsed?.message || parsed?.error || `HTTP ${res.status} for ${path}`;
    const error = new Error(message) as Error & { status: number; body: any };
    error.status = res.status;
    error.body = parsed;
    throw error;
  }
  await mirrorServerResponse(path, parsed, requestToken, requestVariant('POST', body));
  return parsed as T;
}

/** Queueable POST guarded by the shared authenticated-session gate. */
export async function authedQueueablePostJSON<T>(path: string, body: Record<string, any>): Promise<T> {
  requireAuthToken();
  return queueablePostJSON<T>(path, body);
}

/** Read-only POST whose response participates in the local-first resource package. */
export async function queryPostJSON<T>(path: string, body: Record<string, any>): Promise<T> {
  return requestPostJSON<T>(path, body, true);
}

/** Read-only POST guarded by the shared authenticated-session gate. */
export async function authedQueryPostJSON<T>(path: string, body: Record<string, any>): Promise<T> {
  requireAuthToken();
  return requestPostJSON<T>(path, body, true);
}

async function requestPostJSON<T>(path: string, body: Record<string, any>, localFirst: boolean): Promise<T> {
  await wfNewEndpoints.whenReady();
  const requestToken = authToken;
  const variant = requestVariant('POST', body);
  const fetchRemote = async (): Promise<T> => {
    const headers = requestToken
      ? { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${requestToken}` }
      : { Accept: 'application/json', 'Content-Type': 'application/json' };
    const res = await fetch(wfNewEndpoints.buildUrl(path), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const rawText = stripBom(await res.text());
    let parsed: any = null;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }
    }
    if (!res.ok) {
      handleMaybe401(res.status, requestToken);
      let message = `HTTP ${res.status} for ${path}`;
      if (parsed && typeof parsed.message === 'string' && parsed.message) message = parsed.message;
      else if (parsed && typeof parsed.error === 'string' && parsed.error) message = parsed.error;
      const err = new Error(message) as Error & { status: number; body: any };
      err.status = res.status;
      err.body = parsed;
      throw err;
    }
    return parsed as T;
  };
  if (localFirst) return queryServerResource(path, requestToken, fetchRemote, variant);
  const result = await fetchRemote();
  if (!/\/(login|register|logout|password|social\/(login|bind|unbind))(\/|\?|$)/i.test(path)) {
    await mirrorServerResponse(path, result, requestToken, variant);
  }
  return result;
}

/**
 * POST a multipart/form-data body (file uploads). NEVER sets Content-Type — the
 * browser writes the multipart boundary itself; the Bearer header is still merged.
 * Same BOM-tolerant parse + 401 self-heal + `.status`/message error shape as postJSON.
 */
export async function postMultipart<T>(path: string, form: FormData): Promise<T> {
  await wfNewEndpoints.whenReady();
  const requestToken = authToken;
  const res = await fetch(wfNewEndpoints.buildUrl(path), {
    method: 'POST',
    headers: requestToken
      ? { Accept: 'application/json', Authorization: `Bearer ${requestToken}` }
      : { Accept: 'application/json' },
    body: form,
  });
  const rawText = stripBom(await res.text());
  let parsed: any = null;
  if (rawText) {
    try { parsed = JSON.parse(rawText); } catch { parsed = null; }
  }
  if (!res.ok) {
    handleMaybe401(res.status, requestToken);
    let message = `HTTP ${res.status} for ${path}`;
    if (parsed && typeof parsed.message === 'string' && parsed.message) message = parsed.message;
    const err = new Error(message) as Error & { status: number; body: any };
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  await mirrorServerResponse(path, parsed, requestToken, 'POST-MULTIPART');
  return parsed as T;
}

/**
 * DELETE <currentEndpoint>/path. Same 401 self-heal as the other transports. */
export async function deleteJSON(path: string): Promise<void> {
  await wfNewEndpoints.whenReady();
  const res = await fetch(wfNewEndpoints.buildUrl(path), {
    method: 'DELETE',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!res.ok) {
    handleMaybe401(res.status);
    throw new Error(`HTTP ${res.status} for ${path}`);
  }
}

/**
 * Normalize the AppQyV1 login/register envelope into a WfNewAuthResult. The
 * backend wraps the payload as { success, message, data: { user, login_token,
 * ... } } (with a legacy top-level `token`); tolerate both unwrapped and raw
 * shapes and read the Bearer token from login_token first.
 */
export function toAuthResult(res: any): WfNewAuthResult {
  const data = res && res.data ? res.data : res;
  const token: string =
    (data && data.login_token) ||
    (res && res.token) ||
    (data && data.token) ||
    (data && data.user_token) ||
    '';
  const rawUser = data ? data.user : undefined;
  const user: WfNewAuthUser = rawUser && typeof rawUser === 'object' ? rawUser : {};
  return { token, user };
}
