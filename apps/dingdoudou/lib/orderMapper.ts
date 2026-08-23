// Map a raw Pinduoduo order_list_v4 record into our normalized Order type.
// The platform response shape is not stable across versions, so every field is
// resolved defensively against several possible key names.

import type { Order, OrderStatus } from './types';
import type { PddRawOrder } from './pddClient';
import { asRecord } from './value';

function getPath(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const part of path.split('.')) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[part];
  }
  return current;
}

function pick<T>(obj: unknown, ...keys: string[]): T | undefined {
  for (const k of keys) {
    const v = getPath(obj, k);
    if (v !== undefined && v !== null && v !== '') return v as T;
  }
  return undefined;
}

// PDD numeric order_status -> our label (best-effort; falls back to 待发货).
function mapStatus(raw: unknown): OrderStatus {
  const s = String(
    pick<unknown>(raw, 'order_status_prompt', 'status_prompt', 'orderStatusPrompt') ?? '',
  );
  if (s) {
    if (s.includes('待付') || s.includes('待支付')) return '待支付';
    if (s.includes('待发') || s.includes('待成团')) return '待发货';
    if (s.includes('待收') || s.includes('已发货') || s.includes('运输')) return '待收货';
    if (s.includes('已签') || s.includes('完成') || s.includes('已收货')) return '已签收';
    if (s.includes('退款') || s.includes('退货')) return '已退款';
    if (s.includes('取消') || s.includes('关闭')) return '已取消';
  }
  const code = Number(pick<unknown>(raw, 'order_status', 'orderStatus', 'status'));
  switch (code) {
    case 0:
      return '待支付';
    case 1:
      return '待发货';
    case 2:
      return '待收货';
    case 3:
      return '已签收';
    case 4:
      return '已退款';
    case 5:
      return '已取消';
    default:
      return '待发货';
  }
}

function tsToString(v: unknown): string {
  const n = Number(v);
  if (!n) return '';
  const ms = n < 1e12 ? n * 1000 : n;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
}

export function mapRawOrder(raw: PddRawOrder, accountName: string, pddUserId: string): Order {
  const goods = asRecord(pick<unknown>(raw, 'order_goods', 'goods', 'orderGoods', 'item')) ?? raw;
  const addr = asRecord(
    pick<unknown>(raw, 'address_snapshot', 'address', 'receive_address', 'addressInfo'),
  ) ?? {};
  const quantity = Number(
    pick<unknown>(goods, 'goods_number', 'goodsNumber', 'quantity', 'num') ?? 1,
  );
  const orderAmount =
    Number(pick<unknown>(raw, 'order_amount', 'orderAmount', 'pay_amount', 'total_amount') ?? 0) /
      100 || Number(pick<unknown>(raw, 'order_amount_yuan') ?? 0);
  const unitPrice =
    Number(pick<unknown>(goods, 'goods_price', 'goodsPrice', 'sku_price', 'price') ?? 0) /
      100 || 0;

  return {
    id: String(pick(raw, 'order_sn', 'orderSn', 'order_id', 'id') ?? ''),
    accountName,
    pddUserId,
    productName: String(pick(goods, 'goods_name', 'goodsName', 'title', 'name') ?? '未知商品'),
    productImage: String(pick(goods, 'thumb_url', 'thumbUrl', 'goods_thumb_url', 'image', 'hd_thumb_url') ?? ''),
    specName: String(pick(goods, 'spec', 'sku_spec', 'goods_spec', 'specName') ?? ''),
    quantity,
    unitPrice: unitPrice || (quantity ? orderAmount / quantity : orderAmount),
    orderAmount,
    productId: String(pick(goods, 'goods_id', 'goodsId', 'product_id') ?? ''),
    specId: String(pick(goods, 'sku_id', 'skuId', 'spec_id') ?? ''),
    orderTime:
      String(pick(raw, 'order_time_text', 'orderTimeText') ?? '') ||
      tsToString(pick<unknown>(raw, 'order_time', 'orderTime', 'created_at', 'create_time')),
    status: mapStatus(raw),
    storeName: String(pick(raw, 'mall_name', 'mallName', 'store_name', 'shop_name') ?? ''),
    recipientName: String(pick(addr, 'name', 'receive_name', 'receiver') ?? ''),
    recipientPhone: String(pick(addr, 'mobile', 'phone', 'receive_mobile') ?? ''),
    recipientAddress:
      [pick(addr, 'province'), pick(addr, 'city'), pick(addr, 'district'), pick(addr, 'address', 'detail')]
        .filter(Boolean)
        .join('') || String(pick(addr, 'full_address', 'address') ?? ''),
    expressCompany: pick(raw, 'shipping_name', 'express_company', 'logistics_company') as string | undefined,
    expressNumber: pick(raw, 'tracking_number', 'express_no', 'waybill') as string | undefined,
    shippingTime: tsToString(pick<unknown>(raw, 'ship_time', 'shipping_time')) || undefined,
    latestTrack: pick(raw, 'last_track', 'logistics_text') as string | undefined,
    invoiceStatus: '未申请',
    groupBuyUrl: pick(raw, 'group_url', 'share_url') as string | undefined,
  };
}

export function mapRawOrders(raw: PddRawOrder[], accountName: string, pddUserId: string): Order[] {
  return raw.map((r) => mapRawOrder(r, accountName, pddUserId)).filter((o) => o.id);
}
