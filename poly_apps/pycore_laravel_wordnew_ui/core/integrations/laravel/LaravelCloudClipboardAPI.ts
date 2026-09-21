import { CLOUD_CLIPBOARD, type CloudClipboardAction, type CloudClipboardSnapshot, type CloudClipboardEntry } from '../../contracts/CloudClipboardContract';
import { BaseAPI } from './transport/BaseAPI';
import { createLaravelModuleConfig } from './transport/ApiContract';
import { readLaravelResponse, resolveLaravelBaseURL, withQuery } from './LaravelRequest';
import type { LaravelMercureAuthorization } from './LaravelMercureConnection';

interface Envelope<T> { success: boolean; data: T }
export interface ClipboardMutation {
  changed: boolean;
  revision: number;
  entry?: CloudClipboardEntry | null;
  removed_entry_id?: string | null;
  current_entry_id?: string;
}

const http = new BaseAPI({ ...createLaravelModuleConfig(''), timeout: 60000, retry: { count: 0, delay: 0 } });

export class LaravelCloudClipboardAPI {
  constructor(readonly namespace: string, private password = '') {}

  setPassword(password: string): void {
    this.password = password;
  }

  private async raw(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    resolveLaravelBaseURL();
    if (this.password) headers.set(CLOUD_CLIPBOARD.password_header,
      btoa(Array.from(new TextEncoder().encode(this.password), (byte) => String.fromCharCode(byte)).join('')));
    return http.rawRequest(withQuery(`${CLOUD_CLIPBOARD.api_prefix}/${path}`, {
      [CLOUD_CLIPBOARD.namespace_query]: this.namespace,
    }), { ...init, headers, cache: 'no-store', credentials: 'omit' }, false);
  }

  private async json<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.raw(path, init);
    const envelope = await readLaravelResponse<Envelope<T>>(response, path);
    return envelope.data;
  }

  snapshot(page: number, revision?: number, entryIds: string[] = []): Promise<CloudClipboardSnapshot | { unchanged: true; revision: number }> {
    return this.json(withQuery('data', { page, since_revision: revision, list_mode: 1, entry_ids: entryIds }));
  }

  generate(): Promise<{ namespace: string }> {
    return this.json('generate', { method: 'POST' });
  }

  authorize(): Promise<LaravelMercureAuthorization> {
    return this.json('hub-authorization', { method: 'POST' });
  }

  mutate(action: CloudClipboardAction, payload: Record<string, unknown> | FormData): Promise<ClipboardMutation> {
    const multipart = payload instanceof FormData;
    return this.json(action, {
      method: 'POST',
      headers: multipart ? undefined : { 'Content-Type': 'application/json' },
      body: multipart ? payload : JSON.stringify(payload),
    });
  }

  async file(entryId: string, fileId: string): Promise<Blob> {
    const response = await this.raw(withQuery('file', { entry_id: entryId, file_id: fileId }));
    if (!response.ok) await readLaravelResponse(response, 'file');
    return response.blob();
  }
}
