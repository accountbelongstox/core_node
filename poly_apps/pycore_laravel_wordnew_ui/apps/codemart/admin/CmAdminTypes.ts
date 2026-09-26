export const CM_ADMIN_PAGE_SIZE = 20;
export const CM_ADMIN_ROLE_TYPES = ['client', 'developer', 'architect', 'reviewer'] as const;
export const CM_ADMIN_ROLE_STATUSES = ['pending', 'active', 'suspended', 'rejected'] as const;
export const CM_ADMIN_ROLE_REASON_REQUIRED = ['suspended', 'rejected'] as const;
export const CM_ADMIN_GRANT_STATUSES = ['pending', 'active'] as const;
export const CM_ADMIN_KYC_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const CM_ADMIN_KYC_DOCUMENTS = ['front', 'back', 'selfie'] as const;
export const CM_ADMIN_IDENTITY_TYPES = ['ID_CARD', 'PASSPORT', 'DRIVING_LICENSE'] as const;
export const CM_ADMIN_DEPOSIT_STATUSES = ['pending', 'paid', 'rejected', 'refunded', 'failed'] as const;
export const CM_ADMIN_REFUND_STATUSES = ['pending', 'approved', 'rejected', 'completed'] as const;
export const CM_ADMIN_WITHDRAWAL_STATUSES = ['pending', 'approved', 'rejected', 'paid'] as const;
export const CM_ADMIN_WITHDRAWAL_OPEN_STATUSES = ['pending', 'approved'] as const;
export const CM_ADMIN_PAYMENT_STATUSES = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'disputed', 'refunded'] as const;
export const CM_ADMIN_PAYMENT_TYPES = ['milestone', 'hourly', 'bonus', 'refund'] as const;
export const CM_ADMIN_ESCROW_STATUSES = ['held', 'released', 'refunded', 'disputed'] as const;
export const CM_ADMIN_PROJECT_STATUSES = ['draft', 'proposal_review', 'funding_pending', 'open', 'in_progress', 'paused', 'completed', 'cancelled', 'archived'] as const;
export const CM_ADMIN_TESTIMONIAL_STATUSES = ['pending', 'approved', 'hidden'] as const;
export const CM_ADMIN_TESTIMONIAL_LOCALES = ['en', 'zh'] as const;
export const CM_ADMIN_REVIEWER_STATUSES = ['in_progress', 'passed', 'failed', 'revoked'] as const;
export const CM_ADMIN_CONTACT_STATUSES = ['new', 'handled'] as const;
export const CM_ADMIN_DISPUTE_RESOLUTIONS = ['refund', 'complete'] as const;

export type CmAdminDisputeResolution = typeof CM_ADMIN_DISPUTE_RESOLUTIONS[number];
export type CmAdminKycDocument = typeof CM_ADMIN_KYC_DOCUMENTS[number];
export type CmAdminQuery = Record<string, string | number | undefined>;

export interface CmAdminPage<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CmAdminUserSummary {
  id: number;
  username: string | null;
  email?: string | null;
  name: string | null;
}

export interface CmAdminOverviewData {
  users_total: number;
  codeMart_role_holders: number;
  roles_pending: number;
  projects_total: number;
  projects_by_status: Record<string, number>;
  tasks_total: number;
  kyc_pending: number;
  refunds_pending: number;
  deposits_pending: number;
  withdrawals_pending: number;
  testimonials_pending: number;
  contact_messages_new: number;
  reviewer_applications_passed: number;
}

export interface CmAdminPolicy {
  currency: string;
  deposit_amounts: Record<string, number | string>;
  architect_additional_deposit: number | string;
  platform_commission_rate: number | string;
  architect_thresholds: Record<string, number | string>;
  reviewer_thresholds: Record<string, number | string>;
  role_status_transitions: Record<string, string[]>;
  role_status_reason_required: string[];
  admin_project_target_statuses: string[];
  max_kyc_image_size_kb: number;
  max_attachment_size_kb: number;
}

export interface CmAdminUserRow {
  id: number;
  username: string;
  email: string | null;
  name: string | null;
  rolelevel: number;
  rolename: string | null;
  is_admin: boolean;
  roles: Record<string, string>;
  created_at: string | null;
}

export interface CmAdminUserRole {
  id: number;
  role_type: string;
  role_status: string;
  deposit_amount: string | null;
  role_activated_at: string | null;
  allowed_transitions: string[];
  created_at: string | null;
}

