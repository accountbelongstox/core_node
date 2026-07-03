// Bridge content script for all Pinduoduo mobile pages.
//
// Two jobs:
//   1. On load, tell the background whether this is a logged-in PDD session so
//      the dashboard knows it can capture credentials / scrape from this tab.
//   2. Serve the 'scrapeVisibleOrders' action: a DOM fallback that reads order
//      rows straight off any visible order-list page (used when the API path
//      is unavailable). Everything is parsed defensively.
//
// Ported from the original DDK page helpers. Runs at document_idle.

import {
  domReady,
  isVisible,
  onAction,
  queryAll,
  sendDdEvent,
  textOf,
  type ActionResult,
} from '@/lib/domAuto';

interface ScrapedOrder {
  orderSn: string;
  productName: string;
  amount: string;
  status: string;
}

// Known PDD order-status phrases, longest-first so we match the most specific.
const STATUS_WORDS = [
  '等待付款',
  '待付款',
  '待支付',
  '待成团',
  '待发货',
  '待收货',
  '待评价',
  '已签收',
  '已收货',
  '已完成',
  '交易成功',
  '退款成功',
  '退款中',
  '已退款',
  '已关闭',
  '交易关闭',
  '已取消',
  '拼单中',
];

// Heuristic: is the current page a logged-in buyer session? The HttpOnly auth
// cookie is invisible to document.cookie, so we sniff the non-HttpOnly identity
// cookies first, then fall back to a cheap DOM signal.
function detectLoggedIn(): boolean {
  // Primary: identity cookies PDD sets for a signed-in buyer.
  try {
    if (/(?:^|;\s*)(pdd_user_id|pdd_user_uin|api_uid)=/.test(document.cookie || '')) {
      return true;
    }
  } catch {
    /* ignore */
  }
  // Fallback: a logged-out PDD page surfaces a prominent 登录 entry. Scan only
  // anchors / buttons (cheap); its absence is treated as logged-in.
  try {
    const hasLoginCta = queryAll<HTMLElement>('a, button, [role="button"]').some((el) => {
      const t = textOf(el);
      return !!t && t.length <= 6 && /(登录|去登录|请登录)/.test(t) && isVisible(el);
    });
    return !hasLoginCta;
  } catch {
    return false;
  }
}

// Pull the most plausible order number from a row's text. PDD order_sn values
// are long digit runs (commonly 16-20 chars); prefer ones tagged with 订单号.
function extractOrderSn(rowText: string, row: HTMLElement): string {
  const tagged = rowText.match(/订单(?:编)?号[:：\s]*([0-9]{10,24})/);
  if (tagged) return tagged[1];
  // data-* attributes sometimes carry the sn directly.
  const attr =
    row.getAttribute('data-order-sn') ||
    row.getAttribute('data-ordersn') ||
    row.getAttribute('data-order_sn') ||
    row.getAttribute('data-sn');
  if (attr && /^[0-9]{8,24}$/.test(attr)) return attr;
  const loose = rowText.match(/\b([0-9]{15,24})\b/);
  return loose ? loose[1] : '';
}

function extractAmount(rowText: string): string {
  const m = rowText.match(/[¥￥]\s*([0-9]+(?:\.[0-9]{1,2})?)/);
  return m ? m[1] : '';
}

function extractStatus(rowText: string): string {
  for (const w of STATUS_WORDS) {
    if (rowText.includes(w)) return w;
  }
  return '';
}

// Best-effort product name: prefer an element whose class hints at a goods
// title; else the longest non-numeric text line in the row.
function extractProductName(row: HTMLElement, rowText: string): string {
  const titleEl = row.querySelector<HTMLElement>(
    '[class*="goods-name"], [class*="goodsName"], [class*="title"], [class*="Title"], [class*="name"], [class*="Name"]',
  );
  const titleText = textOf(titleEl);
  if (titleText && titleText.length >= 2 && !/^[¥￥\d.\s]+$/.test(titleText)) {
    return titleText.slice(0, 120);
  }
  // Fallback: scan child text fragments for the longest readable line.
  let best = '';
  for (const child of queryAll<HTMLElement>('span, div, p, a', row)) {
    const t = textOf(child);
    if (!t || t.length < 2 || t.length > 120) continue;
    if (/[¥￥]/.test(t) || /^[\d.\s/:-]+$/.test(t)) continue;
    if (STATUS_WORDS.includes(t)) continue;
    if (t.length > best.length) best = t;
  }
  if (best) return best;
  return rowText.replace(/\s+/g, ' ').slice(0, 80);
}

// Scrape whatever order rows are currently rendered. Heuristic container
// detection: elements whose class mentions "order" that contain a price, plus
// generic list cells, then de-duplicate nested matches and rows by sn/name.
function scrapeVisibleOrders(): ScrapedOrder[] {
  const candidates = new Set<HTMLElement>();
  const containerSelector = [
    '[class*="order"]',
    '[class*="Order"]',
    '[class*="orderItem"]',
    '[class*="order-item"]',
    '[class*="goods-item"]',
    '[class*="trade"]',
    'li',
  ].join(',');

  for (const el of queryAll<HTMLElement>(containerSelector)) {
    if (!isVisible(el)) continue;
    const t = textOf(el);
    if (!t) continue;
    // A real order row carries a price and is not an absurdly large wrapper.
    if (!/[¥￥]/.test(t)) continue;
    if (t.length > 600) continue;
    candidates.add(el);
  }

  // Drop containers that fully contain another candidate (keep the inner one).
  const rows = Array.from(candidates).filter(
    (el) => !Array.from(candidates).some((other) => other !== el && el.contains(other)),
  );

  const out: ScrapedOrder[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const rowText = textOf(row);
    const record: ScrapedOrder = {
      orderSn: extractOrderSn(rowText, row),
      productName: extractProductName(row, rowText),
      amount: extractAmount(rowText),
      status: extractStatus(rowText),
    };
    if (!record.amount && !record.orderSn && !record.productName) continue;
    const key = record.orderSn || `${record.productName}|${record.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(record);
  }
  return out;
}

export default defineContentScript({
  matches: ['https://mobile.yangkeduo.com/*'],
  runAt: 'document_idle',
  main() {
    // Action handler: DOM-fallback order scrape.
    onAction({
      scrapeVisibleOrders(): ActionResult {
        const orders = scrapeVisibleOrders();
        return { success: true, detail: `scraped ${orders.length} rows`, orders };
      },
      // Lightweight ping so the dashboard can confirm this tab is wired.
      pddBridgePing(): ActionResult {
        return { success: true, detail: 'pdd bridge alive', loggedIn: detectLoggedIn() };
      },
    });

    // Report page readiness once the DOM exists, then again shortly after to
    // catch the SPA hydrating its login state.
    void domReady().then(() => {
      const report = () =>
        sendDdEvent('pddPageReady', { href: location.href, loggedIn: detectLoggedIn() });
      report();
      setTimeout(report, 1500);
    });
  },
});
