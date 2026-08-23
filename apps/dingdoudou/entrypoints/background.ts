// 订多多 background service worker.
// - Owns the message channel (see lib/messaging.ts).
// - Resolves licensing: super-code (offline, full access) OR backend member.
// - Binds Pinduoduo accounts and syncs orders across multiple buyers.

// `defineBackground` is a WXT auto-imported global (no import needed; matches repo convention).
import type { BgRequest, BgResponse } from '@/lib/messaging';
import {
  verifySuperCode,
  superLicense,
  lockedLicense,
  hasFeature,
  isLicenseActive,
} from '@/lib/superCode';
import { heartbeat, memberLogin } from '@/lib/backendClient';
import {
  readActiveCredential,
  fetchAllOrders,
  fetchProfile,
  createAfterSale,
  updateBuyerMemo,
} from '@/lib/pddClient';
import { mapRawOrders } from '@/lib/orderMapper';
import type { PinduoduoAccount, BackendConfig, FeatureFlag } from '@/lib/types';
import * as store from '@/lib/storage';
import { errorText } from '@/lib/value';
import { AppError, isAppError } from '@/lib/appError';
import { DEFAULT_BACKEND_URL, normalizeBackendUrl } from '@/lib/backendUrl';

function ok<T>(data: T): BgResponse<T> {
  return { ok: true, data };
}
function fail(error: unknown): BgResponse {
  if (isAppError(error)) {
    return {
      ok: false,
      error: error.message,
      errorCode: error.code,
      errorDetails: error.details,
    };
  }
  return { ok: false, error: errorText(error, 'Unknown background error') };
}

async function ensureDeviceId(): Promise<string> {
  const backend = await store.updateBackend((current) => ({
    baseUrl: current?.baseUrl || DEFAULT_BACKEND_URL,
    memberToken: current?.memberToken,
    deviceId: current?.deviceId || `dev_${crypto.randomUUID()}`,
  }));
  return backend.deviceId;
}

async function requireActiveLicense(): Promise<NonNullable<Awaited<ReturnType<typeof store.getLicense>>>> {
  const license = await store.getLicense();
  if (!isLicenseActive(license)) throw new AppError('license.inactive');
  return license;
}

async function requireFeature(feature: FeatureFlag): Promise<void> {
  const license = await requireActiveLicense();
  if (!hasFeature(license, feature)) {
    throw new AppError('license.featureUnavailable', { feature });
  }
}

// Sync orders for a single account (must have stored credentials).
async function syncAccount(pddUserId: string, pages: number) {
  const cred = await store.getCredential(pddUserId);
  if (!cred) throw new AppError('account.credentialMissing');
  const account = (await store.getAccounts()).find((a) => a.pddUserId === pddUserId);
  const raw = await fetchAllOrders(cred, pages);
  const orders = mapRawOrders(raw, account?.name || pddUserId, pddUserId);
  await store.setOrdersForBoundAccount(pddUserId, orders);
  return { pddUserId, orders, fetched: orders.length };
}

