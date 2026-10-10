import { StorageManager } from '../persistence';
import { AuthStorageKeys } from './AuthStorageKeys';

/**
 * Laravel login sessions, one per Laravel API identity.
 *
 * A namespace is the normalized base URL of a Laravel API (`https://host[:port][/basePath]`).
 * Endpoints that report the same server id (health `server_id`) share one session
 * (`server:<id>`); every other endpoint keeps its own. Every function takes an optional
 * endpoint (base URL or namespace) and defaults to the active one, so a token is only
 * ever read for the API it was issued by.
 */
export type AuthUser = Record<string, unknown>;

interface AuthSessionRecord {
  token: string | null;
  user: AuthUser | null;
  savedAt: number;
}

interface AuthStore {
  sessions: Record<string, AuthSessionRecord>;
  /** Namespace -> server id learned from that endpoint's health answer. */
  servers: Record<string, string>;
}

export interface AuthSnapshot {
  namespace: string | null;
  loggedIn: boolean;
  user: AuthUser | null;
}

export interface AuthSessionEntry {
  key: string;
  namespaces: string[];
  user: AuthUser | null;
  hasToken: boolean;
}

const SERVER_SESSION_PREFIX = 'server:';
const UNSCOPED_NAMESPACE = 'unscoped';
const ACTIVE_SNAPSHOT_KEY = '@active';
const EMPTY_SNAPSHOT: AuthSnapshot = { namespace: null, loggedIn: false, user: null };

let store: AuthStore | null = null;
let activeNamespace: string | null = null;
let legacyAdopted = false;
let version = 0;
const activeListeners = new Set<() => void>();
const storeListeners = new Set<() => void>();
const snapshotCache = new Map<string, { version: number; value: AuthSnapshot }>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function normalizeToken(token: string | null): string | null {
  if (!token) return null;
  const normalized = token.replace(/^Bearer\s+/i, '').trim();
  return normalized || null;
}

