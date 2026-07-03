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

// --- Accounts ---
export const getAccounts = () => get<PinduoduoAccount[]>(KEYS.accounts, []);
export const setAccounts = (a: PinduoduoAccount[]) => set(KEYS.accounts, a);

export async function upsertAccount(acc: PinduoduoAccount): Promise<PinduoduoAccount[]> {
  const list = await getAccounts();
  const idx = list.findIndex((x) => x.pddUserId === acc.pddUserId);
  if (idx >= 0) list[idx] = { ...list[idx], ...acc };
  else list.push(acc);
  await setAccounts(list);
  return list;
}

export async function removeAccount(pddUserId: string): Promise<PinduoduoAccount[]> {
  const list = (await getAccounts()).filter((x) => x.pddUserId !== pddUserId);
  await setAccounts(list);
  const creds = await getCredentials();
  delete creds[pddUserId];
  await setCredentials(creds);
  return list;
}

// --- Credentials (PDDAccessToken + pdd_user_id) ---
export const getCredentials = () => get<Record<string, PddCredential>>(KEYS.credentials, {});
export const setCredentials = (c: Record<string, PddCredential>) => set(KEYS.credentials, c);

export async function saveCredential(cred: PddCredential): Promise<void> {
  const all = await getCredentials();
  all[cred.pddUserId] = cred;
  await setCredentials(all);
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
  const cache = await getOrdersCache();
  cache[pddUserId] = orders;
  await set(KEYS.orders, cache);
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
  const list = await getBatches();
  const idx = list.findIndex((x) => x.id === batch.id);
  if (idx >= 0) list[idx] = batch;
  else list.unshift(batch);
  await setBatches(list);
  return list;
}
export async function removeBatch(id: string): Promise<ReconcileBatch[]> {
  const list = (await getBatches()).filter((x) => x.id !== id);
  await setBatches(list);
  return list;
}

// --- Settings ---
export const getSettings = () =>
  get<AppSettings>(KEYS.settings, { lang: 'zh', theme: 'dark' });
export const setSettings = (s: AppSettings) => set(KEYS.settings, s);
export async function patchSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await getSettings()), ...patch };
  await setSettings(next);
  return next;
}
