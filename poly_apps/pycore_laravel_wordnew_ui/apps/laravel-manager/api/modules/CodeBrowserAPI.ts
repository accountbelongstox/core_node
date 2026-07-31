import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

/**
 * CodeBrowserAPI — client for the purpose-built /code-browser/* web routes
 * (Laravel CodeBrowserController). Like the static-resources endpoints these
 * live at the HOST ROOT (no /api prefix), so URLs are built against
 * this.baseURL directly; the module prefix is irrelevant for these manual
 * fetches.
 *
 * Every code-browser route is gated by dashboard.auth on the backend (loopback
 * debug bypass OR Sanctum bearer), so this module forwards this.headers
 * (Authorization) — a logged-in remote user authenticates, while same-machine
 * dev needs no token. The backend returns FE-friendly shapes:
 *   file-tree -> { items:[{name,type,path,extension?,size?,modified,editable?}], path }  (ONE level)
 *   read-file -> { content, path, extension, size, modified }
 *   save-file -> { success, path } | { error }  (bare error normalized below)
 */
export class CodeBrowserAPI extends BaseAPI {
  /** One directory level of the code tree (lazy). path is repo-relative; '' = root. */
  async fileTree(path?: string): Promise<APIResponse> {
    try {
      const url = path
        ? `${this.baseURL}/code-browser/file-tree?path=${encodeURIComponent(path)}`
        : `${this.baseURL}/code-browser/file-tree`;
      const response = await fetch(url, { method: 'GET', headers: this.resolveRequestHeaders() });
      const data = await response.json();
      return {
        success: response.ok,
        data: data.data || data,
        error: response.ok ? null : data.error || 'Request failed',
        status: response.status
      };
    } catch (error: any) {
      return { success: false, data: null, error: error.message || 'Network error', status: 0 };
    }
  }

  /** Absolute read-file URL (used only as a download fallback; code is textual). */
  readFileUrl(path: string): string {
    return `${this.baseURL}/code-browser/read-file?path=${encodeURIComponent(path)}`;
  }

  /** Read a code file's text content. */
  async readFile(path: string): Promise<APIResponse> {
    try {
      const url = `${this.baseURL}/code-browser/read-file?path=${encodeURIComponent(path)}`;
      const response = await fetch(url, { method: 'GET', headers: this.resolveRequestHeaders() });
      const data = await response.json();
      return {
        success: response.ok,
        data: data.data || data,
        error: response.ok ? null : data.error || 'Request failed',
        status: response.status
      };
    } catch (error: any) {
      return { success: false, data: null, error: error.message || 'Network error', status: 0 };
    }
  }

  /** Save a code file's text content (backend keeps a .bak backup). */
  async saveFile(path: string, content: string): Promise<APIResponse> {
    try {
      const url = `${this.baseURL}/code-browser/save-file`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.resolveRequestHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ path, content })
      });
      const data = await response.json();
      return {
        success: response.ok,
        data: data.data || data,
        error: response.ok ? null : data.error || 'Save failed',
        status: response.status
      };
    } catch (error: any) {
      return { success: false, data: null, error: error.message || 'Save error', status: 0 };
    }
  }
}
