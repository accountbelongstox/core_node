// Thin typed wrappers over chrome.storage.local for 订多多.
// Single namespace of keys so every context reads/writes the same shapes.

import type {
  Order,
  PinduoduoAccount,
  PddCredential,
  LicenseState,
  BackendConfig,
} from './types';
import type { ReconcileBatch } from './reconcile';

const KEYS = {
  accounts: 'dd_accounts_v1',
  credentials: 'dd_credentials_v1', // map<pddUserId, PddCredential>
  license: 'dd_license_v1',
  backend: 'dd_backend_v1',
  orders: 'dd_orders_cache_v1', // map<pddUserId, Order[]>
  settings: 'dd_settings_v1',
  reconcileBatches: 'dd_reconcile_batches_v1', // ReconcileBatch[]
} as const;

const writeQueues = new Map<string, Promise<void>>();

export interface AppSettings {
  lang: 'zh' | 'en';
  theme: 'light' | 'dark';
  activePddUserId?: string;
}

async function get<T>(key: string, fallback: T): Promise<T> {
  const out = await chrome.storage.local.get(key);
  return (out[key] as T) ?? fallback;
}

async function set(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

async function mutate<T>(key: string, fallback: T, update: (current: T) => T): Promise<T> {
  const previous = writeQueues.get(key) ?? Promise.resolve();
  let result!: T;
  const operation = previous.catch(() => undefined).then(async () => {
    result = update(await get(key, fallback));
    await set(key, result);
  });
  writeQueues.set(key, operation);
  try {
    await operation;
    return result;
  } finally {
    if (writeQueues.get(key) === operation) writeQueues.delete(key);
  }
}

// --- Accounts ---
export const getAccounts = () => get<PinduoduoAccount[]>(KEYS.accounts, []);
export const setAccounts = (a: PinduoduoAccount[]) => set(KEYS.accounts, a);

export async function upsertAccount(acc: PinduoduoAccount): Promise<PinduoduoAccount[]> {
  return mutate<PinduoduoAccount[]>(KEYS.accounts, [], (current) => {
    const list = [...current];
    const idx = list.findIndex((x) => x.pddUserId === acc.pddUserId);
    if (idx >= 0) list[idx] = { ...list[idx], ...acc };
    else list.push(acc);
    return list;
  });
}

export async function removeAccount(pddUserId: string): Promise<PinduoduoAccount[]> {
  const list = await mutate<PinduoduoAccount[]>(KEYS.accounts, [], (current) =>
    current.filter((x) => x.pddUserId !== pddUserId),
  );
  await mutate<Record<string, PddCredential>>(KEYS.credentials, {}, (current) => {
    const next = { ...current };
    delete next[pddUserId];
    return next;
  });
  await mutate<Record<string, Order[]>>(KEYS.orders, {}, (current) => {
    const next = { ...current };
    delete next[pddUserId];
    return next;
  });
  return list;
}

// --- Credentials (PDDAccessToken + pdd_user_id) ---
export const getCredentials = () => get<Record<string, PddCredential>>(KEYS.credentials, {});
export const setCredentials = (c: Record<string, PddCredential>) => set(KEYS.credentials, c);

export async function saveCredential(cred: PddCredential): Promise<void> {
  await mutate<Record<string, PddCredential>>(KEYS.credentials, {}, (current) => ({
    ...current,
    [cred.pddUserId]: cred,
  }));
}

export async function getCredential(pddUserId: string): Promise<PddCredential | undefined> {
  return (await getCredentials())[pddUserId];
}

// --- License ---
export const getLicense = () => get<LicenseState | null>(KEYS.license, null);
export const setLicense = (l: LicenseState | null) => set(KEYS.license, l);

// --- Backend config ---
export const getBackend = () => get<BackendConfig | null>(KEYS.backend, null);
export const setBackend = (b: BackendConfig | null) => set(KEYS.backend, b);

// --- Cached orders per account ---
export const getOrdersCache = () => get<Record<string, Order[]>>(KEYS.orders, {});
export async function setOrdersFor(pddUserId: string, orders: Order[]): Promise<void> {
  await mutate<Record<string, Order[]>>(KEYS.orders, {}, (current) => ({
    ...current,
    [pddUserId]: orders,
  }));
}
export async function getOrdersFor(pddUserId: string): Promise<Order[]> {
  return (await getOrdersCache())[pddUserId] ?? [];
}
// All cached orders across every bound account (for cross-account reconciliation).
export async function getAllCachedOrders(): Promise<Order[]> {
  const cache = await getOrdersCache();
  return Object.values(cache).flat();
}

// --- Reconciliation batches (订单核算) ---
export const getBatches = () => get<ReconcileBatch[]>(KEYS.reconcileBatches, []);
export const setBatches = (b: ReconcileBatch[]) => set(KEYS.reconcileBatches, b);
export async function saveBatch(batch: ReconcileBatch): Promise<ReconcileBatch[]> {
  return mutate<ReconcileBatch[]>(KEYS.reconcileBatches, [], (current) => {
    const list = [...current];
    const idx = list.findIndex((x) => x.id === batch.id);
    if (idx >= 0) list[idx] = batch;
    else list.unshift(batch);
    return list;
  });
}
export async function removeBatch(id: string): Promise<ReconcileBatch[]> {
  return mutate<ReconcileBatch[]>(KEYS.reconcileBatches, [], (current) =>
    current.filter((x) => x.id !== id),
  );
}

// --- Settings ---
export const getSettings = () =>
  get<AppSettings>(KEYS.settings, { lang: 'zh', theme: 'dark' });
export const setSettings = (s: AppSettings) => set(KEYS.settings, s);
export async function patchSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  return mutate<AppSettings>(KEYS.settings, { lang: 'zh', theme: 'dark' }, (current) => ({
    ...current,
    ...patch,
  }));
}
