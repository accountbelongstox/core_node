import { BaseAPI } from '../../../core/api-libs/laravel/transport/BaseAPI';

/**
 * PddAdminAPI
 *
 * One method per endpoint of the 订多多 (Pinduoduo SaaS) admin contract documented
 * in apps/ddk2/docs/PDD_ADMIN_PAYMENT_SPEC.md. All paths live under the module
 * prefix `/api/pdd/admin` and use the shared authenticated Laravel transport.
 *
 * Standard BaseAPI envelope for every JSON endpoint: { success, data?, message? }.
 * Each method shape-guards the reply and returns a safe default when the request
 * fails so callers never have to special-case a missing backend.
 */

export interface PddStats {
  users_total: number;
  users_active: number;
  expiring_7d: number;
  revenue_total: number;
  revenue_30d: number;
  pdd_accounts_total: number;
}

export interface PddUserAdmin {
  id: number;
  username: string;
  package_name: string;
  valid_until: string | null;
  is_expired: boolean;
  points: number;
  max_orders: number;
  max_pdd_accounts: number;
  pdd_accounts_count: number;
  disabled: boolean;
  created_at: string;
  last_login: string | null;
}

export interface PddUserUsage {
  batch_orders: number;
  bind_count: number;
  last_login: string | null;
}

export type PddRechargeMethod = 'alipay' | 'wechat';
export type PddRechargeStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface PddRecharge {
  id: number;
  user_id: number;
  username: string;
  amount: number;
  method: PddRechargeMethod;
  status: PddRechargeStatus;
  out_trade_no: string;
  package_name?: string;
  grant_days?: number;
  created_at: string;
  paid_at?: string | null;
}

export interface PddUserDetail {
  user: PddUserAdmin;
  usage: PddUserUsage;
  recharges: PddRecharge[];
}

export interface PddUserListResponse {
  data: PddUserAdmin[];
  total: number;
  page: number;
  per_page: number;
}

export interface PddRechargeListResponse {
  data: PddRecharge[];
  total: number;
}

export type PddPackageCode = 'TRIAL' | 'PRO' | 'PRO_PLUS' | 'ULTIMATE';

export interface PddPackage {
  code: PddPackageCode | string;
  name: string;
  price_month: number;
  price_year: number;
  max_orders: number;
  max_pdd_accounts: number;
  enabled: boolean;
}

export interface PddGatewayPublic {
  enabled: boolean;
  /** Alipay app_id / WeChat mch_id (non-secret identifier). */
  app_id?: string;
  mch_id?: string;
  /** Whether the secret credentials are present server-side. */
  configured: boolean;
}

export interface PddPaymentSettingsPublic {
  alipay: PddGatewayPublic;
  wechat: PddGatewayPublic;
}

/** Write payload for /payment-settings. Secret fields are write-only (omit to keep). */
export interface PddPaymentSettingsSave {
  alipay: {
    enabled: boolean;
    app_id?: string;
    private_key?: string;
    public_key?: string;
  };
  wechat: {
    enabled: boolean;
    mch_id?: string;
    app_id?: string;
    api_v3_key?: string;
    cert_serial?: string;
  };
}

/** Body for POST /users/{id}/membership. All fields optional (set what you change). */
export interface PddSetMembershipPayload {
  package_name?: string;
  valid_until?: string;
  extend_days?: number;
  max_orders?: number;
  max_pdd_accounts?: number;
}

export class PddAdminAPI extends BaseAPI {
  /** GET /stats — overview cards. */
  async getStats(): Promise<PddStats | null> {
    const res = await this.get<PddStats>('stats');
    if (!res.success || !res.data) return null;
    return res.data as PddStats;
  }

  /**
   * GET /users?search=&page=&per_page=&package=&expired= — paginated user list.
   */
  async listUsers(params: {
    search?: string;
    page?: number;
    per_page?: number;
    package?: string;
    expired?: boolean;
  } = {}): Promise<PddUserListResponse> {
    const res = await this.get<PddUserListResponse>('users', {
      search: params.search,
      page: params.page,
      per_page: params.per_page,
      package: params.package,
      expired: params.expired,
    });
    if (!res.success || !res.data) {
      return { data: [], total: 0, page: params.page || 1, per_page: params.per_page || 20 };
    }
    return res.data as PddUserListResponse;
  }

