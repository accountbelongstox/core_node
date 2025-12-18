import { api } from '../api';
import { StorageManager, StorageKeys } from '../storage';
import {
  NginxSite,
  SSLCertificate,
  CertbotStatus,
  ServerFileNode,
  PredefinedScript,
  ScriptExecution,
  UnifiedApp,
  UnifiedAppStatus,
  NginxSiteCreateRequest,
  NginxSiteConfig,
  SystemInfo,
  SystemProcess,
  SystemStorage,
  SystemServiceStatus
} from '../../types';

/**
 * ServerManagerV1Model
 * Centralized model for ServerManagerV1 with storage persistence
 * Handles nginx, ssl, files, scripts, and unified app management
 */
export class ServerManagerV1Model {
  // Cached data
  private nginxSites: NginxSite[] = [];
  private sslCertificates: SSLCertificate[] = [];
  private certbotStatus: CertbotStatus | null = null;
  private unifiedApps: UnifiedApp[] = [];
  private scripts: PredefinedScript[] = [];
  private currentFilePath: string = '/www/programing/core_node';
  private allowedFilePaths: string[] = [];

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load cached data from storage
   */
  private loadFromStorage(): void {
    this.nginxSites = StorageManager.get(StorageKeys.SERVER_MANAGER_NGINX_SITES, []);
    this.sslCertificates = StorageManager.get(StorageKeys.SERVER_MANAGER_SSL_CERTS, []);
    this.certbotStatus = StorageManager.get(StorageKeys.SERVER_MANAGER_CERTBOT_STATUS, null);
    this.unifiedApps = StorageManager.get(StorageKeys.SERVER_MANAGER_UNIFIED_APPS, []);
    this.scripts = StorageManager.get(StorageKeys.SERVER_MANAGER_SCRIPTS, []);
    this.currentFilePath = StorageManager.get(StorageKeys.SERVER_MANAGER_FILE_CURRENT_PATH, '/www/programing/core_node');
    this.allowedFilePaths = StorageManager.get(StorageKeys.SERVER_MANAGER_FILE_ALLOWED_PATHS, []);
  }

  /**
   * Save data to storage
   */
  private saveToStorage(): void {
    StorageManager.set(StorageKeys.SERVER_MANAGER_NGINX_SITES, this.nginxSites);
    StorageManager.set(StorageKeys.SERVER_MANAGER_SSL_CERTS, this.sslCertificates);
    StorageManager.set(StorageKeys.SERVER_MANAGER_CERTBOT_STATUS, this.certbotStatus);
    StorageManager.set(StorageKeys.SERVER_MANAGER_UNIFIED_APPS, this.unifiedApps);
    StorageManager.set(StorageKeys.SERVER_MANAGER_SCRIPTS, this.scripts);
    StorageManager.set(StorageKeys.SERVER_MANAGER_FILE_CURRENT_PATH, this.currentFilePath);
    StorageManager.set(StorageKeys.SERVER_MANAGER_FILE_ALLOWED_PATHS, this.allowedFilePaths);
  }

  // ========== Nginx Sites ==========

  /**
   * Get cached nginx sites
   */
  getNginxSites(): NginxSite[] {
    return [...this.nginxSites];
  }

  /**
   * Load nginx sites from API
   */
  async loadNginxSites(): Promise<NginxSite[]> {
    const response = await api.serverManagerV1.getNginxSites();

    if (response.success && response.data) {
      const sites = response.data.sites || response.data;
      this.nginxSites = Array.isArray(sites) ? sites : [];
      this.saveToStorage();
    }

    return this.nginxSites;
  }

