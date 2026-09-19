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
  tasks?: CmTask[];
}

export interface CmProjectDetail extends CmProject {
  architect_id?: number | null;
  milestones?: CmMilestone[];
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

export interface CmDepositInfo {
  required_deposit: number;
  current_deposit: number;
  is_sufficient: boolean;
  shortfall: number;
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
  created_at?: string | null;
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
  paid_at: string | null;
  created_at: string | null;
}
