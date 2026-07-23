/** WfNewApiTransport - shared transport core (token state, fetch helpers,
 * auth-expiry self-heal, envelope unwrap) extracted from WfNewApiHttp so the http
 * impl + method modules stay under the 800-line modular limit. authToken /
 * authExpiredSubs are live bindings so the composer's isAuthenticated/onAuthExpired
 * reflect token changes. */
import { wfNewEndpoints } from './WfNewEndpoints';
import {
  mirrorServerResponse,
  queryServerResource,
  requestVariant,
} from '../cache/WfNewServerMirror';
import type { WfNewAuthResult, WfNewAuthUser } from './WfNewApiTypes';

// --- auth token ------------------------------------------------------------ #

/** localStorage key for the persisted Sanctum Bearer token. */
export const AUTH_TOKEN_KEY = 'wfnew_auth_token';

export function loadToken(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

export let authToken: string | null = loadToken();

export function setToken(token: string | null): void {
  authToken = token;
  // A fresh, real token re-arms the one-shot expiry notifier for the new session.
  if (token) expiredNotified = false;
  try {
    if (typeof localStorage === 'undefined') return;
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* best-effort persistence */
  }
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
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    return body.data;
  }
  return body;
}

// --- transport ------------------------------------------------------------- #

async function requestJSON<T>(path: string, authenticated: boolean): Promise<T> {
  await wfNewEndpoints.whenReady();
  const requestToken = authenticated ? authToken : null;
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
      throw new Error(`HTTP ${res.status} for ${path}`);
    }
    const rawText = stripBom(await res.text());
    const parsed = rawText ? JSON.parse(rawText) : null;
    return unwrapEnvelope(parsed) as T;
  };
  return queryServerResource(path, requestToken, fetchRemote);
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

/** Read-only POST whose response participates in the local-first resource package. */
export async function queryPostJSON<T>(path: string, body: Record<string, any>): Promise<T> {
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
