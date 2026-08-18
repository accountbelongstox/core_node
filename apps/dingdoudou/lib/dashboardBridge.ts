// Dashboard/popup facade over the background message channel.
// UI code imports ONLY from here (plus types/superCode/exportCsv); it never
// touches chrome.* directly, so it also renders in a plain web preview.

import { sendToBackground } from './messaging';
import type { AccountsPayload, SyncResult, CaptureResult } from './messaging';
import type { Order, PinduoduoAccount, LicenseState, BackendConfig } from './types';
import type { AppSettings } from './storage';
import type { ReconcileBatch } from './reconcile';

// Is the dashboard running inside the extension (vs. a plain web preview)?
export function inExtension(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
}

function unwrap<T>(res: { ok: boolean; data?: T; error?: string }): T {
  if (!res.ok) throw new Error(res.error || 'background error');
  return res.data as T;
}

// --- Licensing ---
export async function getLicense(): Promise<LicenseState | null> {
  return unwrap(await sendToBackground({ type: 'license.get' }));
}
export async function submitSuperCode(code: string): Promise<LicenseState> {
  return unwrap(await sendToBackground({ type: 'license.submitSuperCode', code }));
}
export async function loginMember(
  baseUrl: string,
  username: string,
  password: string,
): Promise<LicenseState> {
  return unwrap(await sendToBackground({ type: 'license.loginMember', baseUrl, username, password }));
}
export async function clearLicense(): Promise<void> {
  unwrap(await sendToBackground({ type: 'license.clear' }));
}
export async function getBackend(): Promise<BackendConfig | null> {
  return unwrap(await sendToBackground({ type: 'backend.get' }));
}
export async function setBackend(config: Partial<BackendConfig>): Promise<BackendConfig> {
  return unwrap(await sendToBackground({ type: 'backend.set', config }));
}

// --- Accounts ---
export async function listAccounts(): Promise<AccountsPayload> {
  return unwrap(await sendToBackground({ type: 'accounts.list' }));
}
export async function captureActiveTab(): Promise<CaptureResult> {
  return unwrap(await sendToBackground({ type: 'accounts.captureActiveTab' }));
}
export async function bindAccount(
  pddUserId: string,
  accessToken: string,
  nickname?: string,
  avatar?: string,
): Promise<AccountsPayload> {
  return unwrap(
    await sendToBackground({ type: 'accounts.bind', pddUserId, accessToken, nickname, avatar }),
  );
}
export async function removeAccount(pddUserId: string): Promise<AccountsPayload> {
  return unwrap(await sendToBackground({ type: 'accounts.remove', pddUserId }));
}
export async function setActiveAccount(pddUserId: string): Promise<AccountsPayload> {
  return unwrap(await sendToBackground({ type: 'accounts.setActive', pddUserId }));
}

// --- Orders ---
export async function getOrders(pddUserId?: string): Promise<Order[]> {
  return unwrap(await sendToBackground({ type: 'orders.get', pddUserId }));
}
export async function getCachedOrders(pddUserId?: string): Promise<Order[]> {
  return unwrap(await sendToBackground({ type: 'orders.cached', pddUserId }));
}
export async function syncOrders(pddUserId?: string, pages?: number): Promise<SyncResult> {
  return unwrap(await sendToBackground({ type: 'orders.sync', pddUserId, pages }));
}
export async function refundOrders(pddUserId: string, orderIds: string[]): Promise<string[]> {
  return unwrap(await sendToBackground({ type: 'orders.refund', pddUserId, orderIds })).updated;
}
export async function getAllOrders(): Promise<Order[]> {
  return unwrap(await sendToBackground({ type: 'orders.all' }));
}

// --- Reconciliation batches (订单核算) ---
export async function listBatches(): Promise<ReconcileBatch[]> {
  return unwrap(await sendToBackground({ type: 'reconcile.list' }));
}
export async function saveBatch(batch: ReconcileBatch): Promise<ReconcileBatch[]> {
  return unwrap(await sendToBackground({ type: 'reconcile.save', batch }));
}
export async function removeBatch(id: string): Promise<ReconcileBatch[]> {
  return unwrap(await sendToBackground({ type: 'reconcile.remove', id }));
}

// --- Settings ---
export async function getSettings(): Promise<AppSettings> {
  return unwrap(await sendToBackground({ type: 'settings.get' }));
}
export async function patchSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  return unwrap(await sendToBackground({ type: 'settings.patch', patch }));
}

export type { AccountsPayload, SyncResult, CaptureResult } from './messaging';
export type { PinduoduoAccount, Order, LicenseState, BackendConfig } from './types';
