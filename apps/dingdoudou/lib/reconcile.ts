// 订单核算 (Order reconciliation) — compare batches of express/tracking numbers
// against the tracking numbers found on synced orders, in BOTH directions:
//   - which batch numbers exist in the synced orders (matched)
//   - which batch numbers are missing from the synced orders
//   - which order numbers are not covered by any batch (unaccounted / extra)
//
// Pure logic only (no chrome/DOM), so it is shared by the dashboard UI and can
// also build a printable report.

import type { Order } from './types';

export interface ReconcileBatch {
  id: string;
  name: string;
  trackingNumbers: string[]; // original (display) values, deduped
  createdAt: number;
  note?: string;
}

export interface OrderRef {
  id: string;
  accountName: string;
  productName: string;
  recipientName: string;
  status: string;
  expressCompany?: string;
  expressNumber: string;
}

export interface ReconcileRow {
  tracking: string; // display value
  key: string; // normalized key
  inOrders: boolean;
  batchIds: string[]; // which batches contain this number
  order?: OrderRef;
}

export interface BatchSummary {
  batchId: string;
  batchName: string;
  total: number;
  matched: number;
  missing: number;
}

export interface ReconcileResult {
  generatedAt: number;
  batchSummaries: BatchSummary[];
  matched: ReconcileRow[]; // in a batch AND in orders
  missing: ReconcileRow[]; // in a batch, NOT in orders
  extra: ReconcileRow[]; // in orders, NOT in any batch
  totals: {
    batchNumbers: number; // distinct numbers across selected batches
    orderNumbers: number; // distinct order tracking numbers
    matched: number;
    missing: number;
    extra: number;
  };
}

// Normalize a tracking number for comparison: drop surrounding noise, upper-case,
// strip spaces / dashes / underscores so "SF-1234 5678" == "sf12345678".
export function normalizeTracking(raw: string): string {
  return (raw || '').trim().toUpperCase().replace(/[\s\-_]+/g, '');
}

