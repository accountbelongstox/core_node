import type {
  AccountState,
  BackendConfig,
  LicenseState,
  Order,
  PddCredential,
  PinduoduoAccount,
} from './types';
import type { ReconcileBatch } from './reconcile';
import { AppError } from './appError';

const KEYS = {
  accounts: 'dd_accounts_v1',
  credentials: 'dd_credentials_v1',
  license: 'dd_license_v1',
  backend: 'dd_backend_v1',
  orders: 'dd_orders_cache_v1',
  settings: 'dd_settings_v1',
  reconcileBatches: 'dd_reconcile_batches_v1',
} as const;

const DEFAULT_SETTINGS: AppSettings = { lang: 'zh', theme: 'dark' };

let writeQueue: Promise<void> = Promise.resolve();

export interface AppSettings {
  lang: 'zh' | 'en';
  theme: 'light' | 'dark';
  activePddUserId?: string;
}

function storedValue<T>(values: Record<string, unknown>, key: string, fallback: T): T {
  return (values[key] as T) ?? fallback;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function rawGet<T>(key: string, fallback: T): Promise<T> {
  const values = await chrome.storage.local.get(key);
  return storedValue(values, key, fallback);
}

async function get<T>(key: string, fallback: T): Promise<T> {
  await writeQueue;
  return rawGet(key, fallback);
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const queued = writeQueue.then(operation);
  writeQueue = queued.then(
    () => undefined,
    () => undefined,
  );
  return queued;
}

async function mutate<T>(key: string, fallback: T, update: (current: T) => T): Promise<T> {
  return enqueue(async () => {
    const current = await rawGet(key, fallback);
    const next = update(current);
    if (!valuesEqual(current, next)) await chrome.storage.local.set({ [key]: next });
    return next;
  });
}

function withActiveAccount(settings: AppSettings, activePddUserId?: string): AppSettings {
  const next = { ...settings };
  if (activePddUserId) next.activePddUserId = activePddUserId;
  else delete next.activePddUserId;
  return next;
}

export async function restrictLocalStorageAccess(): Promise<void> {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}

export async function getAccountState(): Promise<AccountState> {
  return enqueue(async () => {
    const values = await chrome.storage.local.get([KEYS.accounts, KEYS.settings]);
    const accounts = storedValue<PinduoduoAccount[]>(values, KEYS.accounts, []);
    const settings = storedValue<AppSettings>(values, KEYS.settings, DEFAULT_SETTINGS);
    const activePddUserId = accounts.some(
      (account) => account.pddUserId === settings.activePddUserId,
    )
      ? settings.activePddUserId
      : accounts[0]?.pddUserId;
    const nextSettings = withActiveAccount(settings, activePddUserId);
    if (!valuesEqual(settings, nextSettings)) {
      await chrome.storage.local.set({ [KEYS.settings]: nextSettings });
    }
    return { accounts, activePddUserId };
  });
}

export async function bindAccount(
  account: PinduoduoAccount,
  credential: PddCredential,
  maxBinds: number,
): Promise<AccountState> {
  return enqueue(async () => {
    const values = await chrome.storage.local.get([
      KEYS.accounts,
      KEYS.credentials,
      KEYS.settings,
    ]);
    const accounts = storedValue<PinduoduoAccount[]>(values, KEYS.accounts, []);
    const credentials = storedValue<Record<string, PddCredential>>(
      values,
      KEYS.credentials,
      {},
    );
    const settings = storedValue<AppSettings>(values, KEYS.settings, DEFAULT_SETTINGS);
    const index = accounts.findIndex((item) => item.pddUserId === account.pddUserId);
    if (index < 0 && accounts.length >= maxBinds) throw new AppError('account.bindLimit');

    const nextAccounts = [...accounts];
    const existingAccount = nextAccounts[index];
    const nextAccount = existingAccount
      ? {
          ...existingAccount,
          ...account,
          id: existingAccount.id,
          bindTime: existingAccount.bindTime,
        }
      : account;
    if (index < 0) nextAccounts.push(nextAccount);
    else nextAccounts[index] = nextAccount;

    const existingCredential = credentials[credential.pddUserId];
    const credentialChanged =
      !existingCredential ||
      existingCredential.accessToken !== credential.accessToken ||
      existingCredential.cookie !== credential.cookie;
    const nextCredentials = credentialChanged
      ? { ...credentials, [credential.pddUserId]: credential }
      : credentials;
    const nextSettings = settings.activePddUserId === account.pddUserId
      ? settings
      : { ...settings, activePddUserId: account.pddUserId };
    const changes: Record<string, unknown> = {};
    if (!valuesEqual(accounts, nextAccounts)) changes[KEYS.accounts] = nextAccounts;
    if (credentialChanged) changes[KEYS.credentials] = nextCredentials;
    if (!valuesEqual(settings, nextSettings)) changes[KEYS.settings] = nextSettings;
    if (Object.keys(changes).length) await chrome.storage.local.set(changes);
    return { accounts: nextAccounts, activePddUserId: nextSettings.activePddUserId };
  });
}

export async function removeAccount(pddUserId: string): Promise<AccountState> {
  return enqueue(async () => {
    const values = await chrome.storage.local.get([
      KEYS.accounts,
      KEYS.credentials,
      KEYS.orders,
      KEYS.settings,
    ]);
    const accounts = storedValue<PinduoduoAccount[]>(values, KEYS.accounts, []);
    const credentials = storedValue<Record<string, PddCredential>>(
      values,
      KEYS.credentials,
      {},
    );
    const orders = storedValue<Record<string, Order[]>>(values, KEYS.orders, {});
    const settings = storedValue<AppSettings>(values, KEYS.settings, DEFAULT_SETTINGS);
    const nextAccounts = accounts.filter((item) => item.pddUserId !== pddUserId);
    const nextCredentials = { ...credentials };
    const nextOrders = { ...orders };
    delete nextCredentials[pddUserId];
    delete nextOrders[pddUserId];
    const nextActivePddUserId = nextAccounts.some(
      (account) => account.pddUserId === settings.activePddUserId,
    )
      ? settings.activePddUserId
      : nextAccounts[0]?.pddUserId;
    const nextSettings = withActiveAccount(settings, nextActivePddUserId);
    const changes: Record<string, unknown> = {};
    if (!valuesEqual(accounts, nextAccounts)) changes[KEYS.accounts] = nextAccounts;
    if (!valuesEqual(credentials, nextCredentials)) changes[KEYS.credentials] = nextCredentials;
    if (!valuesEqual(orders, nextOrders)) changes[KEYS.orders] = nextOrders;
    if (!valuesEqual(settings, nextSettings)) changes[KEYS.settings] = nextSettings;
    if (Object.keys(changes).length) await chrome.storage.local.set(changes);
    return { accounts: nextAccounts, activePddUserId: nextSettings.activePddUserId };
  });
}

export async function setActiveAccount(pddUserId: string): Promise<AccountState> {
  return enqueue(async () => {
    const values = await chrome.storage.local.get([KEYS.accounts, KEYS.settings]);
    const accounts = storedValue<PinduoduoAccount[]>(values, KEYS.accounts, []);
    const settings = storedValue<AppSettings>(values, KEYS.settings, DEFAULT_SETTINGS);
    if (!accounts.some((item) => item.pddUserId === pddUserId)) {
      throw new AppError('account.notBound');
    }
    const nextSettings = { ...settings, activePddUserId: pddUserId };
    if (!valuesEqual(settings, nextSettings)) {
      await chrome.storage.local.set({ [KEYS.settings]: nextSettings });
    }
    return { accounts, activePddUserId: pddUserId };
  });
}

export const getAccounts = () => get<PinduoduoAccount[]>(KEYS.accounts, []);

export async function getCredential(pddUserId: string): Promise<PddCredential | undefined> {
  const credentials = await get<Record<string, PddCredential>>(KEYS.credentials, {});
  return credentials[pddUserId];
}

export const getLicense = () => get<LicenseState | null>(KEYS.license, null);
export function setLicenseIfCurrent(
  expected: LicenseState | null,
  license: LicenseState | null,
): Promise<LicenseState | null> {
  return enqueue(async () => {
    const current = await rawGet<LicenseState | null>(KEYS.license, null);
    if (!valuesEqual(current, expected)) return current;
    if (!valuesEqual(current, license)) {
      await chrome.storage.local.set({ [KEYS.license]: license });
    }
    return license;
  });
}

export function setMemberSession(
  backend: BackendConfig,
  license: LicenseState,
): Promise<void> {
  return enqueue(async () => {
    const values = await chrome.storage.local.get([KEYS.backend, KEYS.license]);
    const currentBackend = storedValue<BackendConfig | null>(values, KEYS.backend, null);
    const currentLicense = storedValue<LicenseState | null>(values, KEYS.license, null);
    const changes: Record<string, unknown> = {};
    if (!valuesEqual(currentBackend, backend)) changes[KEYS.backend] = backend;
    if (!valuesEqual(currentLicense, license)) changes[KEYS.license] = license;
    if (Object.keys(changes).length) await chrome.storage.local.set(changes);
  });
}

export function setOfflineLicense(license: LicenseState | null): Promise<void> {
  return enqueue(async () => {
    const values = await chrome.storage.local.get([KEYS.backend, KEYS.license]);
    const backend = storedValue<BackendConfig | null>(values, KEYS.backend, null);
    const currentLicense = storedValue<LicenseState | null>(values, KEYS.license, null);
    const nextBackend = backend
      ? { baseUrl: backend.baseUrl, deviceId: backend.deviceId }
      : null;
    const changes: Record<string, unknown> = {};
    if (!valuesEqual(currentLicense, license)) changes[KEYS.license] = license;
    if (!valuesEqual(backend, nextBackend)) changes[KEYS.backend] = nextBackend;
    if (Object.keys(changes).length) await chrome.storage.local.set(changes);
  });
}

export const clearLicenseSession = () => setOfflineLicense(null);

export const getBackend = () => get<BackendConfig | null>(KEYS.backend, null);
export function updateBackend(
  update: (current: BackendConfig | null) => BackendConfig,
): Promise<BackendConfig> {
  return enqueue(async () => {
    const current = await rawGet<BackendConfig | null>(KEYS.backend, null);
    const next = update(current);
    if (!valuesEqual(current, next)) await chrome.storage.local.set({ [KEYS.backend]: next });
    return next;
  });
}

export async function setOrdersForBoundAccount(
  pddUserId: string,
  orders: Order[],
): Promise<void> {
  await enqueue(async () => {
    const values = await chrome.storage.local.get([KEYS.accounts, KEYS.orders]);
    const accounts = storedValue<PinduoduoAccount[]>(values, KEYS.accounts, []);
    if (!accounts.some((account) => account.pddUserId === pddUserId)) {
      throw new AppError('account.removedDuringSync');
    }
    const current = storedValue<Record<string, Order[]>>(values, KEYS.orders, {});
    const next = { ...current, [pddUserId]: orders };
    if (!valuesEqual(current, next)) await chrome.storage.local.set({ [KEYS.orders]: next });
  });
}

export async function getOrdersFor(pddUserId: string): Promise<Order[]> {
  const cache = await get<Record<string, Order[]>>(KEYS.orders, {});
  return cache[pddUserId] ?? [];
}

export async function getAllCachedOrders(): Promise<Order[]> {
  const cache = await get<Record<string, Order[]>>(KEYS.orders, {});
  return Object.values(cache).flat();
}

export const getBatches = () => get<ReconcileBatch[]>(KEYS.reconcileBatches, []);
export async function saveBatch(batch: ReconcileBatch): Promise<ReconcileBatch[]> {
  return mutate<ReconcileBatch[]>(KEYS.reconcileBatches, [], (current) => {
    const list = [...current];
    const index = list.findIndex((item) => item.id === batch.id);
    if (index >= 0) list[index] = batch;
    else list.unshift(batch);
    return list;
  });
}

export async function removeBatch(id: string): Promise<ReconcileBatch[]> {
  return mutate<ReconcileBatch[]>(KEYS.reconcileBatches, [], (current) =>
    current.filter((batch) => batch.id !== id),
  );
}

export const getSettings = () => get<AppSettings>(KEYS.settings, DEFAULT_SETTINGS);
export async function patchSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  return mutate<AppSettings>(KEYS.settings, DEFAULT_SETTINGS, (current) => ({
    ...current,
    ...patch,
  }));
}
