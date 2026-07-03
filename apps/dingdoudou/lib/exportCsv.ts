// One-click ERP export. Builds a UTF-8 (BOM) CSV of the given orders and
// triggers a download. Shared by the dashboard.

import type { Order } from './types';

const HEADERS_ZH = [
  '拼多多账号',
  '订单号',
  '商品ID',
  '商品名称',
  '规格',
  '规格ID',
  '数量',
  '单价',
  '应付实付',
  '订单状态',
  '店铺名称',
  '收件人姓名',
  '收件人电话',
  '收货详细地址',
  '物流公司',
  '快递单号',
  '下单时间',
];

const HEADERS_EN = [
  'Channel',
  'Order ID',
  'Item ID',
  'Item Title',
  'Variant',
  'Variant ID',
  'Qty',
  'Price',
  'Amount',
  'Status',
  'Shop Name',
  'Recipient Name',
  'Phone',
  'Address',
  'Courier',
  'Tracking No',
  'Order Date',
];

function cell(v: unknown): string {
  let s = v == null ? '' : String(v);
  // Neutralize CSV formula injection (CWE-1236): a field starting with = + - @
  // tab or CR is evaluated as a formula by Excel/WPS/LibreOffice. PDD product /
  // shop / address text is attacker-controllable, so prefix a guard quote.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  // Quote per RFC 4180 when the field contains a delimiter, quote, CR or LF.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(orders: Order[], lang: 'zh' | 'en'): string {
  const headers = lang === 'zh' ? HEADERS_ZH : HEADERS_EN;
  const lines = [headers.join(',')];
  for (const o of orders) {
    lines.push(
      [
        o.accountName,
        o.id,
        o.productId,
        o.productName,
        o.specName,
        o.specId,
        o.quantity,
        o.unitPrice,
        o.orderAmount,
        o.status,
        o.storeName,
        o.recipientName,
        o.recipientPhone,
        o.recipientAddress,
        o.expressCompany ?? '',
        o.expressNumber ?? '',
        o.orderTime,
      ]
        .map(cell)
        .join(','),
    );
  }
  return '﻿' + lines.join('\n');
}

export function downloadCsv(orders: Order[], lang: 'zh' | 'en', filename: string): void {
  const blob = new Blob([buildCsv(orders, lang)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
