export interface CmPublicMetricData {
  total_amount: string | null;
  currency: string | null;
  project_count: number | null;
  developer_count: number | null;
}

export interface CmPublicTestimonialData {
  id: string;
  quote: string;
  author_label: string;
  role_label: string;
  avatar_url: string | null;
}

export interface CmPublicHomeData extends CmPublicMetricData {
  testimonials: CmPublicTestimonialData[];
}

export interface CmPublicHomeLoadResult {
  data: CmPublicHomeData | null;
  errorCode: string | null;
}

export interface CmRegisterPayload {
  username: string;
  email: string;
  password: string;
  password_confirmation: string;
  role_type: 'developer' | 'client';
  real_name: string;
  registration_code?: string;
}

export interface CmRegisterResult {
  user_id: number;
  username: string;
  email: string;
  role_type: string;
  role_status: string;
  is_admin: boolean;
  token: string | null;
  token_type: string | null;
  next_step: string;
}

export interface CmBootstrapUser {
  id: number;
  username: string;
  email: string | null;
  name: string | null;
  nickname: string | null;
  rolelevel: number;
  rolename: string | null;
}

export interface CmOnboardingStep {
  key: string;
  completed: boolean;
  blocked: boolean;
}

export interface CmOnboarding {
  email_verified: boolean;
  phone_verified: boolean;
  kyc_status: string;
  deposit_required: Record<string, number>;
  requestable_roles?: string[];
  steps: CmOnboardingStep[];
  next_step: string | null;
  complete: boolean;
}

export interface CmCounters {
  active_projects: number;
  my_open_tasks: number;
  open_marketplace_tasks: number;
  pending_reviews: number;
  protected_funds: string;
  wallet_balance: string;
  currency: string;
  unread_notifications: number;
}

export interface CmBootstrap {
  contract_version: string;
  min_supported_ui_version: string;
  user: CmBootstrapUser;
  is_admin: boolean;
  is_super_admin: boolean;
  roles: Record<string, string>;
  capabilities: string[];
  onboarding: CmOnboarding;
  profile: CmProfileData | null;
  vocabulary: {
    states: Record<string, string[]>;
    roles: string[];
    transitions?: Record<string, Record<string, Record<string, string[]>>>;
    policy: {
      currency: string;
      supported_currencies: string[];
      deposit_amounts: Record<string, number>;
      platform_commission_rate: number;
      default_page_size: number;
      max_page_size: number;
      [key: string]: unknown;
    };
  };
  counters: CmCounters;
}

