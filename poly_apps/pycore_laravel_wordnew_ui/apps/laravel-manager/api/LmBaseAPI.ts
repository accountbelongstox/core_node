import {
  BaseAPI,
  createIdempotencyKey,
  IDEMPOTENCY_KEY_HEADER,
} from '../../../core/integrations/laravel/transport/BaseAPI';
import type { APIRequestConfig, APIResponse } from '../types';
import i18n from '../i18n';

/** `dashboard.auth` refusal for an account below the route's admin level. */
const DASHBOARD_FORBIDDEN_CODE = 'AUTH_FORBIDDEN';
/** The same Idempotency-Key is still running on the server. */
const IDEMPOTENCY_IN_PROGRESS_CODE = 'IDEMPOTENCY_IN_PROGRESS';
const HTTP_SERVER_ERROR = 500;
/** Idempotency-Key per user action; kept while the outcome is unknown so a retry replays or joins it. */
const actionKeys = new Map<string, string>();

/**
 * Laravel Manager transport. Operator routes run behind `dashboard.auth`:
 * a missing login (401), a missing admin level (403 AUTH_FORBIDDEN) and a
 * still-running idempotent write (409 IDEMPOTENCY_IN_PROGRESS) reach the UI
 * as lm i18n text instead of the server's untranslated token. Coded failures
 * (`error_code`) keep their own mapping.
 */
export class LmBaseAPI extends BaseAPI {
  protected async request<T>(config: APIRequestConfig, retryCount: number = 0): Promise<APIResponse<T>> {
    return localizeFailure(await super.request<T>(config, retryCount));
  }

  protected async uploadWithProgress<T>(
    path: string,
    data: FormData,
    onProgress: (percentage: number) => void,
    root = false,
  ): Promise<APIResponse<T>> {
    return localizeFailure(await super.uploadWithProgress<T>(path, data, onProgress, root));
  }

  /**
   * Send a write under one Idempotency-Key per `action`. The key survives a
   * network failure, a 5xx or an in-progress answer, so the operator's retry
   * gets the stored result or joins the running one instead of running twice.
   */
  protected async requestIdempotent<T>(action: string, config: APIRequestConfig): Promise<APIResponse<T>> {
    const key = actionKeys.get(action) ?? createIdempotencyKey();
    actionKeys.set(action, key);
    const response = await this.request<T>({
      ...config,
      headers: { ...config.headers, [IDEMPOTENCY_KEY_HEADER]: key },
    });
    const outcomeUnknown = response.status === 0
      || response.status >= HTTP_SERVER_ERROR
      || response.debugInfo?.code === IDEMPOTENCY_IN_PROGRESS_CODE;
    if (!outcomeUnknown) actionKeys.delete(action);
    return response;
  }
}

function localizeFailure<T>(response: APIResponse<T>): APIResponse<T> {
  if (response.success || response.debugInfo?.error_code) return response;
  if (response.status === 401) return { ...response, error: i18n.t('auth.login_hint') };
  if (response.status === 403 && response.debugInfo?.code === DASHBOARD_FORBIDDEN_CODE) {
    return { ...response, error: i18n.t('auth.admin_required') };
  }
  if (response.debugInfo?.code === IDEMPOTENCY_IN_PROGRESS_CODE) {
    return { ...response, error: i18n.t('common.still_running') };
  }
  return response;
}
