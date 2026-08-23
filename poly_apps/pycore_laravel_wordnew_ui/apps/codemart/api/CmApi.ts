import { BaseAPI } from '../../../core/integrations/laravel/transport/BaseAPI';
import {
  createLaravelModuleConfig,
  LARAVEL_API_PREFIX,
} from '../../../core/integrations/laravel/transport/ApiContract';
import type {
  CmPublicHomeData,
  CmPublicHomeLoadResult,
  CmPublicTestimonialData,
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
}

export const cmApi = new CmApi();
