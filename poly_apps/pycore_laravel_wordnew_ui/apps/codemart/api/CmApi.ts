import { BaseAPI } from '../../../core/integrations/laravel/transport/BaseAPI';
import {
  createLaravelModuleConfig,
  LARAVEL_API_PREFIX,
} from '../../../core/integrations/laravel/transport/ApiContract';
import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import { setAuthToken } from '../../../core/auth/AuthSession';
import type {
  CmAdminDeposit,
  CmAdminKycItem,
  CmAdminOverview,
  CmAdminRefund,
  CmAdminUser,
  CmAiAnalysis,
  CmArchitectEligibility,
  CmArchitectTasks,
  CmBootstrap,
  CmDepositInfo,
  CmEstimateInput,
  CmEstimateResult,
  CmNotification,
  CmPage,
  CmPayment,
  CmProfileResponse,
  CmProject,
  CmProjectDetail,
  CmPublicHomeData,
  CmPublicHomeLoadResult,
  CmPublicTestimonialData,
  CmRegisterPayload,
  CmRegisterResult,
  CmReviewerApplicationStart,
  CmReviewerTestResult,
  CmReviewSubmission,
  CmTask,
  CmWallet,
  CmWalletTransaction,
} from './CmApiTypes';

const PUBLIC_HOME_CACHE_TTL_MS = 60_000;

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeTestimonial(value: unknown): CmPublicTestimonialData | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const id = asNullableString(source.id);
  const quote = asNullableString(source.quote);
  const authorLabel = asNullableString(source.author_label);
  const roleLabel = asNullableString(source.role_label);
  if (!id || !quote || !authorLabel || !roleLabel) return null;
  return {
    id,
    quote,
    author_label: authorLabel,
    role_label: roleLabel,
    avatar_url: asNullableString(source.avatar_url),
  };
}

function normalizePublicHome(value: unknown): CmPublicHomeData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const testimonials = Array.isArray(source.testimonials)
    ? source.testimonials.map(normalizeTestimonial).filter((item): item is CmPublicTestimonialData => item !== null)
    : [];
  return {
    total_amount: asNullableString(source.total_amount),
    currency: asNullableString(source.currency),
    project_count: asNullableNumber(source.project_count),
    developer_count: asNullableNumber(source.developer_count),
    testimonials,
  };
}

export class CmApi extends BaseAPI {
  constructor() {
    super(createLaravelModuleConfig(LARAVEL_API_PREFIX.codeMartV1));
  }

  async getPublicHome(): Promise<CmPublicHomeLoadResult> {
    const response = await this.get<unknown>(
      'public/home',
      undefined,
      true,
      PUBLIC_HOME_CACHE_TTL_MS,
      false,
    );
    if (!response.success) {
      return {
        data: null,
        errorCode: typeof response.debugInfo?.error_code === 'string'
          ? response.debugInfo.error_code
          : 'public_home_unavailable',
      };
    }
    return {
      data: normalizePublicHome(response.data),
      errorCode: null,
    };
  }

  /** Register through the shared identity; on success adopt the bearer session. */
  async register(payload: CmRegisterPayload): Promise<APIResponse<CmRegisterResult>> {
    const response = await this.post<CmRegisterResult>('auth/register', payload);
    if (response.success && response.data?.token) {
      setAuthToken(response.data.token);
    }
    return response;
  }

  async getBootstrap(): Promise<APIResponse<CmBootstrap>> {
    return this.get<CmBootstrap>('bootstrap');
  }

  async getProfile(): Promise<APIResponse<CmProfileResponse>> {
    return this.get<CmProfileResponse>('profile');
  }

  async updateProfile(payload: Record<string, unknown>): Promise<APIResponse<CmProfileResponse>> {
    return this.put<CmProfileResponse>('profile', payload);
  }

  async getProjects(params?: Record<string, unknown>): Promise<APIResponse<unknown>> {
    return this.get<unknown>('projects', params as Record<string, any>);
  }

  async createProject(payload: Record<string, unknown>): Promise<APIResponse<CmProject>> {
    return this.post<CmProject>('projects', payload);
  }

  async getProject(projectId: number): Promise<APIResponse<CmProjectDetail>> {
    return this.get<CmProjectDetail>(`projects/${projectId}`);
  }

  async publishProject(projectId: number): Promise<APIResponse<unknown>> {
    return this.post<unknown>(`projects/${projectId}/publish`, {});
  }

