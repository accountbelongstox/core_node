import { BaseAPI } from '../../../../core/integrations/laravel/transport/BaseAPI';
import { APIResponse } from '../../types';
import type { FrankenPhpSiteRequest, NginxSite } from '../../uiTypes';
import { LARAVEL_API_ROUTE } from '../../../../core/integrations/laravel/transport/ApiContract';

type NginxSiteType = NginxSite['site_type'];
const FRANKENPHP_CONFIG_TIMEOUT_MS = 3 * 60 * 1000;
const FRANKENPHP_RELOAD_POLL_INTERVAL_MS = 1000;
const FRANKENPHP_RELOAD_POLL_LIMIT = 180;

/** Map backend listSites fields (`name`, `root_directory`, `config_type`) to UI shape. */
const normalizeNginxSite = (site: Record<string, unknown>): NginxSite => {
  const siteName = String(site.site_name ?? site.name ?? '');
  const serverNames = Array.isArray(site.server_names) ? site.server_names as string[] : [];
  const configType = typeof site.config_type === 'string' ? site.config_type : undefined;
  let siteType: NginxSiteType = 'static';
  if (site.site_type === 'laravel' || site.site_type === 'static' || site.site_type === 'proxy' || site.site_type === 'nuxt') {
    siteType = site.site_type;
  } else if (configType === 'proxy') {
    siteType = 'proxy';
  } else if (configType === 'php') {
    siteType = 'laravel';
  }

  return {
    ...(site as unknown as NginxSite),
    site_name: siteName,
    domain: String(site.domain ?? serverNames[0] ?? siteName),
    site_type: siteType,
    www_dir: String(site.www_dir ?? site.root_directory ?? ''),
    php_mode: site.php_mode === 'fpm' || site.php_mode === 'swoole'
      ? site.php_mode
      : configType === 'php' ? 'fpm' : 'swoole',
    config_path: String(site.config_path ?? site.config_file ?? ''),
    listen_ports: Array.isArray(site.listen_ports) ? site.listen_ports as NginxSite['listen_ports'] : undefined,
    server_names: serverNames.length > 0 ? serverNames : undefined,
    ssl_enabled: Boolean(site.ssl_enabled),
    enabled: Boolean(site.enabled),
    created_at: String(site.created_at ?? ''),
    updated_at: String(site.updated_at ?? site.modified_human ?? ''),
  };
};

/**
 * ServerManagerV1 API Module
 * Server management system API
 */
export class ServerManagerV1API extends BaseAPI {
  // ========== System Information ==========
  async getSystemInfo(): Promise<APIResponse> {
    return this.get('/system/info', undefined, true, 300000); // Cache 5 minutes
  }

  async getProcesses(): Promise<APIResponse> {
    return this.get('/system/processes');
  }

  async getServices(): Promise<APIResponse> {
    return this.get('/system/services');
  }

  async getPermissions(): Promise<APIResponse> {
    return this.get('/system/permissions');
  }

  async getStorage(): Promise<APIResponse> {
    const response = await this.get('/system/storage');
    const data = response.data as Record<string, unknown> | undefined;
    if (response.success && data && !Array.isArray(data)) {
      data.disk_usage_mounts = data.disk_usage ?? [];
    }
    return response;
  }

  async getStaticResourcesSummary(): Promise<APIResponse> {
    return this.get('/system/static-resources');
  }

  async listStaticResourceFiles(params: {
    path: string;
    q?: string;
    sort?: 'name' | 'size' | 'modified';
    order?: 'asc' | 'desc';
    page?: number;
    per_page?: number;
  }): Promise<APIResponse> {
    return this.get('/system/static-resources/files', {
      path: params.path,
      q: params.q || undefined,
      sort: params.sort || 'name',
      order: params.order || 'asc',
      page: params.page ?? 1,
      per_page: params.per_page ?? 100,
    });
  }

  // ========== File Management ==========
  /**
   * Browse a directory. The backend returns each item with `is_directory`,
   * `path`, `name`, `size`, ... but NO `type` discriminator. The file browsers
   * (CodeBrowser, CodeBrowserV2, ServerManager) branch on `type === 'directory'`,
   * so we normalize a `type` field onto every item here (single point of fix),
   * keeping `is_directory`/`path` intact.
   */
  async browseFiles(arg?: string | { path?: string }): Promise<APIResponse> {
    // Accept either a bare path or a { path } object (the generic UnifiedToolsPage
    // renderer passes a single object built from the tool's inputSchema).
    const path = (arg !== null && typeof arg === 'object') ? arg.path : arg;
    const response = await this.get(LARAVEL_API_ROUTE.serverFiles.browse, { path });
    const data = response.data as any;
    if (response.success && data && Array.isArray(data.items)) {
      data.items = data.items.map((item: any) => ({
        ...item,
        type: item.type ?? (item.is_directory ? 'directory' : 'file')
      }));
    }
    return response;
  }

