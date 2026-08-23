// Shared domain types for 订多多 (DingDuoDuo).
// These are the single source of truth shared by background, dashboard, popup and content scripts.

export type OrderStatus =
  | '待支付'
  | '待发货'
  | '待收货'
  | '已签收'
  | '已退款'
  | '已取消';

export type InvoiceStatus = '未申请' | '已申请' | '已下载';

export interface OrderTrack {
  time: string;
  description: string;
}

export interface Order {
  id: string; // 订单号 / order_sn
  accountName: string; // 拼多多账号名 (nickname of bound account)
  pddUserId?: string; // owning pdd_user_id (multi-account routing key)
  productName: string;
  productImage: string;
  specName: string;
  quantity: number;
  unitPrice: number;
  orderAmount: number;
  productId: string; // goods_id
  specId: string; // sku_id
  orderTime: string; // YYYY/MM/DD HH:mm:ss
  status: OrderStatus;
  storeName: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  expressCompany?: string;
  expressNumber?: string;
  shippingTime?: string;
  latestTrack?: string;
  trackingDetails?: OrderTrack[];
  selected?: boolean; // UI multi-select (not persisted server-side)
  invoiceStatus?: InvoiceStatus;
  groupBuyUrl?: string;
}

export interface PinduoduoAccount {
  id: string; // internal id (pdd_<pddUserId>)
  pddUserId: string; // pdd_user_id cookie value
  name: string; // nickname
  avatar: string;
  bindTime: string;
  status: 'ACTIVE' | 'EXPIRED';
  mobileBind?: string;
}

export interface AccountState {
  accounts: PinduoduoAccount[];
  activePddUserId?: string;
}

// Credentials captured from a logged-in Pinduoduo tab. Stored locally only.
export interface PddCredential {
  pddUserId: string;
  accessToken: string; // PDDAccessToken
  cookie?: string; // full cookie string fallback
  capturedAt: number;
}

export interface AccountStats {
  edition: string;
  pddBindedCount: number;
  pddMaxBinds: number;
  maxOrdersLimit: number;
  remainingDays: string;
  balance: number;
  paymentType: string;
  rebatePercent: number;
}

// --- Licensing / Super-code ---

export type LicenseMode = 'super' | 'member' | 'locked';

export interface LicenseState {
  mode: LicenseMode;
  // For super-code mode: the entered code. For member mode: the member token.
  code?: string;
  token?: string;
  tier: string; // e.g. 'unlimited' | 'pro' | 'free'
  features: string[]; // granted feature flags ('*' = all)
  maxBinds: number; // max manageable pdd accounts (cross-user management)
  expiresAt: number | null; // epoch ms, null = never
  label?: string; // human label from backend
  verifiedAt: number; // last verification time
  offline: boolean; // true when validated without backend (super-code)
}

export interface BackendConfig {
  baseUrl: string; // e.g. http://127.0.0.1:9000
  memberToken?: string; // member login token used when no super-code
  deviceId: string; // stable per-install device id
}

// All granted feature flags. '*' on a super-code license unlocks everything.
export const ALL_FEATURES = [
  'order.sync',
  'order.export',
  'order.batch',
  'order.pay',
  'order.refund',
  'order.invoice',
  'account.multi',
  'account.cross',
  'automation.payment',
  'automation.address',
] as const;

export type FeatureFlag = (typeof ALL_FEATURES)[number];
