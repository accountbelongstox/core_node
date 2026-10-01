/** Pycore HTTP request controller: one traced entry per call shape, routes and methods from the RPC contract. */

import { PycorePaths } from './pycoreEndpoints';
import { rewritePycoreEndpoint, isPycoreRelayMode } from './pycoreTarget';
import { appendHttpDebug, summarizeHttpParams } from './pycoreHttpLog';
import { PycoreHttpError, pycoreMasterClient } from './PycoreClient';
import { readBytesWithStallGuard } from '../../network/StallGuardedRead';
import { PYCORE_DIRECT_ONLY_CODE, PYCORE_STATUS_ROUTE, isPycoreRouteDirectOnly, pycoreRouteMethod, type PycoreRouteMethod } from './PycoreHttpRoutes';

type HttpQueryParams = Record<string, string | number | boolean | null | undefined>;

async function requestHttp(
  route: string,
  params: any,
  timeoutMs?: number,
  path: string = PycorePaths.api(route),
  method: 'GET' | 'POST' = 'POST',
  signal?: AbortSignal,
  onProgress?: (fraction: number) => void,
): Promise<any> {
  if (isPycoreRelayMode() && isPycoreRouteDirectOnly(route)) {
    return Promise.reject(new PycoreHttpError(403, `${route} is direct-only`, PYCORE_DIRECT_ONLY_CODE));
  }
  return method === 'GET'
    ? pycoreMasterClient.getJson(path, timeoutMs, route)
    : pycoreMasterClient.postJson(path, params, timeoutMs, route, signal, onProgress);
}

function appendHttpQuery(path: string, params: HttpQueryParams): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

export function getBrowserId(): string {
  return pycoreMasterClient.getBrowserId();
}

export function getClientId(): string {
  return pycoreMasterClient.getClientId();
}

interface TracedRequest {
  method: PycoreRouteMethod;
  route: string;
  routePath: string;
  paramsSummary: string;
}

function tracedRequest<T>(
  request: TracedRequest,
  send: () => Promise<T>,
  statusOf: (result: T) => number = () => 200,
): Promise<T> {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const startedAt = now();
  const fullUrl = rewritePycoreEndpoint(request.routePath);
  const record = (status: number, error?: string | null) => {
    appendHttpDebug({
      direction: 'pycore',
      method: request.method,
      route: request.route,
      path: request.routePath,
      fullUrl,
      paramsSummary: request.paramsSummary,
      status,
      ms: now() - startedAt,
      error: error || null,
    });
  };
  return send()
    .then((result) => {
      record(statusOf(result));
      return result;
    })
    .catch((error: any) => {
      record(error instanceof PycoreHttpError ? error.status : 0, error?.message || String(error));
      throw error;
    });
}

/** JSON call: the route's contract method carries `params` as body (POST) or query (GET). */
export function requestPycoreHttp(
  route: string,
  params: any = {},
  timeoutMs?: number,
  signal?: AbortSignal,
  onProgress?: (fraction: number) => void,
): Promise<any> {
  const method = pycoreRouteMethod(route);
  const routePath = method === 'GET' ? appendHttpQuery(PycorePaths.api(route), params) : PycorePaths.api(route);
  return tracedRequest(
    { method, route, routePath, paramsSummary: summarizeHttpParams(params) },
    () => requestHttp(route, params, timeoutMs, routePath, method, signal, onProgress),
  );
}

export function requestPycoreHttpText(
  route: string,
  text: string,
  queryParams: HttpQueryParams = {},
  timeoutMs?: number,
): Promise<any> {
  const routePath = appendHttpQuery(PycorePaths.api(route), queryParams);
  return tracedRequest(
    { method: 'POST', route, routePath, paramsSummary: summarizeHttpParams({ ...queryParams, text_length: text.length }) },
    () => pycoreMasterClient.postText(routePath, text, timeoutMs, route),
  );
}

/** Multipart upload: progress-driven (aborts only on stall or `signal`), one traced entry like every other call. */
export function requestPycoreHttpUpload<T = any>(
  route: string,
  form: FormData,
  queryParams: HttpQueryParams = {},
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<T> {
  const routePath = appendHttpQuery(PycorePaths.api(route), queryParams);
  return tracedRequest(
    { method: 'POST', route, routePath, paramsSummary: summarizeHttpParams({ ...queryParams, multipart: true }) },
    () => pycoreMasterClient.postForm<T>(routePath, form, options, route),
  );
}

export interface PycoreHttpBinaryResult {
  status: number;
  bytes: Uint8Array | null;
}

async function binaryResult(response: Response, signal?: AbortSignal): Promise<PycoreHttpBinaryResult> {
  return {
    status: response.status,
    bytes: response.status === 200 ? await readBytesWithStallGuard(response, { signal }) : null,
  };
}

export function requestPycoreHttpBinary(
  route: string,
  queryParams: HttpQueryParams = {},
  timeoutMs?: number,
  signal?: AbortSignal,
): Promise<PycoreHttpBinaryResult> {
  const routePath = appendHttpQuery(PycorePaths.api(route), queryParams);
  return tracedRequest(
    { method: 'GET', route, routePath, paramsSummary: summarizeHttpParams(queryParams) },
    () => pycoreMasterClient.getBinary(routePath, timeoutMs, route, signal).then((response) => binaryResult(response, signal)),
    (result) => result.status,
  );
}

/**
 * A direct request (URL, client-identity headers, JSON body) a native writer
 * sends itself - e.g. clip bundles written straight to disk; null in relay mode
 * (relayed requests must ride the Laravel relay transport).
 */
export async function pycoreDirectRequest(route: string, params: unknown): Promise<{ url: string; headers: Record<string, string>; body: unknown } | null> {
  if (isPycoreRelayMode()) return null;
  return { url: rewritePycoreEndpoint(PycorePaths.api(route)), headers: await pycoreMasterClient.directHeaders(), body: params };
}

/** Binary POST (JSON params in, raw body out): one bundle of clips. */
export function requestPycoreHttpBinaryPost(
  route: string,
  params: any = {},
  timeoutMs?: number,
  signal?: AbortSignal,
): Promise<PycoreHttpBinaryResult> {
  const routePath = PycorePaths.api(route);
  return tracedRequest(
    { method: 'POST', route, routePath, paramsSummary: summarizeHttpParams(params) },
    () => pycoreMasterClient.postBinary(routePath, params, timeoutMs, route, signal).then((response) => binaryResult(response, signal)),
    (result) => result.status,
  );
}

export function requestPycoreStatus(timeoutMs?: number): Promise<any> {
  return requestHttp(PYCORE_STATUS_ROUTE, {}, timeoutMs, PycorePaths.status, 'GET');
}
