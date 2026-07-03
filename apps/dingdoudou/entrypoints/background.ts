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
  isLicenseActive,
} from '@/lib/superCode';
import { memberLogin } from '@/lib/backendClient';
import {
  readActiveCredential,
  fetchAllOrders,
  fetchProfile,
  createAfterSale,
  updateBuyerMemo,
} from '@/lib/pddClient';
import { mapRawOrders } from '@/lib/orderMapper';
import type { PinduoduoAccount, BackendConfig } from '@/lib/types';
import * as store from '@/lib/storage';

function ok<T>(data: T): BgResponse<T> {
  return { ok: true, data };
}
function fail(error: unknown): BgResponse {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

async function ensureDeviceId(): Promise<string> {
  const backend = await store.getBackend();
  if (backend?.deviceId) return backend.deviceId;
  const id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  await store.setBackend({ baseUrl: backend?.baseUrl || 'http://127.0.0.1:9000', deviceId: id });
  return id;
}

async function accountsPayload() {
  const accounts = await store.getAccounts();
  const settings = await store.getSettings();
  return { accounts, activePddUserId: settings.activePddUserId };
}

// Sync orders for a single account (must have stored credentials).
async function syncAccount(pddUserId: string, pages: number) {
  const cred = await store.getCredential(pddUserId);
  if (!cred) throw new Error('该账号未捕获登录凭证，请在已登录的拼多多页面重新绑定');
  const account = (await store.getAccounts()).find((a) => a.pddUserId === pddUserId);
  const raw = await fetchAllOrders(cred, pages);
  const orders = mapRawOrders(raw, account?.name || pddUserId, pddUserId);
  await store.setOrdersFor(pddUserId, orders);
  return { pddUserId, orders, fetched: orders.length };
}

async function handle(req: BgRequest): Promise<BgResponse> {
  switch (req.type) {
    // ---- Licensing ----
    case 'license.get': {
      const lic = await store.getLicense();
      if (lic && !isLicenseActive(lic) && lic.mode !== 'locked') {
        const locked = lockedLicense();
        await store.setLicense(locked);
        return ok(locked);
      }
      return ok(lic);
    }
    case 'license.submitSuperCode': {
      if (!verifySuperCode(req.code)) throw new Error('超级码无效');
      const lic = superLicense(req.code);
      await store.setLicense(lic);
      return ok(lic);
    }
    case 'license.loginMember': {
      const deviceId = await ensureDeviceId();
      const cfg: BackendConfig = { baseUrl: req.baseUrl, deviceId };
      const lic = await memberLogin(cfg, req.username, req.password);
      await store.setBackend({ baseUrl: req.baseUrl, deviceId, memberToken: lic.token });
      await store.setLicense(lic);
      return ok(lic);
    }
    case 'license.clear': {
      await store.setLicense(null);
      return ok(null);
    }
    case 'backend.get':
      return ok(await store.getBackend());
    case 'backend.set': {
      const deviceId = await ensureDeviceId();
      const cur = await store.getBackend();
      const next: BackendConfig = {
        baseUrl: req.config.baseUrl || cur?.baseUrl || 'http://127.0.0.1:9000',
        deviceId: req.config.deviceId || deviceId,
        memberToken: req.config.memberToken ?? cur?.memberToken,
      };
      await store.setBackend(next);
      return ok(next);
    }

    // ---- Accounts ----
    case 'accounts.list':
      return ok(await accountsPayload());

    case 'accounts.captureActiveTab': {
      const cred = await readActiveCredential();
      if (!cred) throw new Error('未检测到已登录的拼多多账号，请先在拼多多页面登录');
      await store.saveCredential(cred);
      const profile = await fetchProfile(cred);
      return ok({
        pddUserId: cred.pddUserId,
        accessToken: cred.accessToken,
        nickname: profile.nickname,
        avatar: profile.avatar,
      });
    }

    case 'accounts.bind': {
      const existing = await store.getCredential(req.pddUserId);
      if (!existing || existing.accessToken !== req.accessToken) {
        await store.saveCredential({
          pddUserId: req.pddUserId,
          accessToken: req.accessToken,
          capturedAt: Date.now(),
        });
      }
      const acc: PinduoduoAccount = {
        id: `pdd_${req.pddUserId}`,
        pddUserId: req.pddUserId,
        name: req.nickname || `拼多多用户_${req.pddUserId.slice(-6)}`,
        avatar: req.avatar || '',
        bindTime: new Date().toLocaleString('zh-CN'),
        status: 'ACTIVE',
      };
      await store.upsertAccount(acc);
      const settings = await store.getSettings();
      if (!settings.activePddUserId) await store.patchSettings({ activePddUserId: req.pddUserId });
      return ok(await accountsPayload());
    }

    case 'accounts.remove': {
      await store.removeAccount(req.pddUserId);
      const settings = await store.getSettings();
      if (settings.activePddUserId === req.pddUserId) {
        const rest = await store.getAccounts();
        await store.patchSettings({ activePddUserId: rest[0]?.pddUserId });
      }
      return ok(await accountsPayload());
    }

    case 'accounts.setActive': {
      await store.patchSettings({ activePddUserId: req.pddUserId });
      return ok(await accountsPayload());
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
      return ok(await store.getAllCachedOrders());

    case 'orders.sync': {
      const settings = await store.getSettings();
      const uid = req.pddUserId || settings.activePddUserId;
      if (!uid) throw new Error('请先绑定并选择一个拼多多账号');
      return ok(await syncAccount(uid, req.pages ?? 5));
    }

    case 'orders.refund': {
      const cred = await store.getCredential(req.pddUserId);
      if (!cred) throw new Error('该账号未捕获登录凭证');
      const updated: string[] = [];
      for (const id of req.orderIds) {
        if (await createAfterSale(cred, id)) updated.push(id);
      }
      return ok({ updated });
    }

    case 'orders.memo': {
      const cred = await store.getCredential(req.pddUserId);
      if (!cred) throw new Error('该账号未捕获登录凭证');
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
      return fail(`unknown message: ${(req as { type?: string }).type}`);
  }
}

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((req: BgRequest, _sender, sendResponse) => {
    // Content scripts broadcast { ddEvent: ... } notifications with no `type`.
    // They expect no reply — ignore them so they don't get error responses.
    if (!req || typeof (req as { type?: unknown }).type !== 'string') return false;
    handle(req)
      .then(sendResponse)
      .catch((e) => sendResponse(fail(e)));
    return true; // async response
  });

  chrome.runtime.onInstalled.addListener(async () => {
    await ensureDeviceId();
  });
});
