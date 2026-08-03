import { StorageKeys, StorageManager } from '../../persistence';
import { pycoreMasterClient } from './PycoreClient';

const STORE_VERSION = 1;
const MAX_CLIENTS = 2;
const MAX_ROUTE_ENTRIES = 48;
const MAX_ENTRY_CHARACTERS = 128_000;

export interface PycoreRouteRecoveryEntry<T> {
  route: string;
  params: Record<string, unknown>;
  data: T;
  revision?: string;
  cursor?: string | number | null;
  updatedAt: number;
}

interface PycoreClientRecoveryState {
  updatedAt: number;
  entries: Record<string, PycoreRouteRecoveryEntry<unknown>>;
}

interface PycoreRouteRecoveryState {
  version: number;
  clients: Record<string, PycoreClientRecoveryState>;
}

function normalizedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizedValue);
  if (!value || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  Object.keys(source).sort().forEach((key) => {
    if (source[key] !== undefined) out[key] = normalizedValue(source[key]);
  });
  return out;
}

function paramsKey(params: Record<string, unknown>): string {
  return JSON.stringify(normalizedValue(params));
}

function entryKey(route: string, params: Record<string, unknown>): string {
  return `${route}|${paramsKey(params)}`;
}

function emptyState(): PycoreRouteRecoveryState {
  return { version: STORE_VERSION, clients: {} };
}

class PycoreRouteRecoveryStore {
  read<T>(route: string, params: Record<string, unknown> = {}): PycoreRouteRecoveryEntry<T> | null {
    const clientId = pycoreMasterClient.getClientId();
    if (clientId.startsWith('pending:')) return null;
    const state = StorageManager.get<PycoreRouteRecoveryState>(
      StorageKeys.PYCORE_ROUTE_RECOVERY,
      emptyState(),
    );
    const entry = state.clients?.[clientId]?.entries?.[entryKey(route, params)];
    return entry ? entry as PycoreRouteRecoveryEntry<T> : null;
  }

  write<T>(
    route: string,
    params: Record<string, unknown>,
    data: T,
    metadata: { revision?: string; cursor?: string | number | null } = {},
  ): void {
    const clientId = pycoreMasterClient.getClientId();
    if (clientId.startsWith('pending:')) return;
    if (JSON.stringify(data).length > MAX_ENTRY_CHARACTERS) return;
    const state = StorageManager.get<PycoreRouteRecoveryState>(
      StorageKeys.PYCORE_ROUTE_RECOVERY,
      emptyState(),
    );
    const now = Date.now();
    const client = state.clients[clientId] || { updatedAt: now, entries: {} };
    client.entries[entryKey(route, params)] = {
      route,
      params: normalizedValue(params) as Record<string, unknown>,
      data,
      revision: metadata.revision,
      cursor: metadata.cursor,
      updatedAt: now,
    };
    client.entries = Object.fromEntries(
      Object.entries(client.entries)
        .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
        .slice(0, MAX_ROUTE_ENTRIES),
    );
    client.updatedAt = now;
    state.version = STORE_VERSION;
    state.clients[clientId] = client;
    state.clients = Object.fromEntries(
      Object.entries(state.clients)
        .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
        .slice(0, MAX_CLIENTS),
    );
    StorageManager.set(StorageKeys.PYCORE_ROUTE_RECOVERY, state);
  }

  remove(route: string, params: Record<string, unknown> = {}): void {
    const clientId = pycoreMasterClient.getClientId();
    if (clientId.startsWith('pending:')) return;
    const state = StorageManager.get<PycoreRouteRecoveryState>(
      StorageKeys.PYCORE_ROUTE_RECOVERY,
      emptyState(),
    );
    const client = state.clients?.[clientId];
    if (!client) return;
    delete client.entries[entryKey(route, params)];
    client.updatedAt = Date.now();
    StorageManager.set(StorageKeys.PYCORE_ROUTE_RECOVERY, state);
  }
}

export const pycoreRouteRecoveryStore = new PycoreRouteRecoveryStore();
