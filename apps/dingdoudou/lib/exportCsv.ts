// One-click ERP export. Builds a UTF-8 (BOM) CSV of the given orders and
// triggers a download. Shared by the dashboard.

import type { Order } from './types';
import { csvHeaders } from './uiI18n';

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
  const headers = csvHeaders(lang);
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