  // Backend reads `file_path` for download/info/preview (only /files/browse reads `path`).
  async downloadFile(path: string): Promise<APIResponse> {
    return this.get(LARAVEL_API_ROUTE.serverFiles.download, { file_path: path });
  }

  async getFileInfo(path: string): Promise<APIResponse> {
    return this.get(LARAVEL_API_ROUTE.serverFiles.info, { file_path: path });
  }

  async previewFile(path: string, options?: { forEdit?: boolean; maxLines?: number }): Promise<APIResponse> {
    return this.get(LARAVEL_API_ROUTE.serverFiles.preview, {
      file_path: path,
      for_edit: options?.forEdit ? 1 : undefined,
      max_lines: options?.maxLines,
    });
  }

  async writeFile(
    path: string,
    content: string,
    elevatedToken?: string | null,
    encoding?: string
  ): Promise<APIResponse> {
    return this.request({
      url: LARAVEL_API_ROUTE.serverFiles.write,
      method: 'POST',
      data: { file_path: path, content, encoding: encoding || undefined },
      headers: elevatedToken ? { 'X-Elevated-Token': elevatedToken } : undefined,
    });
  }

  async elevatedAuth(password: string): Promise<APIResponse> {
    return this.post(LARAVEL_API_ROUTE.serverFiles.elevatedAuth, { password });
  }

  async revokeElevatedAuth(token?: string | null): Promise<APIResponse> {
    return this.request({
      url: LARAVEL_API_ROUTE.serverFiles.elevatedAuth,
      method: 'DELETE',
      headers: token ? { 'X-Elevated-Token': token } : undefined,
    });
  }

  async downloadFileBlob(path: string): Promise<Blob> {
    const url = this.addQueryParams(this.buildURL(LARAVEL_API_ROUTE.serverFiles.download), { file_path: path });
    const response = await this.rawRequest(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const payload = await response.json();
        throw new Error(payload.message || payload.error || 'Download failed');
      }
      throw new Error(`Download failed (${response.status})`);
    }

