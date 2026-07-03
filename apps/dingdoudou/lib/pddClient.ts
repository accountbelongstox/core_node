// Pinduoduo API client (runs in the background service worker).
//
// Endpoints recovered from the original 多多开 logic:
//   order list     GET  /proxy/api/api/aristotle/order_list_v4?pdduid=<uid>
//   after-sales    POST /proxy/api/after_sales/create?pdduid=<uid>
//   confirm recv   POST /proxy/api/after_sales/confirm_delivery/<id>?pdduid=<uid>
//   buyer memo     POST /proxy/api/api/debye/update_order_buyer_memo?pdduid=<uid>
//   express pack   POST /proxy/api/api/express/split/pack?pdduid=<uid>
//   profile        GET  /personal_profile.html (nickname/avatar scrape)
//
// Multi-account: each account is keyed by pdd_user_id. Before issuing requests for
// an account we rewrite the pdd_user_id / PDDAccessToken cookies on .yangkeduo.com,
// so the platform treats the request as that buyer (cross-user management).

import type { PddCredential } from './types';

const PDD_HOST = 'mobile.yangkeduo.com';
const PDD_ORIGIN = `https://${PDD_HOST}`;
const COOKIE_DOMAIN = '.yangkeduo.com';

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1';

// Cookies the platform reads for an authenticated buyer session.
const SESSION_COOKIE_NAMES = [
  'api_uid',
  '_nano_fp',
  'webp',
  'jrpl',
  'njrpl',
  'dilx',
  'PDDAccessToken',
  'pdd_user_id',
  'pdd_user_uin',
  'pdd_vds',
];

export interface PddRawOrder {
  [k: string]: any;
}

function expire(): number {
  return Math.floor(Date.now() / 1000) + 3600 * 24 * 30;
}

async function setCookie(name: string, value: string): Promise<void> {
  try {
    await chrome.cookies.set({
      url: PDD_ORIGIN,
      domain: COOKIE_DOMAIN,
      name,
      value,
      path: '/',
      expirationDate: expire(),
    });
  } catch {
    // best-effort; some cookie names may be httpOnly-protected on set
  }
}

// Read the current logged-in account's credentials straight from the browser cookie jar.
export async function readActiveCredential(): Promise<PddCredential | null> {
  const uidCookie = await chrome.cookies.get({ url: PDD_ORIGIN, name: 'pdd_user_id' });
  const tokenCookie = await chrome.cookies.get({ url: PDD_ORIGIN, name: 'PDDAccessToken' });
  if (!uidCookie?.value || !tokenCookie?.value) return null;
  const all = await chrome.cookies.getAll({ domain: COOKIE_DOMAIN });
  const cookie = all
    .filter((c) => SESSION_COOKIE_NAMES.includes(c.name))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  return {
    pddUserId: uidCookie.value,
    accessToken: tokenCookie.value,
    cookie,
    capturedAt: Date.now(),
  };
}

// Make the given account the "current" buyer by rewriting its identity cookies.
export async function activateCredential(cred: PddCredential): Promise<void> {
  await setCookie('pdd_user_id', cred.pddUserId);
  await setCookie('PDDAccessToken', cred.accessToken);
  if (cred.cookie) {
    for (const part of cred.cookie.split('; ')) {
      const eq = part.indexOf('=');
      if (eq <= 0) continue;
      const name = part.slice(0, eq);
      const value = part.slice(eq + 1);
      if (SESSION_COOKIE_NAMES.includes(name) && name !== 'pdd_user_id' && name !== 'PDDAccessToken') {
        await setCookie(name, value);
      }
    }
  }
}

function authHeaders(cred: PddCredential): Record<string, string> {
  return {
    AccessToken: cred.accessToken,
    'User-Agent': MOBILE_UA,
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json;charset=UTF-8',
  };
}

async function pddFetch(cred: PddCredential, path: string, init?: RequestInit): Promise<Response> {
  await activateCredential(cred);
  const url = path.startsWith('http') ? path : `${PDD_ORIGIN}${path}`;
  return fetch(url, {
    credentials: 'include',
    ...init,
    headers: { ...authHeaders(cred), ...(init?.headers as Record<string, string> | undefined) },
  });
}