  /**
   * Get nginx site config
   */
  async getSiteConfig(siteName: string): Promise<NginxSiteConfig | null> {
    const response = await api.serverManagerV1.getNginxSiteConfig(siteName);

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  /**
   * Create nginx site
   */
  async createSite(data: NginxSiteCreateRequest): Promise<boolean> {
    const response = await api.serverManagerV1.createNginxSite(data);

    if (response.success) {
      await this.loadNginxSites();
      return true;
    }

    return false;
  }

  /**
   * Update nginx site
   */
  async updateSite(siteName: string, config: string): Promise<boolean> {
    const response = await api.serverManagerV1.updateNginxSite(siteName, { site_config: config });

    if (response.success) {
      await this.loadNginxSites();
      return true;
    }

    return false;
  }

  /**
   * Delete nginx site
   */
  async deleteSite(siteName: string): Promise<boolean> {
    const response = await api.serverManagerV1.deleteNginxSite(siteName);

    if (response.success) {
      await this.loadNginxSites();
      return true;
    }

    return false;
  }

  /**
   * Enable nginx site
   */
  async enableSite(siteName: string): Promise<boolean> {
    const response = await api.serverManagerV1.enableNginxSite(siteName);

    if (response.success) {
      await this.loadNginxSites();
      return true;
    }

    return false;
  }

  /**
   * Disable nginx site
   */
  async disableSite(siteName: string): Promise<boolean> {
    const response = await api.serverManagerV1.disableNginxSite(siteName);

    if (response.success) {
      await this.loadNginxSites();
      return true;
    }

    return false;
  }

  /**
   * Test nginx config
   */
  async testNginxConfig(): Promise<{ valid: boolean; output: string; error: string }> {
    const response = await api.serverManagerV1.testNginxConfig();

    if (response.success && response.data) {
      return {
        valid: response.data.valid || false,
        output: response.data.output || '',
        error: response.data.error || ''
      };
    }

    return { valid: false, output: '', error: 'Failed to test config' };
  }

  /**
   * Reload nginx
   */
  async reloadNginx(): Promise<boolean> {
    const response = await api.serverManagerV1.reloadNginx();
    return response.success;
  }

  // ========== SSL Certificates ==========

  /**
   * Get cached SSL certificates
   */
  getSSLCertificates(): SSLCertificate[] {
    return [...this.sslCertificates];
  }

  /**
   * Load SSL certificates from API
   */
  async loadSSLCertificates(): Promise<SSLCertificate[]> {
    const response = await api.serverManagerV1.getSSLCertificates();

    if (response.success && response.data) {
      const certificates = response.data.certificates || response.data;
      this.sslCertificates = Array.isArray(certificates) ? certificates : [];
      this.saveToStorage();
    }

    return this.sslCertificates;
  }

  /**
   * Get certbot status
   */
  async loadCertbotStatus(): Promise<CertbotStatus | null> {
    const response = await api.serverManagerV1.detectCertbot();

    if (response.success && response.data) {
      this.certbotStatus = response.data;
      this.saveToStorage();
    }

    return this.certbotStatus;
  }

  /**
   * Get cached certbot status
   */
  getCertbotStatus(): CertbotStatus | null {
    return this.certbotStatus;
  }

  /**
   * Generate SSL certificate
   */
  async generateCertificate(domain: string, provider?: string, staging?: boolean): Promise<boolean> {
    const response = await api.serverManagerV1.generateSSLCertificate({
      domain,
      provider,
      staging
    });

    if (response.success) {
      await this.loadSSLCertificates();
      return true;
    }

    return false;
  }

  /**
   * Renew all SSL certificates
   */
  async renewCertificates(): Promise<boolean> {
    const response = await api.serverManagerV1.renewSSLCertificates();

    if (response.success) {
      await this.loadSSLCertificates();
      return true;
    }

    return false;
  }

  /**
   * Install certbot
   */
  async installCertbot(): Promise<boolean> {
    const response = await api.serverManagerV1.installCertbot();

    if (response.success) {
      await this.loadCertbotStatus();
      return true;
    }

    return false;
  }

  // ========== File Manager ==========

  /**
   * Get current file path
   */
  getCurrentFilePath(): string {
    return this.currentFilePath;
  }

  /**
   * Set current file path
   */
  setCurrentFilePath(path: string): void {
    this.currentFilePath = path;
    StorageManager.set(StorageKeys.SERVER_MANAGER_FILE_CURRENT_PATH, path);
  }

  /**
   * Get allowed file paths
   */
  getAllowedFilePaths(): string[] {
    return [...this.allowedFilePaths];
  }

  /**
   * Browse files
   */
  async browseFiles(path?: string): Promise<{ files: ServerFileNode[]; path: string; allowed_paths: string[] }> {
    const response = await api.serverManagerV1.browseFiles(path);

    if (response.success && response.data) {
      const items = response.data.items || response.data;
      const responsePath = response.data.path || path || this.currentFilePath;
      const paths = response.data.allowed_paths || [];

      this.currentFilePath = responsePath;
      this.allowedFilePaths = paths;
      this.saveToStorage();

      return {
        files: Array.isArray(items) ? items : [],
        path: responsePath,
        allowed_paths: paths
      };
    }

    return {
      files: [],
      path: this.currentFilePath,
      allowed_paths: this.allowedFilePaths
    };
  }

  /**
   * Get file info
   */
  async getFileInfo(path: string): Promise<any> {
    const response = await api.serverManagerV1.getFileInfo(path);

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  /**
   * Preview file
   */
  async previewFile(path: string): Promise<{ content: string; lines: string[] } | null> {
    const response = await api.serverManagerV1.previewFile(path);

    if (response.success && response.data) {
      return {
        content: response.data.content || '',
        lines: response.data.lines || []
      };
    }

    return null;
  }

  // ========== Executor Scripts ==========

  /**
   * Get cached scripts
   */
  getScripts(): PredefinedScript[] {
    return [...this.scripts];
  }

  /**
   * Load scripts from API
   */
  async loadScripts(): Promise<PredefinedScript[]> {
    const response = await api.serverManagerV1.listScripts();

    if (response.success && response.data) {
      const scripts = response.data.scripts || response.data;
      this.scripts = Array.isArray(scripts) ? scripts : [];
      this.saveToStorage();
    }

    return this.scripts;
  }

  /**
   * Execute script
   */
  async executeScript(script: string, args?: any): Promise<ScriptExecution | null> {
    const response = await api.serverManagerV1.executeScript({ script, args });

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  /**
   * Get executor status
   */
  async getExecutorStatus(): Promise<any> {
    const response = await api.serverManagerV1.getExecutorStatus();

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  /**
   * Get executor logs
   */
  async getExecutorLogs(): Promise<any> {
    const response = await api.serverManagerV1.getExecutorLogs();

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  // ========== Unified Manager ==========

  /**
   * Get cached unified apps
   */
  getUnifiedApps(): UnifiedApp[] {
    return [...this.unifiedApps];
  }

  /**
   * Load unified apps from API
   */
  async loadUnifiedApps(): Promise<UnifiedApp[]> {
    const response = await api.serverManagerV1.getUnifiedApps();

    if (response.success && response.data) {
      const apps = response.data.apps || response.data;
      this.unifiedApps = Array.isArray(apps) ? apps : [];
      this.saveToStorage();
    }

    return this.unifiedApps;
  }

  /**
   * Deploy unified app
   */
  async deployUnifiedApp(appName: string, action: string): Promise<any> {
    const response = await api.serverManagerV1.deployUnifiedApp({
      app_name: appName,
      action
    });

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  /**
   * Get unified app status
   */
  async getUnifiedAppStatus(appName: string): Promise<UnifiedAppStatus | null> {
    const response = await api.serverManagerV1.getUnifiedAppStatus(appName);

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  // ========== System Info ==========

  /**
   * Get system info
   */
  async getSystemInfo(): Promise<SystemInfo | null> {
    const response = await api.serverManagerV1.getSystemInfo();

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  /**
   * Get system processes
   */
  async getSystemProcesses(): Promise<SystemProcess[]> {
    const response = await api.serverManagerV1.getSystemProcesses();

    if (response.success && response.data) {
      const processes = response.data.processes || response.data;
      return Array.isArray(processes) ? processes : [];
    }

    return [];
  }

  /**
   * Get system storage
   */
  async getSystemStorage(): Promise<SystemStorage | null> {
    const response = await api.serverManagerV1.getSystemStorage();

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  /**
   * Get system services
   */
  async getSystemServices(): Promise<SystemServiceStatus[]> {
    const response = await api.serverManagerV1.getSystemServices();

    if (response.success && response.data) {
      const services = response.data.services || response.data;
      return Array.isArray(services) ? services : [];
    }

    return [];
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.nginxSites = [];
    this.sslCertificates = [];
    this.certbotStatus = null;
    this.unifiedApps = [];
    this.scripts = [];
    this.saveToStorage();
  }
}

export const serverManagerV1Model = new ServerManagerV1Model();