    return response.blob();
  }

  // ========== Code Executor ==========
  async listScripts(): Promise<APIResponse> {
    return this.get('/executor/scripts');
  }

  async executeScript(data: { script?: string; script_id?: number; args?: any }): Promise<APIResponse> {
    return this.post('/executor/run', data);
  }

  async getExecutorLogs(): Promise<APIResponse> {
    return this.get('/executor/logs');
  }

  async getExecutorStatus(): Promise<APIResponse> {
    return this.get('/executor/status');
  }

  // ========== Nginx Management ==========
  async listNginxSites(): Promise<APIResponse> {
    const response = await this.get('/nginx/sites');
    const data = response.data as Record<string, unknown> | undefined;
    if (response.success && data) {
      const sites = data.sites ?? data;
      if (Array.isArray(sites)) {
        data.sites = sites.map((site) => normalizeNginxSite(site as Record<string, unknown>));
      }
    }
    return response;
  }

  async createNginxSite(data: any): Promise<APIResponse> {
    return this.post('/nginx/sites', data);
  }

  async getNginxSiteConfig(siteName: string): Promise<APIResponse> {
    return this.get('/nginx/config', { site_name: siteName });
  }

  async updateNginxSite(siteName: string, data: any): Promise<APIResponse> {
    return this.put(`/nginx/sites/${siteName}`, data);
  }

  async deleteNginxSite(siteName: string): Promise<APIResponse> {
    return this.delete(`/nginx/sites/${siteName}`);
  }

  /**
   * Purge a site's actual web-root FILES (deleteNginxSite only removes the
   * nginx config). Destructive: requires the root password AND typing "delete"
   * to confirm. core_node is never deletable (server-enforced).
   */
  async deleteNginxSiteFiles(
    siteName: string,
    payload: { password: string; confirm: string },
  ): Promise<APIResponse> {
    return this.post(`/nginx/sites/${siteName}/delete-files`, payload);
  }

  async enableNginxSite(siteName: string): Promise<APIResponse> {
    return this.post('/nginx/enable', { site_name: siteName });
  }

  async disableNginxSite(siteName: string): Promise<APIResponse> {
    return this.post('/nginx/disable', { site_name: siteName });
  }

  async testNginxConfig(): Promise<APIResponse> {
    return this.post('/nginx/test');
  }

  async reloadNginx(): Promise<APIResponse> {
    return this.post('/nginx/reload');
  }

  /**
   * Idempotently repair + reset all nginx config: ensure runtime dirs (log/run),
   * quarantine broken site configs until `nginx -t` passes, then reload. Use
   * after add/delete or when the config test / restart fails (e.g. missing
   * /var/log/nginx/error.log).
   */
  async repairNginxConfig(): Promise<APIResponse> {
    return this.post('/nginx/repair');
  }

  async getNginxStatus(): Promise<APIResponse> {
    return this.get('/nginx/status');
  }

  async nginxService(action: 'start' | 'stop' | 'restart' | 'reload'): Promise<APIResponse> {
    return this.post('/nginx/service', { action });
  }

  async getNginxLogs(type: 'access' | 'error' = 'error', lines: number = 200, filter?: string): Promise<APIResponse> {
    // addQueryParams drops undefined/null params, so filter is only sent when set
    return this.get('/nginx/logs', { type, lines, filter: filter || undefined });
  }

  /**
   * Install nginx via the system package manager. Long-running (can take up
   * to ~15 minutes on a cold apt/yum cache), so it bypasses the module-level
   * 15s timeout with an explicit per-request timeout and disables retry —
   * a timed-out install must never be re-fired automatically.
   */
  async installNginx(): Promise<APIResponse> {
    return this.request({
      url: '/nginx/install',
      method: 'POST',
      timeout: 15 * 60 * 1000,
      retry: false
    });
  }

  async getNginxBackups(site?: string): Promise<APIResponse> {
    return this.get('/nginx/backups', { site: site || undefined });
  }

  async restoreNginxBackup(file: string): Promise<APIResponse> {
    return this.post('/nginx/backups/restore', { file });
  }

  async getNginxMainConfig(): Promise<APIResponse> {
    return this.get('/nginx/main-config');
  }

  async checkNginxPort(port: number): Promise<APIResponse> {
    return this.get('/nginx/port-check', { port });
  }

  async getNginxMetrics(): Promise<APIResponse> {
    return this.get('/nginx/metrics');
  }

  async batchNginxSites(action: 'enable' | 'disable' | 'test', sites: string[]): Promise<APIResponse> {
    return this.post('/nginx/sites/batch', { action, sites });
  }

  // ========== FrankenPHP Management ==========
  async getFrankenPhpStatus(): Promise<APIResponse> {
    return this.get('/frankenphp/status');
  }

  async listFrankenPhpSites(): Promise<APIResponse> {
    return this.get('/frankenphp/sites');
  }

  async getFrankenPhpSite(siteName: string): Promise<APIResponse> {
    return this.get(`/frankenphp/sites/${encodeURIComponent(siteName)}`);
  }

  async createFrankenPhpSite(data: FrankenPhpSiteRequest): Promise<APIResponse> {
    return this.request({
      url: '/frankenphp/sites',
      method: 'POST',
      data,
      timeout: FRANKENPHP_CONFIG_TIMEOUT_MS,
      retry: false,
    });
  }

  async updateFrankenPhpSite(siteName: string, data: Partial<FrankenPhpSiteRequest>): Promise<APIResponse> {
    return this.request({
      url: `/frankenphp/sites/${encodeURIComponent(siteName)}`,
      method: 'PUT',
      data,
      timeout: FRANKENPHP_CONFIG_TIMEOUT_MS,
      retry: false,
    });
  }

  async deleteFrankenPhpSite(siteName: string): Promise<APIResponse> {
    return this.request({
      url: `/frankenphp/sites/${encodeURIComponent(siteName)}`,
      method: 'DELETE',
      timeout: FRANKENPHP_CONFIG_TIMEOUT_MS,
      retry: false,
    });
  }

  async enableFrankenPhpSite(siteName: string): Promise<APIResponse> {
    return this.request({
      url: `/frankenphp/sites/${encodeURIComponent(siteName)}/enable`,
      method: 'POST',
      timeout: FRANKENPHP_CONFIG_TIMEOUT_MS,
      retry: false,
    });
  }

  async disableFrankenPhpSite(siteName: string): Promise<APIResponse> {
    return this.request({
      url: `/frankenphp/sites/${encodeURIComponent(siteName)}/disable`,
      method: 'POST',
      timeout: FRANKENPHP_CONFIG_TIMEOUT_MS,
      retry: false,
    });
  }

  async testFrankenPhpConfig(): Promise<APIResponse> {
    return this.post('/frankenphp/test');
  }

  async reloadFrankenPhp(): Promise<APIResponse> {
    return this.request({
      url: '/frankenphp/reload',
      method: 'POST',
      timeout: FRANKENPHP_CONFIG_TIMEOUT_MS,
      retry: false,
    });
  }

  async getFrankenPhpReloadJob(jobId: string): Promise<APIResponse> {
    return this.get(`/frankenphp/reloads/${encodeURIComponent(jobId)}`);
  }

  async waitForFrankenPhpReload(response: APIResponse): Promise<void> {
    const data = response.data as Record<string, any> | undefined;
    const jobId = data?.reload_job_id || data?.job_id;

    if (!jobId) return;
    for (let attempt = 0; attempt < FRANKENPHP_RELOAD_POLL_LIMIT; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, FRANKENPHP_RELOAD_POLL_INTERVAL_MS));
      let jobResponse: APIResponse;

      try {
        jobResponse = await this.getFrankenPhpReloadJob(String(jobId));
      } catch {
        continue;
      }
      const jobData = jobResponse.data as Record<string, any> | undefined;

      if (!jobResponse.success) {
        continue;
      }
      if (jobData?.status === 'completed') return;
      if (jobData?.status === 'failed') {
        throw new Error(jobData.error || 'FrankenPHP reload failed.');
      }
    }
    throw new Error('FrankenPHP reload timed out.');
  }

  async frankenPhpService(action: 'start' | 'stop' | 'restart' | 'reload'): Promise<APIResponse> {
    return this.post('/frankenphp/service', { action });
  }

  // ========== Unified Manager ==========
  async listApps(): Promise<APIResponse> {
    const response = await this.get('/unified/apps');
    const data = response.data as any;
    if (response.success && data) {
      const apps = data.apps || data;
      if (Array.isArray(apps)) {
        data.apps = apps.map((app: any) => ({
          ...app,
          app_name: app.app_name ?? app.name,
          app_path: app.app_path ?? app.path,
          type: app.type ?? app.app_type,
        }));
      }
    }
    return response;
  }

  async deployApp(data: any): Promise<APIResponse> {
    return this.post('/unified/deploy', data);
  }

  async getAppStatus(appName: string, appType: string): Promise<APIResponse> {
    return this.get('/unified/status', { app_name: appName, app_type: appType });
  }

  async getAppLogs(appName: string): Promise<APIResponse> {
    return this.get('/unified/logs', { app_name: appName });
  }

  // ========== SSL Certificates ==========
  async listCertificates(): Promise<APIResponse> {
    return this.get('/certificates/');
  }

  async generateCertificate(data: { domain: string; provider?: string; staging?: boolean }): Promise<APIResponse> {
    return this.post('/certificates/generate', data);
  }

  async renewCertificates(data?: { domain?: string; all?: boolean }): Promise<APIResponse> {
    return this.post('/certificates/renew', data || { all: true });
  }

  /**
   * Idempotent: generate a new cert (--keep-until-expiring) when none exists, or
   * renew when one does (5-min cooldown per domain). Runs certbot in the
   * background; returns a request_id to poll via certificateProgress().
   */
  async ensureCertificate(data: { domain: string; provider?: string; staging?: boolean }): Promise<APIResponse> {
    return this.request({
      url: '/certificates/ensure',
      method: 'POST',
      data,
      timeout: 15 * 60 * 1000,
      retry: false,
    });
  }

  /**
   * Poll the real-time output of a backgrounded certbot ensure/generate/renew
   * operation. Returns { status: 'running'|'completed', command, output_lines[] }.
   */
  async certificateProgress(requestId: string): Promise<APIResponse> {
    return this.get(`/certificates/progress/${requestId}`);
  }

  async getCertificateStatus(domain: string): Promise<APIResponse> {
    return this.get('/certificates/status', { domain });
  }

  async installCertbot(): Promise<APIResponse> {
    return this.post('/certificates/install-certbot');
  }

  async detectCertbot(): Promise<APIResponse> {
    return this.get('/certificates/detect-certbot');
  }

  /** DNS provider configuration status (secrets are never returned). */
  async dnsProviderStatus(): Promise<APIResponse> {
    return this.get('/certificates/dns-provider');
  }

}