  /** GET /users/{id} — user detail + usage + recharges. */
  async getUser(id: number): Promise<PddUserDetail | null> {
    const res = await this.get<PddUserDetail>(`users/${encodeURIComponent(String(id))}`);
    if (!res.success || !res.data) return null;
    return res.data as PddUserDetail;
  }

  /** POST /users/{id}/membership — set tier / extend / limits. Returns updated user. */
  async setMembership(id: number, payload: PddSetMembershipPayload): Promise<PddUserAdmin> {
    const res = await this.post<PddUserAdmin>(
      `users/${encodeURIComponent(String(id))}/membership`,
      payload
    );
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to update membership');
    }
    return res.data as PddUserAdmin;
  }

  /** POST /users/{id}/points — adjust point balance. Returns new balance. */
  async adjustPoints(id: number, delta: number, reason: string): Promise<{ points: number }> {
    const res = await this.post<{ points: number }>(
      `users/${encodeURIComponent(String(id))}/points`,
      { delta, reason }
    );
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to adjust points');
    }
    return res.data as { points: number };
  }

  /** POST /users/{id}/enable — re-enable an account. */
  async enableUser(id: number): Promise<boolean> {
    const res = await this.post<{ ok: boolean }>(`users/${encodeURIComponent(String(id))}/enable`);
    if (!res.success) throw new Error(res.error || 'Failed to enable user');
    return true;
  }

  /** POST /users/{id}/disable — disable an account. */
  async disableUser(id: number): Promise<boolean> {
    const res = await this.post<{ ok: boolean }>(`users/${encodeURIComponent(String(id))}/disable`);
    if (!res.success) throw new Error(res.error || 'Failed to disable user');
    return true;
  }

  /** GET /recharges?status=&page= — recharge / payment records. */
  async listRecharges(params: {
    status?: PddRechargeStatus | '';
    page?: number;
  } = {}): Promise<PddRechargeListResponse> {
    const res = await this.get<PddRechargeListResponse>('recharges', {
      status: params.status ? params.status : undefined,
      page: params.page,
    });
    if (!res.success || !res.data) {
      return { data: [], total: 0 };
    }
    return res.data as PddRechargeListResponse;
  }

  /** GET /memberships/expiring?days=7 — expiry management list. */
  async listExpiring(days: number = 7): Promise<PddUserAdmin[]> {
    const res = await this.get<{ data: PddUserAdmin[] }>('memberships/expiring', { days });
    if (!res.success || !res.data) return [];
    return (res.data as { data: PddUserAdmin[] }).data ?? [];
  }

  /** GET /payment-settings — gateway config (no secrets in clear). */
  async getPaymentSettings(): Promise<PddPaymentSettingsPublic | null> {
    const res = await this.get<PddPaymentSettingsPublic>('payment-settings');
    if (!res.success || !res.data) return null;
    return res.data as PddPaymentSettingsPublic;
  }

  /** POST /payment-settings — save gateway config (write-only secrets). */
  async savePaymentSettings(payload: PddPaymentSettingsSave): Promise<PddPaymentSettingsPublic> {
    const res = await this.post<PddPaymentSettingsPublic>('payment-settings', payload);
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to save payment settings');
    }
    return res.data as PddPaymentSettingsPublic;
  }

  /** GET /packages — tier price table. */
  async listPackages(): Promise<PddPackage[]> {
    const res = await this.get<{ data: PddPackage[] }>('packages');
    if (!res.success || !res.data) return [];
    return (res.data as { data: PddPackage[] }).data ?? [];
  }

  /** POST /packages — upsert tier prices. Returns the new table. */
  async savePackages(packages: PddPackage[]): Promise<PddPackage[]> {
    const res = await this.post<{ data: PddPackage[] }>('packages', { data: packages });
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to save packages');
    }
    return (res.data as { data: PddPackage[] }).data ?? [];
  }
}
