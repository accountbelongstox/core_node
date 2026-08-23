// Typed message protocol between UI contexts (dashboard, popup, content scripts)
// and the background service worker. One request/response channel via
// chrome.runtime.sendMessage. Every request returns a BgResponse<T>.

import type {
  Order,
  AccountState,
  LicenseState,
  BackendConfig,
} from './types';
import type { AppSettings } from './storage';
import type { ReconcileBatch } from './reconcile';
import type { AppErrorCode, AppErrorDetails } from './appError';

export type BgRequest =
  // licensing
  | { type: 'license.get' }
  | { type: 'license.submitSuperCode'; code: string }
  | { type: 'license.loginMember'; baseUrl: string; username: string; password: string }
  | { type: 'license.clear' }
  | { type: 'backend.get' }
  // accounts
  | { type: 'accounts.list' }
  | { type: 'accounts.captureActiveTab' } // read PDD credentials for the most recently used PDD tab
  | { type: 'accounts.bind'; pddUserId: string; accessToken: string; cookie?: string; nickname?: string; avatar?: string }
  | { type: 'accounts.remove'; pddUserId: string }
  | { type: 'accounts.setActive'; pddUserId: string }
  // orders
  | { type: 'orders.get'; pddUserId?: string }
  | { type: 'orders.sync'; pddUserId?: string; pages?: number }
  | { type: 'orders.cached'; pddUserId?: string }
  | { type: 'orders.all' }
  // reconciliation (订单核算)
  | { type: 'reconcile.list' }
  | { type: 'reconcile.save'; batch: ReconcileBatch }
  | { type: 'reconcile.remove'; id: string }
  // batch operations against PDD
  | { type: 'orders.refund'; pddUserId: string; orderIds: string[] }
  | { type: 'orders.memo'; pddUserId: string; orderId: string; memo: string }
  // settings
  | { type: 'settings.get' }
  | { type: 'settings.patch'; patch: Partial<AppSettings> };

export interface BgResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  errorCode?: AppErrorCode;
  errorDetails?: AppErrorDetails;
}

export interface SyncResult {
  pddUserId: string;
  orders: Order[];
  fetched: number;
}

export type AccountsPayload = AccountState;

export interface CaptureResult {
  pddUserId: string;
  accessToken: string;
  cookie?: string;
  nickname?: string;
  avatar?: string;
}

// Map request type -> response data type for callers that want inference.
export interface ResponseMap {
  'license.get': LicenseState | null;
  'license.submitSuperCode': LicenseState;
  'license.loginMember': LicenseState;
  'license.clear': null;
  'backend.get': BackendConfig | null;
  'accounts.list': AccountsPayload;
  'accounts.captureActiveTab': CaptureResult;
  'accounts.bind': AccountsPayload;
  'accounts.remove': AccountsPayload;
  'accounts.setActive': AccountsPayload;
  'orders.get': Order[];
  'orders.sync': SyncResult;
  'orders.cached': Order[];
  'orders.all': Order[];
  'orders.refund': { updated: string[] };
  'orders.memo': { ok: true };
  'reconcile.list': ReconcileBatch[];
  'reconcile.save': ReconcileBatch[];
  'reconcile.remove': ReconcileBatch[];
  'settings.get': AppSettings;
  'settings.patch': AppSettings;
}

export async function sendToBackground<R extends BgRequest>(
  req: R,
): Promise<BgResponse<R['type'] extends keyof ResponseMap ? ResponseMap[R['type']] : unknown>> {
  try {
    const res: unknown = await chrome.runtime.sendMessage(req);
    return (res ?? { ok: false, error: 'no response' }) as BgResponse<
      R['type'] extends keyof ResponseMap ? ResponseMap[R['type']] : unknown
    >;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