export interface CmProfileData {
  developer: {
    company_name: string | null;
    bio: string | null;
    skills: string[] | null;
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
}

export interface CmProfileResponse extends CmProfileData {
  user: {
    id: number;
    username: string;
    email: string | null;
    name: string | null;
    nickname: string | null;
  };
  roles: Record<string, string>;
}

export interface CmProject {
  id: number;
  client_id: number;
  title: string;
  description: string;
  status: string;
  complexity: string | null;
  budget: string | null;
  budget_type: string | null;
  currency: string | null;
  total_milestones?: number;
  completed_milestones?: number;
  architect_id?: number | null;
  analysis_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  skills?: string[] | null;
  languages?: string[] | null;
  frameworks?: string[] | null;
  databases?: string[] | null;
  published_at?: string | null;
  created_at: string | null;
  updated_at?: string | null;
}

export interface CmTask {
  id: number;
  milestone_id: number;
  title: string;
  description: string;
  status: string;
  priority: string | null;
  assigned_to: number | null;
  due_date: string | null;
  budget_allocation: string | null;
  required_skills?: string[] | null;
  deliverables?: unknown;
  created_at: string | null;
}

export interface CmMilestone {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  status: string;
  order: number | null;
  due_date: string | null;
  budget: string | null;
  completed_at?: string | null;
  deliverables?: string[] | null;
  tasks?: CmTask[];
}

export interface CmAnalysisSummary {
  id: number;
  status: string;
  revision: number;
  estimated_hours: number | null;
  estimated_cost: string | null;
  complexity_score: number | null;
  completed_at: string | null;
  accepted_at: string | null;
}

export interface CmProjectAccess {
  role: 'owner' | 'architect' | 'assignee' | string;
  read_only: boolean;
  can_manage: boolean;
  allowed_transitions: string[];
}

export interface CmProjectDetail extends CmProject {
  milestones?: CmMilestone[];
  latest_analysis?: CmAnalysisSummary | null;
  access?: CmProjectAccess;
}

export interface CmProjectProposal {
  id: number;
  project_id: number;
  status: string;
  estimated_duration: string | number | null;
  estimated_cost: string | null;
  ai_notes: string | null;
}

export interface CmProjectAnalysis {
  project_id: number;
  project_status: string;
  analysis_status: string | null;
  analysis: CmAiAnalysis | null;
  proposal: CmProjectProposal | null;
  can_accept: boolean;
}

export interface CmFundResult {
  project_id: number;
  project_status: string | null;
  escrow: {
    id: number;
    amount: string;
    currency: string | null;
    status: string;
    remaining_amount: string;
  };
  idempotent_replay: boolean;
}

export interface CmAttachment {
  id: number;
  project_id: number;
  file_name: string;
  original_name: string | null;
  mime_type: string | null;
  size: number | null;
  uploaded_by: number | null;
  created_at: string | null;
}

export interface CmListPage<T> {
  items: T[];
  total: number;
  page: number;
  page_size?: number;
  pageSize?: number;
  total_pages?: number;
  totalPages?: number;
}

export interface CmPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CmUserRef {
  id: number;
  name?: string | null;
  username?: string | null;
}

export interface CmTaskComment {
  id: number;
  task_id: number;
  user_id: number;
  comment: string;
  created_at: string | null;
  user?: CmUserRef | null;
}

export interface CmSubmissionFile {
  index: number;
  name?: string | null;
  url?: string | null;
  size?: number | null;
  mime_type?: string | null;
  storage?: string | null;
}

export interface CmLineComment {
  file?: string;
  line?: number | string;
  comment?: string;
}

export interface CmCodeReview {
  id: number;
  task_submission_id: number;
  reviewer_id: number;
  review_kind: string | null;
  status: string | null;
  recommendation: string | null;
  code_score: string | null;
  rating: number | null;
  quality_rating: number | null;
  readability_rating: number | null;
  efficiency_rating: number | null;
  security_rating: number | null;
  review_notes: string | null;
  comments: string | null;
  line_comments: CmLineComment[] | null;
  created_at: string | null;
  reviewer?: CmUserRef | null;
}

export interface CmSubmission {
  id: number;
  task_id: number;
  submitted_by: number;
  submission_note: string | null;
  files: CmSubmissionFile[] | null;
  status: string;
  reviewed_at: string | null;
  created_at: string | null;
  submitter?: CmUserRef | null;
  reviews?: CmCodeReview[];
}

export interface CmTaskAccess {
  roles: string[];
  allowed_transitions: string[];
  can_edit: boolean;
  can_submit: boolean;
  can_review: boolean;
}

export interface CmTaskDetail extends CmTask {
  milestone?: CmMilestone | null;
  assignee?: CmUserRef | null;
  submissions?: CmSubmission[];
  comments?: CmTaskComment[];
  project: {
    id: number;
    title: string;
    status: string;
    client_id: number;
    architect_id: number | null;
  } | null;
  access: CmTaskAccess;
}

export interface CmEscrowRelease {
  released: boolean;
  amount: string | null;
  error_code: string | null;
  net_amount?: string;
  commission?: string;
  payment_id?: number;
  replayed?: boolean;
}

export interface CmSubmissionReviewResult {
  review: CmCodeReview;
  submission: CmSubmission;
  task: CmTask | null;
  escrow: CmEscrowRelease | null;
}

export interface CmPage<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface CmWallet {
  balance: string;
  available_balance: string;
  frozen_balance: string;
  currency: string;
}

export interface CmWalletTransaction {
  id: number;
  type: string;
  amount: string;
  balance_after: string | null;
  description: string | null;
  status: string;
  created_at: string | null;
}

export interface CmDepositRole {
  role_type: string;
  role_status: string;
  required_amount: string;
  paid_amount: string;
  paid_for_role: string;
  remaining_amount: string;
  is_sufficient: boolean;
}

export interface CmDepositInfo {
  currency: string;
  roles: CmDepositRole[];
  role_type: string | null;
  required_deposit: string;
  current_deposit: string;
  is_sufficient: boolean;
  shortfall: string;
  pending_amount: string;
}

export interface CmDepositCreateResult {
  deposit_id: number;
  role_type: string;
  amount: string;
  payment_method: string;
  payment_url: string | null;
  status: string;
  paid_at: string | null;
  admin_notes: string | null;
  idempotent_replay?: boolean;
}

export interface CmDepositBankInfo {
  deposit_id: number;
  amount: string;
  status: string;
  reference: string;
  bank: {
    bank_name: string | null;
    account_name: string | null;
    account_number: string | null;
    branch: string | null;
    swift_code: string | null;
    currency: string | null;
  };
}

export interface CmInvoice {
  id: number;
  payment_id: number;
  invoice_number: string;
  issued_by: number;
  description: string | null;
  subtotal: string;
  tax: string;
  total: string;
  issued_date: string | null;
  status: string;
  created_at: string | null;
  payment?: CmPayment | null;
}

export interface CmRefund {
  id: number;
  payment_id: number;
  amount: string;
  status: string;
  reason: string | null;
  notes: string | null;
  admin_notes: string | null;
  requested_at: string | null;
  processed_at: string | null;
  created_at: string | null;
  payment?: CmPayment | null;
}

export interface CmWithdrawal {
  id: number;
  amount: string;
  currency: string | null;
  status: string;
  method: string;
  account_info: Record<string, unknown> | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string | null;
}

export interface CmRegistrationStatus {
  user_id: number;
  username: string;
  email: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  kyc_status: string;
  roles: Record<string, string>;
  registration_complete: boolean;
}

export interface CmRoleRequestResult {
  role_type: string;
  role_status: string;
  deposit_required: boolean;
  deposit_amount: string | number | null;
  next_step: string;
}

export interface CmTestimonialPayload {
  quotes: Record<string, string>;
  project_id?: number;
  author_label?: string;
  role_label?: string;
}

export interface CmNotification {
  id: number;
  type: string;
  title_key: string;
  body_key: string | null;
  params: Record<string, unknown> | null;
  resource_type: string | null;
  resource_id: number | null;
  read: boolean;
  created_at: string | null;
}

export interface CmEstimateInput {
  complexity: string;
  platforms: number;
  features: number;
  budget_type?: string;
}

export interface CmEstimateResult {
  complexity: string;
  platforms: number;
  features: number;
  currency: string;
  estimated_hours_min: number;
  estimated_hours_max: number;
  estimated_cost_min: string;
  estimated_cost_max: string;
  estimated_duration_weeks_min: number;
  estimated_duration_weeks_max: number;
  recommended_team: string[];
  hourly_rate: string;
  platform_commission_rate: number;
}

export interface CmAdminOverview {
  users_total: number;
  codeMart_role_holders: number;
  projects_total: number;
  projects_by_status: Record<string, number>;
  tasks_total: number;
  kyc_pending: number;
  refunds_pending: number;
  deposits_pending: number;
}

export interface CmAdminUser {
  id: number;
  username: string;
  email: string | null;
  name: string | null;
  rolelevel: number;
  rolename: string | null;
  roles: Record<string, string>;
  created_at: string | null;
}

export interface CmAdminKycItem {
  id: number;
  user_id: number;
  identity_type: string;
  real_name: string;
  verification_status: string;
  verification_notes: string | null;
  submitted_at: string | null;
}

export interface CmAdminRefund {
  id: number;
  payment_id: number;
  amount: string;
  status: string;
  reason: string | null;
  requested_at: string | null;
}

export interface CmAdminDeposit {
  id: number;
  user_id: number;
  role_type: string;
  amount: string;
  payment_method: string;
  status: string;
  paid_at: string | null;
  created_at: string | null;
}

export interface CmAiAnalysis {
  analysis_id: number;
  project_id: number;
  status: string;
  revision?: number;
  is_latest?: boolean;
  revision_notes?: string | null;
  accepted_at?: string | null;
  keywords: string[] | null;
  recommended_languages: string[] | null;
  recommended_frameworks: string[] | null;
  recommended_databases: string[] | null;
  team_composition: unknown;
  estimated_hours: number | null;
  estimated_cost: string | number | null;
  complexity_score: number | null;
  proposal: string | null;
  completed_at: string | null;
}

export interface CmReviewerTestCase {
  code_snippet_id: number;
  code: string;
}

export interface CmReviewerApplicationStart {
  application_id: number;
  test_cases: CmReviewerTestCase[];
  instructions: string;
}

export interface CmReviewerTestResult {
  status: string;
  similarity_score: number;
  message: string;
}

export interface CmReviewSubmission {
  id: number;
  task_id?: number;
  submission_note?: string | null;
  status?: string;
  files?: CmSubmissionFile[] | null;
  created_at?: string | null;
  task?: {
    id: number;
    title: string;
    description: string | null;
    required_skills: string[] | null;
    status: string;
  } | null;
}

export interface CmArchitectEligibility {
  is_eligible: boolean;
  is_architect: boolean;
  architect_status: string | null;
  reason: string | null;
  required_deposit: number;
  requirements: Record<string, number>;
  current_stats: Record<string, number>;
  shortfall: Record<string, number>;
}

export interface CmArchitectProject {
  id: number;
  title: string;
  status: string;
}

export interface CmArchitectTasks {
  is_architect: boolean;
  assigned_projects: CmArchitectProject[];
  available_projects: CmArchitectProject[];
}

export interface CmPayment {
  id: number;
  amount: string;
  currency?: string | null;
  status: string;
  type?: string | null;
  payment_method?: string | null;
  description?: string | null;
  project_id?: number | null;
  payer_id?: number;
  payee_id?: number;
  created_at?: string | null;
}

export interface CmDepositRecord {
  id: number;
  role_type: string;
  amount: string;
  payment_method: string;
  status: string;
  payment_url?: string | null;
  admin_notes?: string | null;
  paid_at: string | null;
  created_at: string | null;
}
