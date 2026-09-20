import { BaseAPI, getSharedAuthToken, getSharedBaseURL, setSharedBaseURL } from './transport/BaseAPI';
import { createLaravelModuleConfig, LARAVEL_API_PREFIX } from './transport/ApiContract';
import { apiManager } from './ApiManager';
import { buildApiUrl } from './LaravelEndpoints';
import { coordinateRequest } from '../../network/RequestCoordinator';

type LaravelMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

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
    return readLaravelResponse<T>(response, requestPath);
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