/** Stable identity of a Laravel API: lower-cased `scheme://host[:port][/path]` without a trailing slash. */
export function authNamespaceOf(endpoint: string): string {
  const trimmed = String(endpoint || '').trim().replace(/\/+$/, '');
  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

/** Short display form of an API identity: `host[:port][/path]`. */
export function authEndpointLabel(endpoint: string): string {
  return authNamespaceOf(endpoint).replace(/^https?:\/\//, '');
}

function readStore(): AuthStore {
  if (store) return store;
  const saved = StorageManager.get<unknown>(AuthStorageKeys.SESSIONS, null);
  const next: AuthStore = { sessions: {}, servers: {} };
  if (isRecord(saved) && isRecord(saved.sessions)) {
    Object.entries(saved.sessions).forEach(([key, record]) => {
      if (!isRecord(record)) return;
      const token = typeof record.token === 'string' ? normalizeToken(record.token) : null;
      const user = isRecord(record.user) ? record.user : null;
      if (token) next.sessions[key] = { token, user, savedAt: Number(record.savedAt) || 0 };
    });
  }
  if (isRecord(saved) && isRecord(saved.servers)) {
    Object.entries(saved.servers).forEach(([namespace, id]) => {
      if (typeof id === 'string' && id) next.servers[namespace] = id;
    });
  }
  store = next;
  return next;
}

function writeStore(): void {
  const current = readStore();
  const persisted = Object.fromEntries(Object.entries(current.sessions).filter(([, record]) => record.token !== null));
  StorageManager.set(AuthStorageKeys.SESSIONS, { ...current, sessions: persisted });
}

function namespaceFor(endpoint?: string | null): string {
  if (endpoint) return authNamespaceOf(endpoint);
  return activeNamespace ?? UNSCOPED_NAMESPACE;
}

function sessionKeyFor(namespace: string): string {
  const serverId = readStore().servers[namespace];
  return serverId ? `${SERVER_SESSION_PREFIX}${serverId}` : namespace;
}

function recordFor(endpoint?: string | null): AuthSessionRecord | null {
  return readStore().sessions[sessionKeyFor(namespaceFor(endpoint))] ?? null;
}

function activeIdentity(): string {
  const record = recordFor(null);
  return `${activeNamespace ?? ''}|${sessionKeyFor(namespaceFor(null))}|${record?.token ?? ''}`;
}

function notifyChanged(activeBefore: string): void {
  version += 1;
  storeListeners.forEach((listener) => listener());
  if (activeIdentity() !== activeBefore) activeListeners.forEach((listener) => listener());
}

function adoptLegacyToken(namespace: string): void {
  if (legacyAdopted) return;
  legacyAdopted = true;
  const legacy = normalizeToken(StorageManager.get<string | null>(AuthStorageKeys.TOKEN, null));
  if (!legacy) return;
  StorageManager.remove(AuthStorageKeys.TOKEN);
  const key = sessionKeyFor(namespace);
  const sessions = readStore().sessions;
  if (!sessions[key]) {
    sessions[key] = { token: legacy, user: null, savedAt: Date.now() };
    writeStore();
  }
}

export function getActiveAuthNamespace(): string | null {
  return activeNamespace;
}

/** Point the shared auth state at another Laravel API; subscribers see the new session at once. */
export function setActiveAuthNamespace(endpoint: string): void {
  const next = authNamespaceOf(endpoint);
  if (next === activeNamespace) return;
  const before = activeIdentity();
  activeNamespace = next;
  adoptLegacyToken(next);
  notifyChanged(before);
}

export function getAuthToken(endpoint?: string | null): string | null {
  return recordFor(endpoint)?.token ?? null;
}

export function getAuthHeader(endpoint?: string | null): string | null {
  const token = getAuthToken(endpoint);
  return token ? `Bearer ${token}` : null;
}

export function getAuthUser(endpoint?: string | null): AuthUser | null {
  return recordFor(endpoint)?.user ?? null;
}

/** Store (or, with null, drop) the bearer token of one API; a new token starts without a user. */
export function setAuthToken(token: string | null, endpoint?: string | null): string | null {
  const normalized = normalizeToken(token);
  const key = sessionKeyFor(namespaceFor(endpoint));
  const sessions = readStore().sessions;
  const current = sessions[key] ?? null;
  if (!normalized) {
    if (!current) return null;
    const before = activeIdentity();
    delete sessions[key];
    writeStore();
    notifyChanged(before);
    return null;
  }
  if (current?.token === normalized) return normalized;
  const before = activeIdentity();
  sessions[key] = { token: normalized, user: null, savedAt: Date.now() };
  writeStore();
  notifyChanged(before);
  return normalized;
}

/** Attach the signed-in user to the session of one API (a tokenless loopback session is created on demand). */
export function setAuthUser(user: AuthUser | null, endpoint?: string | null): void {
  const key = sessionKeyFor(namespaceFor(endpoint));
  const sessions = readStore().sessions;
  const current = sessions[key] ?? null;
  if (!current && !user) return;
  const before = activeIdentity();
  if (!user && current) {
    if (current.token) sessions[key] = { ...current, user: null };
    else delete sessions[key];
  } else if (user) {
    sessions[key] = { token: current?.token ?? null, user, savedAt: current?.savedAt ?? Date.now() };
  }
  writeStore();
  notifyChanged(before);
}

export function clearAuthSession(endpoint?: string | null): void {
  setAuthToken(null, endpoint);
  setAuthUser(null, endpoint);
}

/** Record the server id an endpoint answered with, so endpoints of one server share their session. */
export function registerAuthServerId(endpoint: string, serverId: string): void {
  const namespace = authNamespaceOf(endpoint);
  const current = readStore();
  if (!serverId || current.servers[namespace] === serverId) return;
  const before = activeIdentity();
  const previousKey = sessionKeyFor(namespace);
  current.servers[namespace] = serverId;
  const nextKey = sessionKeyFor(namespace);
  const moving = previousKey === namespace ? current.sessions[previousKey] : undefined;
  if (moving) {
    if (!current.sessions[nextKey]) current.sessions[nextKey] = moving;
    delete current.sessions[previousKey];
  }
  writeStore();
  notifyChanged(before);
}

export function getAuthServerId(endpoint?: string | null): string | null {
  return readStore().servers[namespaceFor(endpoint)] ?? null;
}

/** Every stored session with the namespaces that resolve to it. */
export function listAuthSessions(): AuthSessionEntry[] {
  const current = readStore();
  return Object.entries(current.sessions).map(([key, record]) => ({
    key,
    namespaces: key.startsWith(SERVER_SESSION_PREFIX)
      ? Object.keys(current.servers).filter((namespace) => sessionKeyFor(namespace) === key)
      : [key],
    user: record.user,
    hasToken: record.token !== null,
  }));
}

/** The session of one API (default: the active one) as a stable, cached snapshot. */
export function getAuthSnapshot(endpoint?: string | null): AuthSnapshot {
  const cacheKey = endpoint ? authNamespaceOf(endpoint) : ACTIVE_SNAPSHOT_KEY;
  const cached = snapshotCache.get(cacheKey);
  if (cached && cached.version === version) return cached.value;
  const namespace = endpoint ? authNamespaceOf(endpoint) : activeNamespace;
  const record = namespace ? recordFor(namespace) : null;
  const value: AuthSnapshot = namespace
    ? { namespace, loggedIn: record !== null, user: record?.user ?? null }
    : EMPTY_SNAPSHOT;
  snapshotCache.set(cacheKey, { version, value });
  return value;
}

export function getServerAuthSnapshot(): AuthSnapshot {
  return EMPTY_SNAPSHOT;
}

/** Fires when the ACTIVE API's token, or the active API itself, changes. */
export function subscribeAuthSession(listener: () => void): () => void {
  activeListeners.add(listener);
  return () => activeListeners.delete(listener);
}

/** Fires on every change of any stored session (token, user, server alias, active API). */
export function subscribeAuthStore(listener: () => void): () => void {
  storeListeners.add(listener);
  return () => storeListeners.delete(listener);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== AuthStorageKeys.SESSIONS) return;
    const before = activeIdentity();
    store = null;
    notifyChanged(before);
  });
}
