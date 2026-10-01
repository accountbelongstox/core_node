import { MasterApiClient, type MasterRequestOptions } from '../../network/api-client';
import type { ServiceLink } from '../../network/ServiceLink';
import { isNetworkLevelFailure } from '../../network/NetworkFailure';
import { PYCORE_FAIL_FAST_ROUTES } from './PycoreHttpRoutes';
import { pycoreLink } from './PycoreServiceLink';
import { StorageManager } from '../../persistence';
import { PycoreStorageKeys as StorageKeys } from './PycoreStorageKeys';
import { normalizePycorePath } from './pycoreEndpoints';
import { rewritePycoreEndpoint } from './pycoreTarget';
import { pycoreTransportSelector } from './PycoreTransportSelector';
import {
  PYCORE_HTTP_HEADER_NAMES,
  PYCORE_HTTP_JSON_CONTENT_TYPE,
  PYCORE_HTTP_TEXT_CONTENT_TYPE,
  PYCORE_HTTP_PATHS,
  PYCORE_HEALTH_DEFAULTS,
} from './PycoreNetwork';

type ReachabilityHandler = (reachable: boolean) => void;

export class PycoreHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = '') {
    super(message);
    this.name = 'PycoreHttpError';
    this.status = status;
    this.code = code;
  }
}

export class PycoreMasterClient extends MasterApiClient {
  private browserId: string | null = null;
  private clientId: string | null = null;
  private clientIdFlight: Promise<string> | null = null;
  private reachable = false;
  private readonly reachabilityHandlers = new Set<ReachabilityHandler>();

  protected resolveBaseUrl(): string {
    return rewritePycoreEndpoint('/').replace(/\/$/, '');
  }

  /**
   * Relay-scheme leg: with an https backend selected, the single delivery
   * hook routes the request through the paired machine (relay data plane);
   * every other mode keeps the plain fetch. Queue/ceiling/replay semantics
   * of the master client apply unchanged on either leg.
   */
  protected deliver(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    return pycoreTransportSelector.deliver(
      url,
      init,
      signal,
      () => super.deliver(url, init, signal),
    );
  }

  /** The selected pycore's link; the relay entry delivers on its own. */
  protected serviceLink(): ServiceLink | null {
    return pycoreTransportSelector.usesLaravelRelay() ? null : pycoreLink;
  }

  isReachable(): boolean {
    return this.reachable;
  }

  onReachability(handler: ReachabilityHandler): () => void {
    this.reachabilityHandlers.add(handler);
    handler(this.reachable);
    return () => this.reachabilityHandlers.delete(handler);
  }

  getBrowserId(): string {
    if (this.browserId) return this.browserId;
    const stored = StorageManager.getRaw(StorageKeys.HTTP_BROWSER_ID);
    this.browserId = stored || this.mintId('browser');
    if (!stored) StorageManager.setRaw(StorageKeys.HTTP_BROWSER_ID, this.browserId);
    return this.browserId;
  }

  getClientId(): string {
    if (this.clientId) return this.clientId;
    const stored = StorageManager.getRaw(StorageKeys.HTTP_CLIENT_ID);
    if (stored) {
      this.clientId = stored;
      return stored;
    }
    return `pending:${this.getBrowserId()}`;
  }

  async ensureClientId(): Promise<string> {
    if (this.clientId) return this.clientId;
    const stored = this.getClientId();
    if (!stored.startsWith('pending:')) {
      this.clientId = stored;
      return stored;
    }
    if (pycoreTransportSelector.usesLaravelRelay()) {
      this.clientId = `relay-${this.getBrowserId()}`;
      StorageManager.setRaw(StorageKeys.HTTP_CLIENT_ID, this.clientId);
      return this.clientId;
    }
    if (this.clientIdFlight) return this.clientIdFlight;
    this.clientIdFlight = this.allocateClientId().finally(() => {
      this.clientIdFlight = null;
    });
    return this.clientIdFlight;
  }

  async getJson<T>(path: string, ceilingMs?: number, label: string = path): Promise<T> {
    return this.requestJson<T>(path, { method: 'GET', ceilingMs }, label);
  }

