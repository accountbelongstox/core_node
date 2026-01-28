import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

/**
 * BankV1 API Module
 * Banking Management System API
 */
export class BankV1API extends BaseAPI {
  // ========== Admin - User Management ==========
  async getAllUsers(params?: { page?: number; per_page?: number; search?: string }): Promise<APIResponse> {
    return this.get('/admin/users', params);
  }

  async getUserById(userId: string): Promise<APIResponse> {
    return this.get(`/admin/users/${userId}`);
  }

  async lockUser(userId: string): Promise<APIResponse> {
    return this.put(`/admin/users/${userId}/lock`);
  }

  async unlockUser(userId: string): Promise<APIResponse> {
    return this.put(`/admin/users/${userId}/unlock`);
  }

  async deleteUser(userId: string): Promise<APIResponse> {
    return this.delete(`/admin/users/${userId}`);
  }

  // ========== Admin - Device Management ==========
  async getAllDevices(params?: { page?: number; per_page?: number; search?: string }): Promise<APIResponse> {
    return this.get('/admin/devices', params);
  }

  async getDeviceById(deviceId: string): Promise<APIResponse> {
    return this.get(`/admin/devices/${deviceId}`);
  }

  async lockDevice(deviceId: string): Promise<APIResponse> {
    return this.put(`/admin/devices/${deviceId}/lock`);
  }

  async unlockDevice(deviceId: string): Promise<APIResponse> {
    return this.put(`/admin/devices/${deviceId}/unlock`);
  }

  async deleteDevice(deviceId: string): Promise<APIResponse> {
    return this.delete(`/admin/devices/${deviceId}`);
  }

  // ========== Admin - Data Submission Management ==========
  async getDataStats(): Promise<APIResponse> {
    return this.get('/admin/data/stats');
  }

  async getDataSubmissions(params?: { page?: number; per_page?: number; device_id?: string; start_date?: string; end_date?: string }): Promise<APIResponse> {
    return this.get('/admin/data/submissions', params);
  }

  // ========== Admin - Log Management ==========
  async getAppLogs(params?: { page?: number; per_page?: number; start_date?: string; end_date?: string }): Promise<APIResponse> {
    return this.get('/admin/logs/app', params);
  }

  async getSecurityLogs(params?: { page?: number; per_page?: number; start_date?: string; end_date?: string }): Promise<APIResponse> {
    return this.get('/admin/logs/security', params);
  }

  async cleanupLogs(params?: { days?: number }): Promise<APIResponse> {
    return this.post('/admin/logs/cleanup', params);
  }

  // ========== Admin - Registration Code Management ==========
  async getAllCodes(params?: { page?: number; per_page?: number }): Promise<APIResponse> {
    return this.get('/admin/codes', params);
  }

  async createCode(data: { code: string; expires_at?: string; max_uses?: number }): Promise<APIResponse> {
    return this.post('/admin/codes', data);
  }

  async updateCode(codeId: string, data: { expires_at?: string; max_uses?: number; enabled?: boolean }): Promise<APIResponse> {
    return this.put(`/admin/codes/${codeId}`, data);
  }

  async deleteCode(codeId: string): Promise<APIResponse> {
    return this.delete(`/admin/codes/${codeId}`);
  }

  async getCodeUsage(codeId: string): Promise<APIResponse> {
    return this.get(`/admin/codes/${codeId}/usage`);
  }

  // ========== Admin - System Monitoring ==========
  async getSystemStatus(): Promise<APIResponse> {
    return this.get('/admin/system/status');
  }

  async getSystemStats(): Promise<APIResponse> {
    return this.get('/admin/system/stats');
  }

  async toggleMaintenance(data: { enabled: boolean; message?: string }): Promise<APIResponse> {
    return this.post('/admin/system/maintenance', data);
  }

  // ========== Database Information ==========
  // Note: These routes need to be implemented in backend
  // Backend has BankV1Initializer with getDatabaseInfo() and checkInitializationStatus() methods
  // but they are not exposed as API routes yet
  // async getDatabaseInfo(): Promise<APIResponse> {
  //   return this.get('/admin/system/database-info');
  // }

  // async getInitializationStatus(): Promise<APIResponse> {
  //   return this.get('/admin/system/init-status');
  // }
}

