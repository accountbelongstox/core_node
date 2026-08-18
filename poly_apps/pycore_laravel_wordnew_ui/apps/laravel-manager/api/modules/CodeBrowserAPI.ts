import { BaseAPI } from '../../../../core/integrations/laravel/transport/BaseAPI';
import { APIResponse } from '../../types';

/**
 * CodeBrowserAPI — client for the purpose-built /code-browser/* web routes
 * (Laravel CodeBrowserController). Like the static-resources endpoints these
 * live at the host root and use the shared BaseAPI request path.
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
    return this.get('file-tree', path ? { path } : undefined, false);
  }

  /** Absolute read-file URL (used only as a download fallback; code is textual). */
  readFileUrl(path: string): string {
    return this.addQueryParams(this.buildURL('read-file'), { path });
  }

  /** Read a code file's text content. */
  async readFile(path: string): Promise<APIResponse> {
    return this.get('read-file', { path }, false);
  }

  /** Save a code file's text content (backend keeps a .bak backup). */
  async saveFile(path: string, content: string): Promise<APIResponse> {
    return this.post('save-file', { path, content });
  }
}