export interface CmAdminKycRecord {
  id: number;
  user_id: number;
  user: CmAdminUserSummary | null;
  identity_type: string;
  real_name: string;
  verification_status: string;
  verification_notes: string | null;
  verified_at: string | null;
  verified_by: number | null;
  documents: Partial<Record<CmAdminKycDocument, boolean>>;
  reviewable: boolean;
  submitted_at: string | null;
}

export interface CmAdminDepositRow {
  id: number;
  user_id: number;
  role_type: string;
  amount: string;
  payment_method: string;
  status: string;
  paid_at: string | null;
  admin_notes?: string | null;
  reviewed_at?: string | null;
  refunded_at?: string | null;
  created_at: string | null;
}

export interface CmAdminRefundRow {
  id: number;
  payment_id: number;
  amount: string;
  status: string;
  reason: string | null;
  notes?: string | null;
  admin_notes?: string | null;
  requested_by?: number | null;
  requested_at: string | null;
  reviewed_at?: string | null;
  processed_at?: string | null;
}

export interface CmAdminWithdrawalRow {
  id: number;
  user: CmAdminUserSummary | null;
  amount: string;
  currency: string | null;
  status: string;
  method: string;
  account_info: Record<string, unknown> | null;
  admin_id: number | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string | null;
}

export interface CmAdminPaymentRow {
  id: number;
  payer: CmAdminUserSummary | null;
  payee: CmAdminUserSummary | null;
  project_id: number | null;
  milestone_id: number | null;
  amount: string;
  currency: string | null;
  type: string;
  status: string;
  payment_method: string | null;
  business_ref: string | null;
  created_at: string | null;
}

export interface CmAdminEscrowRow {
  id: number;
  project_id: number | null;
  project_title: string | null;
  escrow_type: string | null;
  payer: CmAdminUserSummary | null;
  payee: CmAdminUserSummary | null;
  amount: string;
  released_amount: string;
  refunded_amount: string;
  remaining_amount: string;
  currency: string | null;
  status: string;
  released_at: string | null;
  created_at: string | null;
}

export interface CmAdminProjectRow {
  id: number;
  client_id: number;
  client: CmAdminUserSummary | null;
  title: string;
  status: string;
  complexity: string | null;
  budget: string | null;
  budget_type: string | null;
  currency: string | null;
  admin_transitions: string[];
  created_at: string | null;
}

export interface CmAdminTestimonialRow {
  id: number;
  status: string;
  approved: boolean;
  quote_key: string | null;
  quotes: Record<string, string> | null;
  author_label: string | null;
  role_label: string | null;
  role_labels: Record<string, string> | null;
  avatar_url: string | null;
  sort_order: number;
  user_id: number | null;
  user: CmAdminUserSummary | null;
  project_id: number | null;
  moderated_by: number | null;
  moderated_at: string | null;
  created_at: string | null;
}

export interface CmAdminReviewerApplicationRow {
  id: number;
  user_id: number;
  user: CmAdminUserSummary | null;
  status: string;
  test_status: string;
  score: string | null;
  reviewer_role_status: string | null;
  revocable: boolean;
  completed_at: string | null;
  revoked_at: string | null;
  revoked_by: number | null;
  revoke_reason: string | null;
  created_at: string | null;
}

export interface CmAdminContactMessageRow {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string;
  handled_by: number | null;
  handled_at: string | null;
  created_at: string | null;
}

export interface CmAdminActivityRow {
  id: number;
  actor_id: number | null;
  actor: CmAdminUserSummary | null;
  resource_type: string;
  resource_id: number;
  action: string;
  from_state: string | null;
  to_state: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

export interface CmAdminUserDetail {
  account: {
    id: number;
    username: string;
    email: string | null;
    name: string | null;
    nickname: string | null;
    rolelevel: number;
    rolename: string | null;
    is_admin: boolean;
    email_verified: boolean;
    phone_verified: boolean;
    created_at: string | null;
  };
  roles: CmAdminUserRole[];
  profiles: {
    developer: {
      company_name: string | null;
      bio: string | null;
      skills: string[] | string | null;
      completed_projects: number;
      average_rating: string;
    } | null;
    client: {
      company_name: string | null;
      industry: string | null;
      contact_person: string | null;
      contact_phone: string | null;
      company_website: string | null;
      posted_projects: number;
    } | null;
  };
  kyc: CmAdminKycRecord[];
  deposits: CmAdminDepositRow[];
  wallet: { balance: string; available_balance: string; frozen_balance: string; currency: string };
  projects: { id: number; title: string; status: string; budget: string | null; currency: string | null; created_at: string | null }[];
  tasks: { id: number; milestone_id: number | null; title: string; status: string; budget_allocation: string | null; due_date: string | null }[];
  activity: CmAdminActivityRow[];
}