  /** Raw binary GET: same framing as JSON GETs, body returned undecoded. */
  async getBinary(path: string, ceilingMs?: number, label: string = path, signal?: AbortSignal): Promise<Response> {
    await this.ensureClientId();
    const headers = {
      [PYCORE_HTTP_HEADER_NAMES.accept]: PYCORE_HTTP_JSON_CONTENT_TYPE,
      [PYCORE_HTTP_HEADER_NAMES.clientId]: this.getClientId(),
      [PYCORE_HTTP_HEADER_NAMES.browserId]: this.getBrowserId(),
    };
    let response: Response;
    try {
      response = await this.request(normalizePycorePath(path), {
        method: 'GET',
        ceilingMs,
        headers,
        reconnect: !PYCORE_FAIL_FAST_ROUTES.has(label),
        ...(signal ? { signal } : {}),
      });
    } catch (error: any) {
      this.setReachable(false);
      if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
        throw new PycoreHttpError(0, `HTTP request ceiling reached: ${label}`);
      }
      throw error;
    }
    this.setReachable(true);
    return response;
  }

  /**
   * Headers of a direct request a native writer sends itself (clip bundles
   * written to disk): the same client identity as every other call.
   */
  async directHeaders(): Promise<Record<string, string>> {
    await this.ensureClientId();
    return {
      [PYCORE_HTTP_HEADER_NAMES.requestId]: this.newRequestId(),
      [PYCORE_HTTP_HEADER_NAMES.clientId]: this.getClientId(),
      [PYCORE_HTTP_HEADER_NAMES.browserId]: this.getBrowserId(),
    };
  }

  /** Raw binary POST: JSON body, response returned undecoded; `signal` aborts it. */
  async postBinary(path: string, body: unknown, ceilingMs?: number, label: string = path, signal?: AbortSignal): Promise<Response> {
    await this.ensureClientId();
    const headers = {
      [PYCORE_HTTP_HEADER_NAMES.contentType]: PYCORE_HTTP_JSON_CONTENT_TYPE,
      [PYCORE_HTTP_HEADER_NAMES.requestId]: this.newRequestId(),
      [PYCORE_HTTP_HEADER_NAMES.clientId]: this.getClientId(),
      [PYCORE_HTTP_HEADER_NAMES.browserId]: this.getBrowserId(),
    };
    let response: Response;
    try {
      response = await this.request(normalizePycorePath(path), {
        method: 'POST',
        ceilingMs,
        headers,
        body: JSON.stringify(body ?? {}),
        reconnect: !PYCORE_FAIL_FAST_ROUTES.has(label),
        ...(signal ? { signal } : {}),
      });
    } catch (error: any) {
      this.setReachable(false);
      if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
        throw new PycoreHttpError(0, `HTTP request ceiling reached: ${label}`);
      }
      throw error;
    }
    this.setReachable(true);
    return response;
  }

  /**
   * Multipart POST, progress-driven (aborts only on stall or `signal`). The form is
   * encoded once into a Blob with its boundary header so the direct and the relay leg
   * carry the same bytes.
   */
  async postForm<T>(
    path: string,
    form: FormData,
    options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
    label: string = path,
  ): Promise<T> {
    const encoded = new Request(location.origin, { method: 'POST', body: form });
    const body = await encoded.blob();
    return this.requestJson<T>(
      path,
      {
        method: 'POST',
        body,
        ceilingMs: 0,
        onUploadProgress: options.onProgress,
        ...(options.signal ? { signal: options.signal } : {}),
        headers: { [PYCORE_HTTP_HEADER_NAMES.contentType]: encoded.headers.get('content-type') ?? '' },
      },
      label,
    );
  }

  async postJson<T>(
    path: string,
    body: unknown,
    ceilingMs?: number,
    label: string = path,
    signal?: AbortSignal,
    onProgress?: (fraction: number) => void,
  ): Promise<T> {
    return this.requestJson<T>(
      path,
      {
        method: 'POST',
        ceilingMs,
        body: JSON.stringify(body ?? {}),
        ...(signal ? { signal } : {}),
        ...(onProgress ? { onProgress } : {}),
      },
      label,
    );
  }

  async postText<T>(
    path: string,
    body: string,
    ceilingMs?: number,
    label: string = path,
  ): Promise<T> {
    return this.requestJson<T>(
      path,
      {
        method: 'POST',
        ceilingMs,
        body,
        headers: {
          [PYCORE_HTTP_HEADER_NAMES.contentType]: PYCORE_HTTP_TEXT_CONTENT_TYPE,
        },
      },
      label,
    );
  }

  private async requestJson<T>(
    path: string,
    options: MasterRequestOptions,
    label: string,
  ): Promise<T> {
    await this.ensureClientId();
    const method = String(options.method || 'GET').toUpperCase();
    const requestId = method === 'GET' ? '' : this.newRequestId();
    const headers = {
      [PYCORE_HTTP_HEADER_NAMES.accept]: PYCORE_HTTP_JSON_CONTENT_TYPE,
      [PYCORE_HTTP_HEADER_NAMES.clientId]: this.getClientId(),
      [PYCORE_HTTP_HEADER_NAMES.browserId]: this.getBrowserId(),
      ...(method === 'GET' ? {} : {
        [PYCORE_HTTP_HEADER_NAMES.contentType]: PYCORE_HTTP_JSON_CONTENT_TYPE,
        [PYCORE_HTTP_HEADER_NAMES.requestId]: requestId,
      }),
      ...((options.headers as Record<string, string> | undefined) ?? {}),
    };
    let response: Response;
    try {
      response = await this.request(normalizePycorePath(path), {
        ...options,
        headers,
        reconnect: !PYCORE_FAIL_FAST_ROUTES.has(label),
      });
    } catch (error: any) {
      this.setReachable(false);
      if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
        throw new PycoreHttpError(0, `HTTP request ceiling reached: ${label}`);
      }
      throw error;
    }
    this.setReachable(true);

    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || '';
    const payload: any = responseText && contentType.includes(PYCORE_HTTP_JSON_CONTENT_TYPE)
      ? JSON.parse(responseText)
      : responseText || null;
    if (!response.ok) {
      const code = typeof payload?.error?.code === 'string' ? payload.error.code
        : typeof payload?.error_code === 'string' ? payload.error_code : '';
      const message = payload?.error?.message
        || payload?.message
        || (typeof payload?.error === 'string' ? payload.error : '')
        || code
        || `HTTP ${response.status}`;
      throw new PycoreHttpError(response.status, String(message), code);
    }
    return payload as T;
  }

  private setReachable(reachable: boolean): void {
    if (this.reachable === reachable) return;
    this.reachable = reachable;
    this.reachabilityHandlers.forEach((handler) => handler(reachable));
  }

  /** A client id from pycore; the provisional one (asked again next time) while it is unreachable. */
  private async allocateClientId(): Promise<string> {
    const provisionalId = `pending:${this.getBrowserId()}`;
    let response: Response;
    try {
      response = await this.request(
        normalizePycorePath(PYCORE_HTTP_PATHS.clientId),
        {
          method: 'POST',
          reconnect: false,
          ceilingMs: PYCORE_HEALTH_DEFAULTS.pingTimeoutMs,
          headers: {
            [PYCORE_HTTP_HEADER_NAMES.accept]: PYCORE_HTTP_JSON_CONTENT_TYPE,
            [PYCORE_HTTP_HEADER_NAMES.contentType]: PYCORE_HTTP_JSON_CONTENT_TYPE,
            [PYCORE_HTTP_HEADER_NAMES.browserId]: this.getBrowserId(),
          },
          body: JSON.stringify({
            browser_id: this.getBrowserId(),
          }),
        },
      );
    } catch (error) {
      if (isNetworkLevelFailure(error)) return provisionalId;
      throw error;
    }
    if (!response.ok) {
      return provisionalId;
    }
    const payload = await response.json() as { client_id?: string };
    const assignedId = String(payload.client_id || provisionalId);
    this.clientId = assignedId;
    StorageManager.setRaw(StorageKeys.HTTP_CLIENT_ID, assignedId);
    return assignedId;
  }

  private newRequestId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return this.mintId('req');
  }

  private mintId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

export const pycoreMasterClient = new PycoreMasterClient();