  async browseMarketplace(params?: Record<string, unknown>): Promise<APIResponse<unknown>> {
    return this.get<unknown>('marketplace/tasks', params as Record<string, any>);
  }

  async acceptTask(taskId: number): Promise<APIResponse<unknown>> {
    return this.post<unknown>(`marketplace/tasks/${taskId}/accept`, {});
  }

  async getMyTasks(): Promise<APIResponse<unknown>> {
    return this.get<unknown>('marketplace/my-tasks');
  }

  async getWallet(): Promise<APIResponse<CmWallet>> {
    return this.get<CmWallet>('wallet');
  }

  async getWalletTransactions(params?: Record<string, unknown>): Promise<APIResponse<unknown>> {
    return this.get<unknown>('wallet/transactions', params as Record<string, any>);
  }

  async getDepositInfo(): Promise<APIResponse<CmDepositInfo>> {
    return this.get<CmDepositInfo>('deposits/info');
  }

  async createDeposit(amount: number, paymentMethod: string): Promise<APIResponse<unknown>> {
    return this.post<unknown>('deposits', { amount, payment_method: paymentMethod });
  }

  async confirmDeposit(depositId: number): Promise<APIResponse<unknown>> {
    return this.post<unknown>(`deposits/${depositId}/confirm`, {});
  }

  async getDepositHistory(): Promise<APIResponse<unknown>> {
    return this.get<unknown>('deposits/history');
  }

  async estimate(input: CmEstimateInput): Promise<APIResponse<CmEstimateResult>> {
    return this.post<CmEstimateResult>('public/estimate', input);
  }

  async getNotifications(page = 1): Promise<APIResponse<CmPage<CmNotification>>> {
    return this.get<CmPage<CmNotification>>('notifications', { page });
  }

  async getUnreadCount(): Promise<APIResponse<{ unread: number }>> {
    return this.get<{ unread: number }>('notifications/unread-count');
  }

  async markNotificationRead(notificationId: number): Promise<APIResponse<{ unread: number }>> {
    return this.post<{ unread: number }>(`notifications/${notificationId}/read`, {});
  }

  async markAllNotificationsRead(): Promise<APIResponse<{ unread: number }>> {
    return this.post<{ unread: number }>('notifications/read-all', {});
  }

  async adminOverview(): Promise<APIResponse<CmAdminOverview>> {
    return this.get<CmAdminOverview>('admin/overview');
  }

  async adminUsers(search: string, page = 1): Promise<APIResponse<{ total: number; users: CmAdminUser[] }>> {
    return this.get('admin/users', { search, page });
  }

