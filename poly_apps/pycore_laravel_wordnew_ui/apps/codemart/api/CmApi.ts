import { BaseAPI } from '../../../core/integrations/laravel/transport/BaseAPI';
import {
  createLaravelModuleConfig,
  LARAVEL_API_PREFIX,
} from '../../../core/integrations/laravel/transport/ApiContract';
import { cmHandleUnauthorized } from '../auth/cmAuthSession';
import type { APIRequestConfig, APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import { clearCoordinatedRequests } from '../../../core/network/RequestCoordinator';
import { setAuthToken } from '../../../core/auth/AuthSession';
import type {
  CmAiAnalysis,
  CmArchitectEligibility,
  CmArchitectTasks,
  CmAttachment,
  CmBootstrap,
  CmDepositBankInfo,
  CmDepositCreateResult,
  CmDepositInfo,
  CmDepositRecord,
  CmEstimateInput,
  CmEstimateResult,
  CmFundResult,
  CmInvoice,
  CmListPage,
  CmMilestone,
  CmNotification,
  CmPage,
  CmPagination,
  CmPayment,
  CmProfileResponse,
  CmProject,
  CmProjectAnalysis,
  CmProjectDetail,
  CmPublicHomeData,
  CmPublicHomeLoadResult,
  CmPublicTestimonialData,
  CmRefund,
  CmRegisterPayload,
  CmRegisterResult,
  CmRegistrationStatus,
  CmReviewerApplicationStart,
  CmReviewerTestResult,
  CmReviewSubmission,
  CmRoleRequestResult,
  CmSubmission,
  CmSubmissionReviewResult,
  CmTask,
  CmTaskComment,
  CmTaskDetail,
  CmTestimonialPayload,
  CmWallet,
  CmWalletTransaction,
  CmWithdrawal,
} from './CmApiTypes';
import { cmFileNameFromDisposition, cmSaveBlob } from './cmDownload';

const PUBLIC_HOME_CACHE_TTL_MS = 60_000;
const IDEMPOTENCY_HEADER = 'Idempotency-Key';

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
    super({ ...createLaravelModuleConfig(LARAVEL_API_PREFIX.codeMartV1), onUnauthorized: cmHandleUnauthorized });
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

  /** Writes invalidate the short-lived shared GET coalescing so the next read reflects the change. */
  protected async request<T>(config: APIRequestConfig, retryCount: number = 0): Promise<APIResponse<T>> {
    const response = await super.request<T>(config, retryCount);
    if (config.method !== 'GET') clearCoordinatedRequests();
    return response;
  }

  private async uploadFresh<T>(url: string, formData: FormData, onProgress: (percentage: number) => void): Promise<APIResponse<T>> {
    const response = await this.uploadWithProgress<T>(url, formData, onProgress);
    clearCoordinatedRequests();
    return response;
  }

  private postIdempotent<T>(url: string, data: unknown, idempotencyKey: string): Promise<APIResponse<T>> {
    return this.request<T>({ url, method: 'POST', data, headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } });
  }

  private postMultipart<T>(url: string, data: FormData): Promise<APIResponse<T>> {
    return this.request<T>({ url, method: 'POST', data });
  }

  /** Authenticated blob download saved through the browser; failures keep the server error body. */
  async downloadFile(path: string, fallbackName: string): Promise<APIResponse<null>> {
    let response: Response;
    try {
      response = await this.rawRequest(path, { method: 'GET' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'download_failed';
      return { success: false, data: null, error: message, status: 0, isNetworkError: true };
    }
    if (!response.ok) {
      let body: Record<string, unknown> | undefined;
      try {
        body = await response.json() as Record<string, unknown>;
      } catch {
        body = undefined;
      }
      return {
        success: false,
        data: null,
        error: typeof body?.message === 'string' ? body.message : response.statusText,
        status: response.status,
        debugInfo: body,
      };
    }
    const blob = await response.blob();
    cmSaveBlob(blob, cmFileNameFromDisposition(response.headers.get('content-disposition')) ?? fallbackName);
    return { success: true, data: null, error: null, status: response.status };
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

  async requestRole(roleType: string): Promise<APIResponse<CmRoleRequestResult>> {
    return this.post<CmRoleRequestResult>('roles/request', { role_type: roleType });
  }

  async submitTestimonial(payload: CmTestimonialPayload): Promise<APIResponse<{ id: number; status: string; project_id: number | null }>> {
    return this.post('testimonials', payload);
  }

  async getProjects(params?: Record<string, unknown>): Promise<APIResponse<{ projects: CmProject[]; pagination: CmPagination }>> {
    return this.get('projects', params as Record<string, any>);
  }

  async createProject(payload: Record<string, unknown>): Promise<APIResponse<CmProject>> {
    return this.post<CmProject>('projects', payload);
  }

  async getProject(projectId: number): Promise<APIResponse<CmProjectDetail>> {
    return this.get<CmProjectDetail>(`projects/${projectId}`);
  }

  async updateProject(projectId: number, payload: Record<string, unknown>): Promise<APIResponse<CmProject>> {
    return this.put<CmProject>(`projects/${projectId}`, payload);
  }

  async publishProject(projectId: number): Promise<APIResponse<CmProject>> {
    return this.post<CmProject>(`projects/${projectId}/publish`, {});
  }

  async transitionProject(projectId: number, toStatus: string, reason: string): Promise<APIResponse<{ project: CmProject; from: string; to: string }>> {
    return this.post(`projects/${projectId}/transition`, { to_status: toStatus, reason: reason || null });
  }

  async getProjectAnalysis(projectId: number): Promise<APIResponse<CmProjectAnalysis>> {
    return this.get<CmProjectAnalysis>(`projects/${projectId}/analysis`);
  }

  async fundProject(projectId: number, idempotencyKey: string): Promise<APIResponse<CmFundResult>> {
    return this.postIdempotent<CmFundResult>(`projects/${projectId}/fund`, {}, idempotencyKey);
  }

  async getProjectAttachments(projectId: number, page = 1): Promise<APIResponse<CmListPage<CmAttachment>>> {
    return this.get(`projects/${projectId}/attachments`, { page });
  }

  async uploadProjectAttachment(projectId: number, file: File, onProgress: (percentage: number) => void): Promise<APIResponse<CmAttachment>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.uploadFresh<CmAttachment>(`projects/${projectId}/attachments`, formData, onProgress);
  }

  async downloadProjectAttachment(projectId: number, attachment: CmAttachment): Promise<APIResponse<null>> {
    return this.downloadFile(
      `projects/${projectId}/attachments/${attachment.id}/download`,
      attachment.original_name ?? attachment.file_name,
    );
  }

  async createMilestone(projectId: number, payload: Record<string, unknown>): Promise<APIResponse<CmMilestone>> {
    return this.post<CmMilestone>(`projects/${projectId}/milestones`, payload);
  }

  async updateMilestone(milestoneId: number, payload: Record<string, unknown>): Promise<APIResponse<CmMilestone>> {
    return this.put<CmMilestone>(`milestones/${milestoneId}`, payload);
  }

  async completeMilestone(milestoneId: number): Promise<APIResponse<CmMilestone>> {
    return this.post<CmMilestone>(`milestones/${milestoneId}/complete`, {});
  }

  async createTask(payload: Record<string, unknown>): Promise<APIResponse<CmTask>> {
    return this.post<CmTask>('tasks', payload);
  }

  async getTask(taskId: number): Promise<APIResponse<CmTaskDetail>> {
    return this.get<CmTaskDetail>(`tasks/${taskId}`);
  }

  async transitionTask(taskId: number, toStatus: string, reason: string): Promise<APIResponse<{ task: CmTask; from: string; to: string }>> {
    return this.post(`tasks/${taskId}/transition`, { to_status: toStatus, reason: reason || null });
  }

  async getTaskSubmissions(taskId: number, page = 1): Promise<APIResponse<CmListPage<CmSubmission>>> {
    return this.get(`tasks/${taskId}/submissions`, { page });
  }

  async downloadSubmissionFile(submissionId: number, fileIndex: number, fallbackName: string): Promise<APIResponse<null>> {
    return this.downloadFile(`submissions/${submissionId}/files/${fileIndex}/download`, fallbackName);
  }

  async submitTask(taskId: number, submissionNote: string, fileUrls: string[], uploads: File[]): Promise<APIResponse<CmSubmission>> {
    const formData = new FormData();
    if (submissionNote) formData.append('submission_note', submissionNote);
    fileUrls.forEach((url) => formData.append('files[]', url));
    uploads.forEach((file) => formData.append('uploads[]', file));
    return this.postMultipart<CmSubmission>(`tasks/${taskId}/submit`, formData);
  }

  async addTaskComment(taskId: number, comment: string): Promise<APIResponse<CmTaskComment>> {
    return this.post<CmTaskComment>(`tasks/${taskId}/comments`, { comment });
  }

  async reviewSubmission(submissionId: number, payload: Record<string, unknown>): Promise<APIResponse<CmSubmissionReviewResult>> {
    return this.post<CmSubmissionReviewResult>(`submissions/${submissionId}/review`, payload);
  }

  async analyzeProject(projectId: number): Promise<APIResponse<{ analysis_id: number; status: string }>> {
    return this.post(`ai-analysis/projects/${projectId}/analyze`, {});
  }

  async getAnalysis(analysisId: number): Promise<APIResponse<CmAiAnalysis>> {
    return this.get<CmAiAnalysis>(`ai-analysis/${analysisId}`);
  }

  async acceptAnalysis(analysisId: number): Promise<APIResponse<{ project_status: string; funding_amount: string }>> {
    return this.post(`ai-analysis/${analysisId}/accept`, {});
  }

  async requestAnalysisRevision(analysisId: number, revisionNotes: string): Promise<APIResponse<unknown>> {
    return this.post<unknown>(`ai-analysis/${analysisId}/revision`, { revision_notes: revisionNotes });
  }

  async browseMarketplace(params?: Record<string, unknown>): Promise<APIResponse<{ tasks: CmTask[]; pagination: CmPagination }>> {
    return this.get('marketplace/tasks', params as Record<string, any>);
  }

  async acceptTask(taskId: number): Promise<APIResponse<unknown>> {
    return this.post<unknown>(`marketplace/tasks/${taskId}/accept`, {});
  }

  async getMyTasks(page = 1): Promise<APIResponse<{ my_tasks: CmTask[]; pagination: CmPagination }>> {
    return this.get('marketplace/my-tasks', { page });
  }

  async getWallet(): Promise<APIResponse<CmWallet>> {
    return this.get<CmWallet>('wallet');
  }

  async getWalletTransactions(page = 1): Promise<APIResponse<CmListPage<CmWalletTransaction>>> {
    return this.get('wallet/transactions', { page });
  }

  async getDepositInfo(): Promise<APIResponse<CmDepositInfo>> {
    return this.get<CmDepositInfo>('deposits/info');
  }

  async createDeposit(payload: { role_type: string; amount?: number; payment_method: string }, idempotencyKey: string): Promise<APIResponse<CmDepositCreateResult>> {
    return this.postIdempotent<CmDepositCreateResult>('deposits', payload, idempotencyKey);
  }

  async getDepositHistory(): Promise<APIResponse<CmDepositRecord[] | { items?: CmDepositRecord[]; deposits?: CmDepositRecord[] }>> {
    return this.get('deposits/history');
  }

  async getDepositBankInfo(depositId: number): Promise<APIResponse<CmDepositBankInfo>> {
    return this.get<CmDepositBankInfo>(`deposits/${depositId}/bank-info`);
  }

  async getPayments(page = 1): Promise<APIResponse<CmListPage<CmPayment>>> {
    return this.get('payments', { page });
  }

  async createPayment(payload: Record<string, unknown>, idempotencyKey: string): Promise<APIResponse<CmPayment>> {
    return this.postIdempotent<CmPayment>('payments', payload, idempotencyKey);
  }

  async getInvoices(page = 1): Promise<APIResponse<CmListPage<CmInvoice>>> {
    return this.get('invoices', { page });
  }

  async createInvoice(payload: Record<string, unknown>): Promise<APIResponse<CmInvoice>> {
    return this.post<CmInvoice>('invoices', payload);
  }

  async getRefunds(page = 1): Promise<APIResponse<CmListPage<CmRefund>>> {
    return this.get('refunds', { page });
  }

  async requestRefund(payload: { payment_id: number; reason: string; notes?: string }, idempotencyKey: string): Promise<APIResponse<CmRefund>> {
    return this.postIdempotent<CmRefund>('refunds/request', payload, idempotencyKey);
  }

  async getWithdrawals(page = 1): Promise<APIResponse<CmListPage<CmWithdrawal>>> {
    return this.get('withdrawals', { page });
  }

  async requestWithdrawal(payload: { amount: number; method: string; account_info: Record<string, string> }, idempotencyKey: string): Promise<APIResponse<CmWithdrawal>> {
    return this.postIdempotent<CmWithdrawal>('withdrawals', payload, idempotencyKey);
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

  async applyReviewer(): Promise<APIResponse<CmReviewerApplicationStart>> {
    return this.post<CmReviewerApplicationStart>('reviewer/apply', {});
  }

  async submitReviewerTest(applicationId: number, reviews: Record<string, unknown>[]): Promise<APIResponse<CmReviewerTestResult>> {
    return this.post<CmReviewerTestResult>(`reviewer/application/${applicationId}/submit`, { reviews });
  }

  async getReviewTasks(page = 1): Promise<APIResponse<{ pending_reviews: CmReviewSubmission[]; pagination: CmPagination }>> {
    return this.get('reviewer/tasks', { page });
  }

  async submitCodeReview(submissionId: number, payload: Record<string, unknown>): Promise<APIResponse<{ review_id: number; recommendation: string | null; code_score: string | number }>> {
    return this.post(`reviewer/reviews/${submissionId}`, payload);
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

  async verifyEmail(email: string, token: string): Promise<APIResponse<{ user_id: number; next_step: string }>> {
    return this.post('auth/verify-email', { email, token });
  }

  async getRegistrationStatus(): Promise<APIResponse<CmRegistrationStatus>> {
    return this.get<CmRegistrationStatus>('auth/registration-status');
  }

  async requestPhoneVerification(phone: string): Promise<APIResponse<Record<string, unknown>>> {
    return this.post<Record<string, unknown>>('auth/request-phone-verification', { phone });
  }

  async verifyPhoneOtp(otpCode: string): Promise<APIResponse<unknown>> {
    return this.post<unknown>('auth/verify-phone-otp', { otp_code: otpCode });
  }

  async uploadKycDocuments(formData: FormData, onProgress: (percentage: number) => void = () => {}): Promise<APIResponse<unknown>> {
    return this.uploadFresh<unknown>('auth/upload-kyc-documents', formData, onProgress);
  }
}

export const cmApi = new CmApi();
