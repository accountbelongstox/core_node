import { BaseAPI } from '../../../core/integrations/laravel/transport/BaseAPI';
import {
  createLaravelModuleConfig,
  LARAVEL_API_PREFIX,
} from '../../../core/integrations/laravel/transport/ApiContract';
import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import {
  CM_ADMIN_PAGE_SIZE,
  type CmAdminActivityRow,
  type CmAdminContactMessageRow,
  type CmAdminDepositRow,
  type CmAdminDisputeResolution,
  type CmAdminEscrowRow,
  type CmAdminKycDocument,
  type CmAdminKycRecord,
  type CmAdminOverviewData,
  type CmAdminPage,
  type CmAdminPaymentRow,
  type CmAdminPolicy,
  type CmAdminProjectRow,
  type CmAdminQuery,
  type CmAdminRefundRow,
  type CmAdminReviewerApplicationRow,
  type CmAdminTestimonialRow,
  type CmAdminUserDetail,
  type CmAdminUserRow,
  type CmAdminWithdrawalRow,
} from './CmAdminTypes';

type CmAdminListResponse<T> = Promise<APIResponse<CmAdminPage<T>>>;

function cleanQuery(query: CmAdminQuery): Record<string, string | number> {
  const cleaned: Record<string, string | number> = { page_size: CM_ADMIN_PAGE_SIZE };
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) return;
    const text = String(value).trim();
    if (text !== '') cleaned[key] = typeof value === 'number' ? value : text;
  });
  return cleaned;
}

function normalizePage<T>(response: APIResponse<unknown>, itemsKey = 'items'): APIResponse<CmAdminPage<T>> {
  if (!response.success || !response.data || typeof response.data !== 'object') {
    return { ...response, data: null } as APIResponse<CmAdminPage<T>>;
  }
  const source = response.data as Record<string, unknown>;
  const rawItems = source[itemsKey] ?? source.items;
  const items = Array.isArray(rawItems) ? rawItems as T[] : [];
  const total = typeof source.total === 'number' ? source.total : items.length;
  const pageSize = typeof source.page_size === 'number' && source.page_size > 0 ? source.page_size : CM_ADMIN_PAGE_SIZE;
  const page = typeof source.page === 'number' ? source.page : 1;
  const totalPages = typeof source.total_pages === 'number'
    ? source.total_pages
    : Math.ceil(total / pageSize);
  return { ...response, data: { items, total, page, page_size: pageSize, total_pages: Math.max(1, totalPages) } };
}

export class CmAdminApi extends BaseAPI {
  constructor() {
    super(createLaravelModuleConfig(LARAVEL_API_PREFIX.codeMartV1));
  }

  private async list<T>(path: string, query: CmAdminQuery, itemsKey = 'items'): CmAdminListResponse<T> {
    const response = await this.get<unknown>(path, cleanQuery(query));
    return normalizePage<T>(response, itemsKey);
  }

  overview(): Promise<APIResponse<CmAdminOverviewData>> {
    return this.get<CmAdminOverviewData>('admin/overview');
  }

  policy(): Promise<APIResponse<CmAdminPolicy>> {
    return this.get<CmAdminPolicy>('admin/policy');
  }

  users(query: CmAdminQuery): CmAdminListResponse<CmAdminUserRow> {
    return this.list<CmAdminUserRow>('admin/users', query, 'users');
  }

  userDetail(userId: number): Promise<APIResponse<CmAdminUserDetail>> {
    return this.get<CmAdminUserDetail>(`admin/users/${userId}`);
  }