  async adminSetRoleStatus(userId: number, roleType: string, status: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/users/${userId}/roles/${roleType}/status`, { status });
  }

  async adminKycList(status: string, page = 1): Promise<APIResponse<{ total: number; items: CmAdminKycItem[] }>> {
    return this.get('admin/kyc', { status, page });
  }

  async adminKycApprove(kycId: number): Promise<APIResponse<unknown>> {
    return this.post(`admin/kyc/${kycId}/approve`, {});
  }

  async adminKycReject(kycId: number, notes: string): Promise<APIResponse<unknown>> {
    return this.post(`admin/kyc/${kycId}/reject`, { notes });
  }

  async adminRefunds(status = '', page = 1): Promise<APIResponse<{ total: number; items: CmAdminRefund[] }>> {
    return this.get('admin/refunds', { status, page });
  }

  async adminDeposits(status = '', page = 1): Promise<APIResponse<{ total: number; items: CmAdminDeposit[] }>> {
    return this.get('admin/deposits', { status, page });
  }

  async adminConfirmDeposit(depositId: number): Promise<APIResponse<unknown>> {
    return this.post(`admin/deposits/${depositId}/confirm`, {});
  }

  async adminProjects(status = '', page = 1): Promise<APIResponse<{ total: number; items: CmProject[] }>> {
    return this.get('admin/projects', { status, page });
  }

  async getTask(taskId: number): Promise<APIResponse<unknown>> {
    return this.get<unknown>(`tasks/${taskId}`);
  }

  async submitTask(taskId: number, submissionNote: string): Promise<APIResponse<unknown>> {
    return this.post<unknown>(`tasks/${taskId}/submit`, { submission_note: submissionNote });
  }

  async addTaskComment(taskId: number, comment: string): Promise<APIResponse<unknown>> {
    return this.post<unknown>(`tasks/${taskId}/comments`, { comment });
  }

  async reviewSubmission(submissionId: number, payload: Record<string, unknown>): Promise<APIResponse<unknown>> {
    return this.post<unknown>(`submissions/${submissionId}/review`, payload);
  }

  async analyzeProject(projectId: number): Promise<APIResponse<{ analysis_id: number; status: string }>> {
    return this.post(`ai-analysis/projects/${projectId}/analyze`, {});
  }

  async getAnalysis(analysisId: number): Promise<APIResponse<CmAiAnalysis>> {
    return this.get<CmAiAnalysis>(`ai-analysis/${analysisId}`);
  }

  async acceptAnalysis(analysisId: number): Promise<APIResponse<unknown>> {
    return this.post<unknown>(`ai-analysis/${analysisId}/accept`, {});
  }

  async requestAnalysisRevision(analysisId: number, revisionNotes: string): Promise<APIResponse<unknown>> {
    return this.post<unknown>(`ai-analysis/${analysisId}/revision`, { revision_notes: revisionNotes });
  }

  async applyReviewer(): Promise<APIResponse<CmReviewerApplicationStart>> {
    return this.post<CmReviewerApplicationStart>('reviewer/apply', {});
  }

  async submitReviewerTest(applicationId: number, reviews: Record<string, unknown>[]): Promise<APIResponse<CmReviewerTestResult>> {
    return this.post<CmReviewerTestResult>(`reviewer/application/${applicationId}/submit`, { reviews });
  }

  async getReviewTasks(): Promise<APIResponse<{ pending_reviews: CmReviewSubmission[] }>> {
    return this.get<{ pending_reviews: CmReviewSubmission[] }>('reviewer/tasks');
  }

  async submitCodeReview(submissionId: number, payload: Record<string, unknown>): Promise<APIResponse<unknown>> {
    return this.post<unknown>(`reviewer/reviews/${submissionId}`, payload);
  }

  async getArchitectEligibility(): Promise<APIResponse<CmArchitectEligibility>> {
    return this.get<CmArchitectEligibility>('architect/eligibility');
  }

  async applyArchitect(): Promise<APIResponse<unknown>> {
    return this.post<unknown>('architect/apply', {});
  }

  async getArchitectTasks(): Promise<APIResponse<CmArchitectTasks>> {
    return this.get<CmArchitectTasks>('architect/tasks');
  }

  async acceptArchitectTask(projectId: number): Promise<APIResponse<unknown>> {
    return this.post<unknown>(`architect/tasks/${projectId}/accept`, {});
  }

  async completeArchitectDeposit(): Promise<APIResponse<unknown>> {
    return this.post<unknown>('architect/deposit/complete', {});
  }

  async getPayments(params?: Record<string, unknown>): Promise<APIResponse<unknown>> {
    return this.get<unknown>('payments', params as Record<string, any>);
  }

  async createInvoice(payload: Record<string, unknown>): Promise<APIResponse<unknown>> {
    return this.post<unknown>('invoices', payload);
  }

  async requestRefund(payload: Record<string, unknown>): Promise<APIResponse<unknown>> {
    return this.post<unknown>('refunds/request', payload);
  }

  async approveRefund(refundId: number): Promise<APIResponse<unknown>> {
    return this.post<unknown>(`refunds/${refundId}/approve`, {});
  }

  async processRefund(refundId: number): Promise<APIResponse<unknown>> {
    return this.post<unknown>(`refunds/${refundId}/process`, {});
  }

  async requestPhoneVerification(phone: string): Promise<APIResponse<Record<string, unknown>>> {
    return this.post<Record<string, unknown>>('auth/request-phone-verification', { phone });
  }

  async verifyPhoneOtp(otpCode: string): Promise<APIResponse<unknown>> {
    return this.post<unknown>('auth/verify-phone-otp', { otp_code: otpCode });
  }

  async uploadKycDocuments(formData: FormData, onProgress: (percentage: number) => void = () => {}): Promise<APIResponse<unknown>> {
    return this.uploadWithProgress<unknown>('auth/upload-kyc-documents', formData, onProgress);
  }

  async updateProject(projectId: number, payload: Record<string, unknown>): Promise<APIResponse<unknown>> {
    return this.put<unknown>(`projects/${projectId}`, payload);
  }

  async createMilestone(projectId: number, payload: Record<string, unknown>): Promise<APIResponse<unknown>> {
    return this.post<unknown>(`projects/${projectId}/milestones`, payload);
  }

  async createTask(payload: Record<string, unknown>): Promise<APIResponse<unknown>> {
    return this.post<unknown>('tasks', payload);
  }
}

export const cmApi = new CmApi();