// Fetch one page of orders. Returns the raw order array (defensively unwrapped).
export async function fetchOrderListPage(
  cred: PddCredential,
  page = 1,
  size = 10,
): Promise<PddRawOrder[]> {
  const qs = new URLSearchParams({
    pdduid: cred.pddUserId,
    page: String(page),
    size: String(size),
    type: '0',
  });
  const res = await pddFetch(cred, `/proxy/api/api/aristotle/order_list_v4?${qs.toString()}`);
  if (!res.ok) throw new Error(`order_list_v4 HTTP ${res.status}`);
  const json = await res.json().catch(() => ({}));
  return unwrapOrders(json);
}

function unwrapOrders(json: any): PddRawOrder[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.orders)) return json.orders;
  if (Array.isArray(json.order_list)) return json.order_list;
  if (json.data) {
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.data.orders)) return json.data.orders;
    if (Array.isArray(json.data.order_list)) return json.data.order_list;
    if (Array.isArray(json.data.list)) return json.data.list;
  }
  if (Array.isArray(json.result)) return json.result;
  return [];
}

// Fetch multiple pages, stopping when a page is empty or maxPages reached.
export async function fetchAllOrders(
  cred: PddCredential,
  maxPages = 5,
  size = 10,
): Promise<PddRawOrder[]> {
  const out: PddRawOrder[] = [];
  for (let p = 1; p <= maxPages; p++) {
    let page: PddRawOrder[] = [];
    try {
      page = await fetchOrderListPage(cred, p, size);
    } catch {
      break;
    }
    if (!page.length) break;
    out.push(...page);
    if (page.length < size) break;
  }
  return out;
}

// Scrape nickname + avatar from the personal profile page (best-effort).
export async function fetchProfile(
  cred: PddCredential,
): Promise<{ nickname?: string; avatar?: string; mobileBind?: string }> {
  try {
    const res = await pddFetch(cred, '/personal_profile.html', {
      headers: { Accept: 'text/html' },
    });
    const html = await res.text();
    const nick =
      html.match(/"nickname"\s*:\s*"([^"]+)"/)?.[1] ||
      html.match(/"nickName"\s*:\s*"([^"]+)"/)?.[1];
    const avatar =
      html.match(/"avatar"\s*:\s*"([^"]+)"/)?.[1] ||
      html.match(/"avatarUrl"\s*:\s*"([^"]+)"/)?.[1];
    const mobile = html.match(/"mobile"\s*:\s*"([^"]+)"/)?.[1];
    return {
      nickname: nick ? decodeJsonUnicode(nick) : undefined,
      avatar: avatar ? avatar.replace(/\\u002F/g, '/').replace(/\\\//g, '/') : undefined,
      mobileBind: mobile,
    };
  } catch {
    return {};
  }
}

function decodeJsonUnicode(s: string): string {
  return s.replace(/\\u[\dA-Fa-f]{4}/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16)));
}

// Create an after-sales (refund) request for an order.
export async function createAfterSale(cred: PddCredential, orderSn: string): Promise<boolean> {
  const res = await pddFetch(cred, `/proxy/api/after_sales/create?pdduid=${cred.pddUserId}`, {
    method: 'POST',
    body: JSON.stringify({ order_sn: orderSn, after_sales_type: 1, refund_reason: 1 }),
  });
  if (!res.ok) return false;
  const json = await res.json().catch(() => ({}));
  return json?.success === true || json?.result === true || res.ok;
}

// Update the buyer memo on an order.
export async function updateBuyerMemo(
  cred: PddCredential,
  orderSn: string,
  memo: string,
): Promise<boolean> {
  const res = await pddFetch(
    cred,
    `/proxy/api/api/debye/update_order_buyer_memo?pdduid=${cred.pddUserId}`,
    { method: 'POST', body: JSON.stringify({ order_sn: orderSn, remark: memo }) },
  );
  return res.ok;
}
