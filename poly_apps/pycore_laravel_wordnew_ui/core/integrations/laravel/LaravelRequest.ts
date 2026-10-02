import { BaseAPI, getSharedAuthToken, getSharedBaseURL, setSharedBaseURL } from './transport/BaseAPI';
import { createLaravelModuleConfig, LARAVEL_API_PREFIX } from './transport/ApiContract';
import { apiManager } from './ApiManager';
import { buildApiUrl } from './LaravelEndpoints';
import { coordinateRequest } from '../../network/RequestCoordinator';
import i18n from '../../i18n/UiI18n';
import { requestGlobalLogin } from './transport/LoginRequestBridge';
import { clientKeyFailureCode, clientKeyFailureMessage } from './ClientKeyFailure';

type LaravelMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const ADMIN_REQUIRED_MESSAGE_KEY = 'common.laravel_admin_required';

export const laravelHttp = new BaseAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.root));

export function resolveLaravelBaseURL(): string {
  const selectedEndpoint = apiManager.getCurrentEndpoint() ?? apiManager.preselectEndpointSync();
  const baseURL = selectedEndpoint ? buildApiUrl(selectedEndpoint) : laravelHttp.getBaseURL();
  if (getSharedBaseURL() !== baseURL) setSharedBaseURL(baseURL);
  return baseURL;
}

export async function readLaravelResponse<T>(response: Response, path: string): Promise<T> {
  const invalid = Symbol();
  const json = response.headers.get('content-type')?.includes('json') === true;
  const body = json ? await response.json().catch(() => invalid) : invalid;
  const code = typeof body?.error_code === 'string' ? body.error_code
    : typeof body?.code === 'string' ? body.code : `LARAVEL_HTTP_${response.status}`;
  const message = typeof body?.message === 'string' ? body.message.slice(0, 512) : code;
  if (!response.ok) {
    throw Object.assign(new Error(`${code}: ${path}: ${message}`), {
      status: response.status, code, path, payload: body,
    });
  }
  if (body === invalid) {
    throw Object.assign(new Error('LARAVEL_RESPONSE_JSON_INVALID'), { status: response.status, path });
  }
  return body as T;
}

/**
 * Shared-session response: a 401 opens the shared login window (as BaseAPI.send
 * does); a 403 carries the i18n "administrator required" message.
 */
async function readSessionResponse<T>(response: Response, path: string): Promise<T> {
  try {
    return await readLaravelResponse<T>(response, path);
  } catch (error) {
    if (response.status === UNAUTHORIZED_STATUS) {
      const clientKeyCode = clientKeyFailureCode((error as { payload?: unknown }).payload);
      // A rejected client key is not fixed by a login: its own message is thrown instead.
      if (clientKeyCode) throw Object.assign(new Error(clientKeyFailureMessage(clientKeyCode)), error as object, { code: clientKeyCode });
      requestGlobalLogin();
    }
    if (response.status !== FORBIDDEN_STATUS) throw error;
    throw Object.assign(new Error(i18n.t(ADMIN_REQUIRED_MESSAGE_KEY)), error as object);
  }
}

export function withQuery(path: string, params: Record<string, unknown> = {}): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(`${key}[]`, String(item)));
      return;
    }
    query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `${path}${path.includes('?') ? '&' : '?'}${suffix}` : path;
}

export async function requestLaravel<T>(
  method: LaravelMethod,
  path: string,
  payload?: unknown,
  cacheTtlMs = 0,
): Promise<T> {
  // Central transport invariant: every Laravel route, including assist
  // overview, follows the endpoint persisted by ApiManager. This defensive
  // synchronization also repairs stale module state after Vite HMR.
  resolveLaravelBaseURL();
  const hasBody = method !== 'GET' && payload !== undefined;
  const requestPath = method === 'GET'
    ? withQuery(path, (payload || {}) as Record<string, unknown>)
    : path;
  const execute = async (): Promise<T> => {
    const response = await laravelHttp.rawRequest(requestPath, {
      method,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(payload) : undefined,
    });
    return readSessionResponse<T>(response, requestPath);
  };
  if (method !== 'GET') return execute();
  const baseURL = getSharedBaseURL() ?? '';
  const auth = getSharedAuthToken() ?? 'anonymous';
  return coordinateRequest(
    `laravel-read:${auth}:${baseURL}:${requestPath}`,
    execute,
    cacheTtlMs,
  );
}