// Parse a free-text blob (one per line, or comma/semicolon/space separated) into
// a deduped list of original tracking strings.
export function parseTrackingInput(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of (text || '').split(/[\s,;，；、]+/)) {
    const t = piece.trim();
    if (!t) continue;
    const key = normalizeTracking(t);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function orderRef(o: Order): OrderRef {
  return {
    id: o.id,
    accountName: o.accountName,
    productName: o.productName,
    recipientName: o.recipientName,
    status: o.status,
    expressCompany: o.expressCompany,
    expressNumber: o.expressNumber || '',
  };
}

// Reconcile the given batches against the orders. An input number is treated as
// a hit when it equals EITHER an order's express/tracking number OR its order
// number (order_sn) — "逐一和订单号和快递号对比，只有有一个对上就提示".
export function reconcile(batches: ReconcileBatch[], orders: Order[]): ReconcileResult {
  // Map normalized key -> order, indexing BOTH the express number and the order id.
  const orderByKey = new Map<string, Order>();
  for (const o of orders) {
    const ek = normalizeTracking(o.expressNumber || '');
    const ik = normalizeTracking(o.id || '');
    if (ek) orderByKey.set(ek, o);
    if (ik) orderByKey.set(ik, o);
  }

  // Collect batch numbers: key -> { display, batchIds }
  const batchByKey = new Map<string, { display: string; batchIds: string[] }>();
  for (const b of batches) {
    for (const tn of b.trackingNumbers) {
      const key = normalizeTracking(tn);
      if (!key) continue;
      const existing = batchByKey.get(key);
      if (existing) {
        if (!existing.batchIds.includes(b.id)) existing.batchIds.push(b.id);
      } else {
        batchByKey.set(key, { display: tn, batchIds: [b.id] });
      }
    }
  }

  const matched: ReconcileRow[] = [];
  const missing: ReconcileRow[] = [];
  for (const [key, info] of batchByKey) {
    const order = orderByKey.get(key);
    const row: ReconcileRow = {
      tracking: info.display,
      key,
      inOrders: !!order,
      batchIds: info.batchIds,
      order: order ? orderRef(order) : undefined,
    };
    if (order) matched.push(row);
    else missing.push(row);
  }

  // Extra: order numbers not present in any selected batch.
  const extra: ReconcileRow[] = [];
  for (const [key, o] of orderByKey) {
    if (!batchByKey.has(key)) {
      extra.push({
        tracking: o.expressNumber || '',
        key,
        inOrders: true,
        batchIds: [],
        order: orderRef(o),
      });
    }
  }

  const batchSummaries: BatchSummary[] = batches.map((b) => {
    let m = 0;
    let total = 0;
    const counted = new Set<string>();
    for (const tn of b.trackingNumbers) {
      const key = normalizeTracking(tn);
      if (!key || counted.has(key)) continue;
      counted.add(key);
      total++;
      if (orderByKey.has(key)) m++;
    }
    return { batchId: b.id, batchName: b.name, total, matched: m, missing: total - m };
  });

  return {
    generatedAt: Date.now(),
    batchSummaries,
    matched,
    missing,
    extra,
    totals: {
      batchNumbers: batchByKey.size,
      orderNumbers: orderByKey.size,
      matched: matched.length,
      missing: missing.length,
      extra: extra.length,
    },
  };
}

// Build a self-contained printable HTML report.
export function buildReportHtml(
  result: ReconcileResult,
  batches: ReconcileBatch[],
  lang: 'zh' | 'en',
): string {
  const zh = lang === 'zh';
  const T = {
    title: zh ? '订多多 · 订单快递核算报表' : 'DingDuoDuo · Order Reconciliation Report',
    generated: zh ? '生成时间' : 'Generated',
    overview: zh ? '核算概览' : 'Overview',
    batchNumbers: zh ? '批次单号总数' : 'Batch numbers',
    orderNumbers: zh ? '订单单号总数' : 'Order numbers',
    matched: zh ? '匹配命中' : 'Matched',
    missing: zh ? '批次缺失(未在订单中)' : 'Missing (not in orders)',
    extra: zh ? '订单多余(未在批次中)' : 'Unaccounted (not in batches)',
    batchSummary: zh ? '各批次命中情况' : 'Per-batch summary',
    batch: zh ? '批次' : 'Batch',
    total: zh ? '单号数' : 'Count',
    tracking: zh ? '快递单号' : 'Tracking No',
    order: zh ? '订单号' : 'Order',
    account: zh ? '账号' : 'Account',
    product: zh ? '商品' : 'Product',
    recipient: zh ? '收件人' : 'Recipient',
    status: zh ? '状态' : 'Status',
    inBatches: zh ? '所属批次' : 'In batches',
  };
  const esc = (s: unknown) =>
    String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const batchName = (id: string) => batches.find((b) => b.id === id)?.name ?? id;
  const dt = new Date(result.generatedAt).toLocaleString(zh ? 'zh-CN' : 'en-US');

  const summaryRows = result.batchSummaries
    .map(
      (s) =>
        `<tr><td>${esc(s.batchName)}</td><td>${s.total}</td><td class="ok">${s.matched}</td><td class="bad">${s.missing}</td></tr>`,
    )
    .join('');

  const matchedRows = result.matched
    .map(
      (r) =>
        `<tr><td>${esc(r.tracking)}</td><td>${esc(r.order?.id)}</td><td>${esc(r.order?.accountName)}</td><td>${esc(
          r.order?.recipientName,
        )}</td><td>${esc(r.order?.status)}</td><td>${esc(r.batchIds.map(batchName).join(' / '))}</td></tr>`,
    )
    .join('');

  const missingRows = result.missing
    .map((r) => `<tr><td>${esc(r.tracking)}</td><td>${esc(r.batchIds.map(batchName).join(' / '))}</td></tr>`)
    .join('');

  const extraRows = result.extra
    .map(
      (r) =>
        `<tr><td>${esc(r.tracking)}</td><td>${esc(r.order?.id)}</td><td>${esc(r.order?.accountName)}</td><td>${esc(
          r.order?.recipientName,
        )}</td><td>${esc(r.order?.status)}</td></tr>`,
    )
    .join('');

  return `<!doctype html><html lang="${zh ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"/>
<title>${esc(T.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; color: #0f172a; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 22px 0 8px; border-left: 4px solid #2563eb; padding-left: 8px; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 12px; }
  .cards { display: flex; gap: 10px; flex-wrap: wrap; }
  .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; min-width: 120px; }
  .card .n { font-size: 22px; font-weight: 800; }
  .card .l { font-size: 11px; color: #64748b; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
  th, td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; }
  th { background: #f1f5f9; }
  .ok { color: #059669; font-weight: 700; }
  .bad { color: #dc2626; font-weight: 700; }
  .empty { color: #94a3b8; font-style: italic; padding: 8px 0; }
  @media print { body { margin: 8px; } h2 { page-break-after: avoid; } tr { page-break-inside: avoid; } }
</style></head><body>
<h1>${esc(T.title)}</h1>
<div class="meta">${esc(T.generated)}: ${esc(dt)}</div>
<h2>${esc(T.overview)}</h2>
<div class="cards">
  <div class="card"><div class="n">${result.totals.batchNumbers}</div><div class="l">${esc(T.batchNumbers)}</div></div>
  <div class="card"><div class="n">${result.totals.orderNumbers}</div><div class="l">${esc(T.orderNumbers)}</div></div>
  <div class="card"><div class="n ok">${result.totals.matched}</div><div class="l">${esc(T.matched)}</div></div>
  <div class="card"><div class="n bad">${result.totals.missing}</div><div class="l">${esc(T.missing)}</div></div>
  <div class="card"><div class="n">${result.totals.extra}</div><div class="l">${esc(T.extra)}</div></div>
</div>
<h2>${esc(T.batchSummary)}</h2>
<table><thead><tr><th>${esc(T.batch)}</th><th>${esc(T.total)}</th><th>${esc(T.matched)}</th><th>${esc(T.missing)}</th></tr></thead>
<tbody>${summaryRows || `<tr><td colspan="4" class="empty">-</td></tr>`}</tbody></table>
<h2>${esc(T.matched)} (${result.totals.matched})</h2>
<table><thead><tr><th>${esc(T.tracking)}</th><th>${esc(T.order)}</th><th>${esc(T.account)}</th><th>${esc(T.recipient)}</th><th>${esc(T.status)}</th><th>${esc(T.inBatches)}</th></tr></thead>
<tbody>${matchedRows || `<tr><td colspan="6" class="empty">-</td></tr>`}</tbody></table>
<h2>${esc(T.missing)} (${result.totals.missing})</h2>
<table><thead><tr><th>${esc(T.tracking)}</th><th>${esc(T.inBatches)}</th></tr></thead>
<tbody>${missingRows || `<tr><td colspan="2" class="empty">-</td></tr>`}</tbody></table>
<h2>${esc(T.extra)} (${result.totals.extra})</h2>
<table><thead><tr><th>${esc(T.tracking)}</th><th>${esc(T.order)}</th><th>${esc(T.account)}</th><th>${esc(T.recipient)}</th><th>${esc(T.status)}</th></tr></thead>
<tbody>${extraRows || `<tr><td colspan="5" class="empty">-</td></tr>`}</tbody></table>
<script>window.onload = function () { setTimeout(function () { try { window.print(); } catch (e) {} }, 300); };</script>
</body></html>`;
}
