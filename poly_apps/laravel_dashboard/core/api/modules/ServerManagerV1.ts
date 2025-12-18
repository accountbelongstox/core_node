import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

/**
 * ServerManagerV1 API Module
 * 服务器管理系统API
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

  async downloadFile(path: string): Promise<APIResponse> {
    return this.get('/files/download', { path });
  }

  async getFileInfo(path: string): Promise<APIResponse> {
    return this.get('/files/info', { path });
  }

  async previewFile(path: string): Promise<APIResponse> {
    return this.get('/files/preview', { path });
  }

  // ========== Code Executor ==========
  async listScripts(): Promise<APIResponse> {
    return this.get('/executor/scripts');
  }

  async executeScript(data: { script: string; args?: any }): Promise<APIResponse> {
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

  async generateSSLCertificate(data: { domain: string; email: string }): Promise<APIResponse> {
    return this.generateCertificate(data);
  }

  async renewSSLCertificates(): Promise<APIResponse> {
    return this.renewCertificates();
  }
}
