import { MasterApiClient, type MasterRequestOptions } from '../base';
import { StorageKeys, StorageManager } from '../../persistence';
import { normalizePycorePath } from './pycoreEndpoints';
import { rewritePycoreEndpoint } from './pycoreTarget';
import {
  PYCORE_HTTP_HEADER_NAMES,
  PYCORE_HTTP_JSON_CONTENT_TYPE,
} from './PycoreNetwork';

type ReachabilityHandler = (reachable: boolean) => void;

export class PycoreHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PycoreHttpError';
    this.status = status;
  }
}

export class PycoreMasterClient extends MasterApiClient {
  private browserId: string | null = null;
  private tabId: string | null = null;
  private clientId: string | null = null;
  private reachable = false;
  private readonly reachabilityHandlers = new Set<ReachabilityHandler>();

  protected resolveBaseUrl(): string {
    return rewritePycoreEndpoint('/').replace(/\/$/, '');
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
    const stored = StorageManager.getRaw(StorageKeys.PYCORE_HTTP_BROWSER_ID);
    this.browserId = stored || this.mintId('browser');
    if (!stored) StorageManager.setRaw(StorageKeys.PYCORE_HTTP_BROWSER_ID, this.browserId);
    return this.browserId;
  }

  getClientId(): string {
    if (this.clientId) return this.clientId;
    this.clientId = `${this.getBrowserId()}:${this.getTabId()}`;
    return this.clientId;
  }

  async getJson<T>(path: string, ceilingMs?: number, label: string = path): Promise<T> {
    return this.requestJson<T>(path, { method: 'GET', ceilingMs }, label);
  }

  async postJson<T>(
    path: string,
    body: unknown,
    ceilingMs?: number,
    label: string = path,
  ): Promise<T> {
    return this.requestJson<T>(
      path,
      {
        method: 'POST',
        ceilingMs,
        body: JSON.stringify(body ?? {}),
      },
      label,
    );
  }

  private async requestJson<T>(
    path: string,
    options: MasterRequestOptions,
    label: string,
  ): Promise<T> {
    const method = String(options.method || 'GET').toUpperCase();
    const requestId = method === 'GET' ? '' : this.newRequestId();
    const headers = method === 'GET'
      ? {
          [PYCORE_HTTP_HEADER_NAMES.accept]: PYCORE_HTTP_JSON_CONTENT_TYPE,
          ...((options.headers as Record<string, string> | undefined) ?? {}),
        }
      : {
          [PYCORE_HTTP_HEADER_NAMES.accept]: PYCORE_HTTP_JSON_CONTENT_TYPE,
          [PYCORE_HTTP_HEADER_NAMES.contentType]: PYCORE_HTTP_JSON_CONTENT_TYPE,
          [PYCORE_HTTP_HEADER_NAMES.requestId]: requestId,
          [PYCORE_HTTP_HEADER_NAMES.clientId]: this.getClientId(),
          [PYCORE_HTTP_HEADER_NAMES.browserId]: this.getBrowserId(),
          ...((options.headers as Record<string, string> | undefined) ?? {}),
        };
    let response: Response;
    try {
      response = await this.request(normalizePycorePath(path), { ...options, headers });
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
      const message = payload?.error?.message
        || payload?.message
        || (typeof payload?.error === 'string' ? payload.error : '')
        || `HTTP ${response.status}`;
      throw new PycoreHttpError(response.status, String(message));
    }
    return payload as T;
  }

  private setReachable(reachable: boolean): void {
    if (this.reachable === reachable) return;
    this.reachable = reachable;
    this.reachabilityHandlers.forEach((handler) => handler(reachable));
  }

  private getTabId(): string {
    if (this.tabId) return this.tabId;
    const stored = StorageManager.getSessionRaw(StorageKeys.PYCORE_HTTP_TAB_ID);
    this.tabId = stored || this.mintId('tab');
    if (!stored) StorageManager.setSessionRaw(StorageKeys.PYCORE_HTTP_TAB_ID, this.tabId);
    return this.tabId;
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
