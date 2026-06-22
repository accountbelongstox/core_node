import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

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
    return this.get('/system/storage');
  }

  // Alias methods for UI compatibility
  async getSystemProcesses(): Promise<APIResponse> {
    return this.getProcesses();
  }

  async getSystemStorage(): Promise<APIResponse> {
    return this.getStorage();
  }

  async getSystemServices(): Promise<APIResponse> {
    return this.getServices();
  }

  // ========== File Management ==========
  async browseFiles(path?: string): Promise<APIResponse> {
    return this.get('/files/browse', { path });
  }

  // Backend reads `file_path` for download/info/preview (only /files/browse reads `path`).
  async downloadFile(path: string): Promise<APIResponse> {
    return this.get('/files/download', { file_path: path });
  }

  async getFileInfo(path: string): Promise<APIResponse> {
    return this.get('/files/info', { file_path: path });
  }

  async previewFile(path: string): Promise<APIResponse> {
    return this.get('/files/preview', { file_path: path });
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
    return this.get('/nginx/sites');
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

  // Alias method for UI compatibility
  async getNginxSites(): Promise<APIResponse> {
    return this.listNginxSites();
  }

  // ========== Unified Manager ==========
  async listApps(): Promise<APIResponse> {
    return this.get('/unified/apps');
  }

  async deployApp(data: any): Promise<APIResponse> {
    return this.post('/unified/deploy', data);
  }

  async getAppStatus(appName: string): Promise<APIResponse> {
    return this.get('/unified/status', { app_name: appName });
  }

  async getAppLogs(appName: string): Promise<APIResponse> {
    return this.get('/unified/logs', { app_name: appName });
  }

  // Alias methods for UI compatibility
  async getUnifiedApps(): Promise<APIResponse> {
    return this.listApps();
  }

  async deployUnifiedApp(data: any): Promise<APIResponse> {
    return this.deployApp(data);
  }

  async getUnifiedAppStatus(appName: string): Promise<APIResponse> {
    return this.getAppStatus(appName);
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

  async getCertificateStatus(domain: string): Promise<APIResponse> {
    return this.get('/certificates/status', { domain });
  }

  async installCertbot(): Promise<APIResponse> {
    return this.post('/certificates/install-certbot');
  }

  async detectCertbot(): Promise<APIResponse> {
    return this.get('/certificates/detect-certbot');
  }

  // Alias methods for UI compatibility
  async getSSLCertificates(): Promise<APIResponse> {
    return this.listCertificates();
  }

  async generateSSLCertificate(data: { domain: string; email?: string; provider?: 'dnspod' | 'cloudflare'; staging?: boolean }): Promise<APIResponse> {
    return this.generateCertificate({ domain: data.domain, provider: data.provider, staging: data.staging });
  }

  async renewSSLCertificates(): Promise<APIResponse> {
    return this.renewCertificates();
  }
}
