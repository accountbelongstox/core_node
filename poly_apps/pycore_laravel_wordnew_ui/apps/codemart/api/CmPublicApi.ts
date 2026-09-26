import { BaseAPI } from '../../../core/integrations/laravel/transport/BaseAPI';
import {
  createLaravelModuleConfig,
  LARAVEL_API_PREFIX,
} from '../../../core/integrations/laravel/transport/ApiContract';
import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import type { CmEstimateInput, CmEstimateResult, CmPublicHomeData, CmPublicTestimonialData } from './CmApiTypes';

const PUBLIC_HOME_CACHE_TTL_MS = 60_000;
const ESTIMATE_OPTIONS_CACHE_TTL_MS = 300_000;
const SHOWCASE_CACHE_TTL_MS = 30_000;
const FORGOT_PASSWORD_PATH = 'api/forgot-password';
const RESET_PASSWORD_PATH = 'api/reset-password';
const CM_PUBLIC_LOCALES = ['en', 'zh'] as const;

export type CmPublicLocale = typeof CM_PUBLIC_LOCALES[number];

export interface CmPublicHomeSnapshot extends CmPublicHomeData {
  total_amount_source: 'escrow' | 'published_budgets' | null;
  active_task_count: number | null;
  locale: string | null;
}

export interface CmPublicHomeResult {
  data: CmPublicHomeSnapshot | null;
  errorCode: string | null;
}

export interface CmEstimateLimits {
  min: number;
  max: number;
  default: number;
}

export interface CmEstimateOptions {
  complexities: string[];
  budget_types: string[];
  currency: string;
  platforms: CmEstimateLimits;
  features: CmEstimateLimits;
  default_complexity: string;
  default_budget_type: string;
}

export interface CmEstimateTeamRole {
  role: string;
  count: number;
}

export interface CmPublicEstimateResult extends CmEstimateResult {
  budget_type?: string;
  team_roles?: CmEstimateTeamRole[];
  hourly_rate_min?: string | null;
  hourly_rate_max?: string | null;
}

export interface CmBudgetRange {
  min: string;
  max: string;
}

export interface CmShowcaseTask {
  id: number;
  title: string;
  skills: string[];
  budget_range: CmBudgetRange | null;
  currency: string | null;
  category: string | null;
  budget_type: string | null;
  priority: string | null;
  due_date: string | null;
}

export interface CmShowcaseProject {
  id: number;
  title: string;
  category: string | null;
  skills: string[];
  duration_days: number | null;
  completed_at: string | null;
}

export interface CmShowcaseSection<T> {
  total: number;
  items: T[];
}

export interface CmShowcaseData {
  page: number;
  page_size: number;
  open_tasks: CmShowcaseSection<CmShowcaseTask>;
  completed_projects: CmShowcaseSection<CmShowcaseProject>;
}