async function handle(req: BgRequest): Promise<BgResponse> {
  switch (req.type) {
    // ---- Licensing ----
    case 'license.get': {
      const lic = await store.getLicense();
      if (lic && !isLicenseActive(lic) && lic.mode !== 'locked') {
        const locked = lockedLicense();
        return ok(await store.setLicenseIfCurrent(lic, locked));
      }
      if (lic?.mode === 'member') {
        const backend = await store.getBackend();
        if (backend?.memberToken) {
          try {
            const refreshed = await heartbeat(backend);
            return ok(await store.setLicenseIfCurrent(lic, refreshed));
          } catch {
            return ok(lic);
          }
        }
      }
      return ok(lic);
    }
    case 'license.submitSuperCode': {
      if (!verifySuperCode(req.code)) throw new AppError('license.superCodeInvalid');
      const lic = superLicense(req.code);
      await store.setOfflineLicense(lic);
      return ok(lic);
    }
    case 'license.loginMember': {
      const deviceId = await ensureDeviceId();
      const rawBaseUrl = req.baseUrl.trim();
      if (!rawBaseUrl || !req.username.trim()) throw new AppError('backend.credentialsRequired');
      const baseUrl = normalizeBackendUrl(rawBaseUrl);
      const cfg: BackendConfig = { baseUrl, deviceId };
      const lic = await memberLogin(cfg, req.username, req.password);
      if (!isLicenseActive(lic)) throw new AppError('license.memberInactive');
      await store.setMemberSession({ baseUrl, deviceId, memberToken: lic.token }, lic);
      return ok(lic);
    }
    case 'license.clear': {
      await store.clearLicenseSession();
      return ok(null);
    }
    case 'backend.get':
      return ok(await store.getBackend());

    // ---- Accounts ----
    case 'accounts.list':
      return ok(await store.getAccountState());

    case 'accounts.captureActiveTab': {
      await requireActiveLicense();
      const cred = await readActiveCredential();
      if (!cred) throw new AppError('pdd.loginRequired');
      const profile = await fetchProfile(cred);
      return ok({
        pddUserId: cred.pddUserId,
        accessToken: cred.accessToken,
        cookie: cred.cookie,
        nickname: profile.nickname,
        avatar: profile.avatar,
      });
    }

    case 'accounts.bind': {
      if (!req.pddUserId.trim() || !req.accessToken.trim()) {
        throw new AppError('account.invalidCredential');
      }
      const license = await requireActiveLicense();
      const acc: PinduoduoAccount = {
        id: `pdd_${req.pddUserId}`,
        pddUserId: req.pddUserId,
        name: req.nickname || `PDD user ${req.pddUserId.slice(-6)}`,
        avatar: req.avatar || '',
        bindTime: new Date().toISOString(),
        status: 'ACTIVE',
      };
      return ok(
        await store.bindAccount(
          acc,
          {
            pddUserId: req.pddUserId,
            accessToken: req.accessToken,
            cookie: req.cookie,
            capturedAt: Date.now(),
          },
          license.maxBinds,
        ),
      );
    }

    case 'accounts.remove': {
      await requireActiveLicense();
      return ok(await store.removeAccount(req.pddUserId));
    }

    case 'accounts.setActive': {
      await requireActiveLicense();
      return ok(await store.setActiveAccount(req.pddUserId));
    }

    // ---- Orders ----
    case 'orders.cached':
    case 'orders.get': {
      const settings = await store.getSettings();
      const uid = req.pddUserId || settings.activePddUserId;
      if (!uid) return ok([]);
      return ok(await store.getOrdersFor(uid));
    }

    case 'orders.all':
      await requireFeature('account.cross');
      return ok(await store.getAllCachedOrders());

    case 'orders.sync': {
      await requireFeature('order.sync');
      const settings = await store.getSettings();
      const uid = req.pddUserId || settings.activePddUserId;
      if (!uid) throw new AppError('account.required');
      const pages = Math.min(Math.max(Math.trunc(req.pages ?? 5), 1), 100);
      return ok(await syncAccount(uid, pages));
    }

    case 'orders.refund': {
      await requireFeature('order.refund');
      const cred = await store.getCredential(req.pddUserId);
      if (!cred) throw new AppError('account.credentialMissing');
      const orderIds = [...new Set(req.orderIds.map((id) => id.trim()).filter(Boolean))];
      if (!orderIds.length) throw new AppError('order.selectionRequired');
      const updated: string[] = [];
      for (const id of orderIds) {
        if (await createAfterSale(cred, id)) updated.push(id);
      }
      return ok({ updated });
    }

    case 'orders.memo': {
      await requireFeature('order.batch');
      const cred = await store.getCredential(req.pddUserId);
      if (!cred) throw new AppError('account.credentialMissing');
      await updateBuyerMemo(cred, req.orderId, req.memo);
      return ok({ ok: true as const });
    }

    // ---- Reconciliation (订单核算) ----
    case 'reconcile.list':
      return ok(await store.getBatches());
    case 'reconcile.save':
      return ok(await store.saveBatch(req.batch));
    case 'reconcile.remove':
      return ok(await store.removeBatch(req.id));

    // ---- Settings ----
    case 'settings.get':
      return ok(await store.getSettings());
    case 'settings.patch':
      return ok(await store.patchSettings(req.patch));

    default:
      return fail(
        new AppError('message.unknown', {
          type: String((req as { type?: string }).type ?? ''),
        }),
      );
  }
}

export default defineBackground(() => {
  void store.restrictLocalStorageAccess().catch((error) => {
    console.error('Failed to restrict extension storage access.', error);
  });

  chrome.runtime.onMessage.addListener((req: BgRequest, _sender, sendResponse) => {
    // Content scripts broadcast { ddEvent: ... } notifications with no `type`.
    // They expect no reply — ignore them so they don't get error responses.
    if (!req || typeof (req as { type?: unknown }).type !== 'string') return false;
    handle(req)
      .then(sendResponse)
      .catch((e) => sendResponse(fail(e)));
    return true; // async response
  });

  chrome.runtime.onInstalled.addListener(() => {
    void ensureDeviceId().catch((error) => {
      console.error('Failed to initialize the extension device ID.', error);
    });
  });
});