  grantRole(userId: number, roleType: string, status: string, reason: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/users/${userId}/roles`, { role_type: roleType, status, reason: reason || undefined });
  }

  setRoleStatus(userId: number, roleType: string, status: string, reason: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/users/${userId}/roles/${encodeURIComponent(roleType)}/status`, { status, reason: reason || undefined });
  }

  kyc(query: CmAdminQuery): CmAdminListResponse<CmAdminKycRecord> {
    return this.list<CmAdminKycRecord>('admin/kyc', query);
  }

  approveKyc(kycId: number, notes: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/kyc/${kycId}/approve`, { notes: notes || undefined });
  }

  rejectKyc(kycId: number, notes: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/kyc/${kycId}/reject`, { notes });
  }

  /** Private KYC document streamed with the bearer session, returned as a blob. */
  async kycFile(kycId: number, type: CmAdminKycDocument): Promise<APIResponse<Blob>> {
    try {
      const response = await this.rawRequest(`admin/kyc/${kycId}/files/${type}`, { method: 'GET' });
      if (response.ok) {
        return { success: true, data: await response.blob(), error: null, status: response.status };
      }
      let errorCode: string | undefined;
      try {
        const payload = await response.json() as Record<string, unknown>;
        errorCode = typeof payload.error_code === 'string' ? payload.error_code : undefined;
      } catch {
        errorCode = undefined;
      }
      return { success: false, data: null, error: response.statusText, status: response.status, debugInfo: { error_code: errorCode } };
    } catch (error) {
      return { success: false, data: null, error: String(error), status: 0, isNetworkError: true };
    }
  }

  deposits(query: CmAdminQuery): CmAdminListResponse<CmAdminDepositRow> {
    return this.list<CmAdminDepositRow>('admin/deposits', query);
  }

  confirmDeposit(depositId: number): Promise<APIResponse<unknown>> {
    return this.post(`admin/deposits/${depositId}/confirm`, {});
  }

  rejectDeposit(depositId: number, notes: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/deposits/${depositId}/reject`, { notes });
  }

  refundDeposit(depositId: number, notes: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/deposits/${depositId}/refund`, { notes: notes || undefined });
  }

  refunds(query: CmAdminQuery): CmAdminListResponse<CmAdminRefundRow> {
    return this.list<CmAdminRefundRow>('admin/refunds', query);
  }

  approveRefund(refundId: number, notes: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/refunds/${refundId}/approve`, { notes: notes || undefined });
  }

  rejectRefund(refundId: number, notes: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/refunds/${refundId}/reject`, { notes });
  }

  processRefund(refundId: number, notes: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/refunds/${refundId}/process`, { notes: notes || undefined });
  }

  withdrawals(query: CmAdminQuery): CmAdminListResponse<CmAdminWithdrawalRow> {
    return this.list<CmAdminWithdrawalRow>('admin/withdrawals', query);
  }

  approveWithdrawal(withdrawalId: number, notes: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/withdrawals/${withdrawalId}/approve`, { notes: notes || undefined });
  }

  rejectWithdrawal(withdrawalId: number, notes: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/withdrawals/${withdrawalId}/reject`, { notes });
  }

  payWithdrawal(withdrawalId: number, notes: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/withdrawals/${withdrawalId}/pay`, { notes: notes || undefined });
  }

  payments(query: CmAdminQuery): CmAdminListResponse<CmAdminPaymentRow> {
    return this.list<CmAdminPaymentRow>('admin/payments', query);
  }

  escrows(query: CmAdminQuery): CmAdminListResponse<CmAdminEscrowRow> {
    return this.list<CmAdminEscrowRow>('admin/escrows', query);
  }

  resolveDispute(paymentId: number, resolution: CmAdminDisputeResolution, notes: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/payments/${paymentId}/resolve-dispute`, { resolution, notes: notes || undefined });
  }

  projects(query: CmAdminQuery): CmAdminListResponse<CmAdminProjectRow> {
    return this.list<CmAdminProjectRow>('admin/projects', query);
  }

  setProjectStatus(projectId: number, toStatus: string, reason: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/projects/${projectId}/status`, { to_status: toStatus, reason });
  }

  testimonials(query: CmAdminQuery): CmAdminListResponse<CmAdminTestimonialRow> {
    return this.list<CmAdminTestimonialRow>('admin/testimonials', query);
  }

  approveTestimonial(testimonialId: number): Promise<APIResponse<unknown>> {
    return this.post(`admin/testimonials/${testimonialId}/approve`, {});
  }

  hideTestimonial(testimonialId: number): Promise<APIResponse<unknown>> {
    return this.post(`admin/testimonials/${testimonialId}/hide`, {});
  }

  updateTestimonial(testimonialId: number, payload: Record<string, unknown>): Promise<APIResponse<unknown>> {
    return this.put(`admin/testimonials/${testimonialId}`, payload);
  }

  reviewerApplications(query: CmAdminQuery): CmAdminListResponse<CmAdminReviewerApplicationRow> {
    return this.list<CmAdminReviewerApplicationRow>('admin/reviewer-applications', query);
  }

  revokeReviewer(applicationId: number, reason: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/reviewer-applications/${applicationId}/revoke`, { reason });
  }

  contactMessages(query: CmAdminQuery): CmAdminListResponse<CmAdminContactMessageRow> {
    return this.list<CmAdminContactMessageRow>('admin/contact-messages', query);
  }

  handleContactMessage(messageId: number): Promise<APIResponse<unknown>> {
    return this.post(`admin/contact-messages/${messageId}/handle`, {});
  }

  activity(query: CmAdminQuery): CmAdminListResponse<CmAdminActivityRow> {
    return this.list<CmAdminActivityRow>('admin/activity', query);
  }
}

export const cmAdminApi = new CmAdminApi();