export interface CmContactPayload {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

export interface CmPasswordResetPayload {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function asText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asText).filter((item): item is string => item !== null) : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function normalizeTestimonial(value: unknown): CmPublicTestimonialData | null {
  const source = asRecord(value);
  if (!source) return null;
  const id = asText(source.id);
  const quote = asText(source.quote);
  const authorLabel = asText(source.author_label);
  if (!id || !quote || !authorLabel) return null;
  return {
    id,
    quote,
    author_label: authorLabel,
    role_label: asText(source.role_label) ?? '',
    avatar_url: asText(source.avatar_url),
  };
}

function normalizeHome(value: unknown): CmPublicHomeSnapshot | null {
  const source = asRecord(value);
  if (!source) return null;
  const amountSource = source.total_amount_source === 'escrow' || source.total_amount_source === 'published_budgets'
    ? source.total_amount_source
    : null;
  return {
    total_amount: asText(source.total_amount),
    total_amount_source: amountSource,
    currency: asText(source.currency),
    project_count: asNumber(source.project_count),
    developer_count: asNumber(source.developer_count),
    active_task_count: asNumber(source.active_task_count),
    locale: asText(source.locale),
    testimonials: Array.isArray(source.testimonials)
      ? source.testimonials.map(normalizeTestimonial).filter((item): item is CmPublicTestimonialData => item !== null)
      : [],
  };
}

function normalizeLimits(value: unknown, fallback: CmEstimateLimits): CmEstimateLimits {
  const source = asRecord(value);
  if (!source) return fallback;
  const min = asNumber(source.min) ?? fallback.min;
  const max = asNumber(source.max) ?? fallback.max;
  const initial = asNumber(source.default) ?? fallback.default;
  return { min, max, default: Math.min(max, Math.max(min, initial)) };
}

function normalizeEstimateOptions(value: unknown): CmEstimateOptions | null {
  const source = asRecord(value);
  if (!source) return null;
  const complexities = asStringList(source.complexities);
  const budgetTypes = asStringList(source.budget_types);
  if (complexities.length === 0) return null;
  const platformFallback = { min: 1, max: asNumber(source.max_platforms) ?? 1, default: 1 };
  const featureFallback = { min: 1, max: asNumber(source.max_features) ?? 1, default: 1 };
  const defaultComplexity = asText(source.default_complexity);
  const defaultBudgetType = asText(source.default_budget_type);
  return {
    complexities,
    budget_types: budgetTypes,
    currency: asText(source.currency) ?? '',
    platforms: normalizeLimits(source.platforms, platformFallback),
    features: normalizeLimits(source.features, featureFallback),
    default_complexity: defaultComplexity && complexities.includes(defaultComplexity) ? defaultComplexity : complexities[0],
    default_budget_type: defaultBudgetType && budgetTypes.includes(defaultBudgetType) ? defaultBudgetType : (budgetTypes[0] ?? ''),
  };
}

function normalizeRange(value: unknown): CmBudgetRange | null {
  const source = asRecord(value);
  if (!source) return null;
  const min = asText(source.min);
  const max = asText(source.max);
  return min && max ? { min, max } : null;
}

function normalizeShowcaseTask(value: unknown): CmShowcaseTask | null {
  const source = asRecord(value);
  const id = source ? asNumber(source.id) : null;
  if (!source || id === null) return null;
  return {
    id,
    title: asText(source.title) ?? '',
    skills: asStringList(source.skills),
    budget_range: normalizeRange(source.budget_range),
    currency: asText(source.currency),
    category: asText(source.category),
    budget_type: asText(source.budget_type),
    priority: asText(source.priority),
    due_date: asText(source.due_date),
  };
}

function normalizeShowcaseProject(value: unknown): CmShowcaseProject | null {
  const source = asRecord(value);
  const id = source ? asNumber(source.id) : null;
  if (!source || id === null) return null;
  return {
    id,
    title: asText(source.title) ?? '',
    category: asText(source.category),
    skills: asStringList(source.skills),
    duration_days: asNumber(source.duration_days),
    completed_at: asText(source.completed_at),
  };
}

function normalizeSection<T>(value: unknown, mapItem: (item: unknown) => T | null): CmShowcaseSection<T> {
  const source = asRecord(value);
  const items = source && Array.isArray(source.items)
    ? source.items.map(mapItem).filter((item): item is T => item !== null)
    : [];
  return { total: (source ? asNumber(source.total) : null) ?? items.length, items };
}

function normalizeShowcase(value: unknown, page: number, pageSize: number): CmShowcaseData | null {
  const source = asRecord(value);
  if (!source) return null;
  return {
    page: asNumber(source.page) ?? page,
    page_size: asNumber(source.page_size) ?? pageSize,
    open_tasks: normalizeSection(source.open_tasks, normalizeShowcaseTask),
    completed_projects: normalizeSection(source.completed_projects, normalizeShowcaseProject),
  };
}

function withData<T>(response: APIResponse<unknown>, data: T | null): APIResponse<T> {
  return { ...response, data, success: response.success && data !== null };
}

/** Resolve the UI language to a locale the public CodeMart endpoints accept. */
export function resolveCmPublicLocale(language: string | undefined): CmPublicLocale {
  const primary = (language ?? '').toLowerCase().slice(0, 2);
  return (CM_PUBLIC_LOCALES as readonly string[]).includes(primary) ? primary as CmPublicLocale : 'en';
}

/** Anonymous CodeMart endpoints used by the public showcase interface. */
export class CmPublicApi extends BaseAPI {
  constructor() {
    super(createLaravelModuleConfig(LARAVEL_API_PREFIX.codeMartV1));
  }

  async getHome(locale: CmPublicLocale): Promise<CmPublicHomeResult> {
    const response = await this.get<unknown>('public/home', { locale }, true, PUBLIC_HOME_CACHE_TTL_MS, false);
    if (!response.success) {
      const code = response.debugInfo?.error_code;
      return { data: null, errorCode: typeof code === 'string' && code ? code : 'public_home_unavailable' };
    }
    const data = normalizeHome(response.data);
    return { data, errorCode: data ? null : 'public_home_unavailable' };
  }

  async getEstimateOptions(): Promise<APIResponse<CmEstimateOptions>> {
    const response = await this.get<unknown>('public/estimate-options', undefined, true, ESTIMATE_OPTIONS_CACHE_TTL_MS, false);
    return withData(response, response.success ? normalizeEstimateOptions(response.data) : null);
  }

  async estimate(input: CmEstimateInput): Promise<APIResponse<CmPublicEstimateResult>> {
    return this.post<CmPublicEstimateResult>('public/estimate', input);
  }

  async getShowcase(page: number, pageSize: number): Promise<APIResponse<CmShowcaseData>> {
    const response = await this.get<unknown>('public/showcase', { page, page_size: pageSize }, true, SHOWCASE_CACHE_TTL_MS, false);
    return withData(response, response.success ? normalizeShowcase(response.data, page, pageSize) : null);
  }

  async submitContact(payload: CmContactPayload): Promise<APIResponse<{ id: number; status: string }>> {
    return this.post<{ id: number; status: string }>('public/contact', payload);
  }

  async requestPasswordReset(email: string): Promise<APIResponse<{ status?: string }>> {
    return this.request<{ status?: string }>({ url: FORGOT_PASSWORD_PATH, method: 'POST', data: { email }, root: true });
  }

  async resetPassword(payload: CmPasswordResetPayload): Promise<APIResponse<{ status?: string }>> {
    return this.request<{ status?: string }>({ url: RESET_PASSWORD_PATH, method: 'POST', data: payload, root: true });
  }
}

export const cmPublicApi = new CmPublicApi();
