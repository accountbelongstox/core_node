import { apiClient } from './client';
import { Account, CreateAccountRequest } from '../../types/models';
import { QueryParams } from '../../types/api';

/**
 * Base account service class
 * All account type services are based on this class
 */
export class BaseAccountService<T extends Account = Account> {
  protected endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async getAll(params?: QueryParams): Promise<T[]> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query.append(key, String(value));
        }
      });
    }
    const path = `${this.endpoint}${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient.get<T[]>(path);
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.message || `Failed to fetch ${this.endpoint}`);
  }

  async getById(id: string): Promise<T> {
    const response = await apiClient.get<T>(`${this.endpoint}/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || `Failed to fetch ${this.endpoint}/${id}`);
  }

  async create(request: CreateAccountRequest | Partial<T>): Promise<T> {
    const response = await apiClient.post<T>(this.endpoint, request);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || `Failed to create ${this.endpoint}`);
  }

  async update(id: string, request: Partial<T>): Promise<T> {
    const response = await apiClient.put<T>(`${this.endpoint}/${id}`, request);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || `Failed to update ${this.endpoint}/${id}`);
  }

  async delete(id: string): Promise<void> {
    const response = await apiClient.delete(`${this.endpoint}/${id}`);
    if (!response.success) {
      throw new Error(response.message || `Failed to delete ${this.endpoint}/${id}`);
    }
  }

  async toggleSchedulable(id: string): Promise<T> {
    const response = await apiClient.put<T>(`${this.endpoint}/${id}/toggle-schedulable`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || `Failed to toggle schedulable for ${this.endpoint}/${id}`);
  }

  async toggle(id: string): Promise<T> {
    const response = await apiClient.put<T>(`${this.endpoint}/${id}/toggle`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || `Failed to toggle ${this.endpoint}/${id}`);
  }

  async resetStatus(id: string): Promise<T> {
    const response = await apiClient.post<T>(`${this.endpoint}/${id}/reset-status`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || `Failed to reset status for ${this.endpoint}/${id}`);
  }
}

// Claude OAuth account service
export const claudeAccountsService = new BaseAccountService('/admin/claude-accounts');

// Claude Console account service
export const claudeConsoleAccountsService = new BaseAccountService('/admin/claude-console-accounts');

// Gemini OAuth account service
export const geminiAccountsService = new BaseAccountService('/admin/gemini-accounts');

// Gemini API account service
export const geminiApiAccountsService = new BaseAccountService('/admin/gemini-api-accounts');

// OpenAI OAuth account service
export const openaiAccountsService = new BaseAccountService('/admin/openai-accounts');

// OpenAI Responses account service
export const openaiResponsesAccountsService = new BaseAccountService('/admin/openai-responses-accounts');

// AWS Bedrock account service
export const bedrockAccountsService = new BaseAccountService('/admin/bedrock-accounts');

// Azure OpenAI account service
export const azureOpenaiAccountsService = new BaseAccountService('/admin/azure-openai-accounts');

// Droid account service
export const droidAccountsService = new BaseAccountService('/admin/droid-accounts');

// CCR account service
export const ccrAccountsService = new BaseAccountService('/admin/ccr-accounts');

// Unified exports
export const accountServices = {
  claude: claudeAccountsService,
  claudeConsole: claudeConsoleAccountsService,
  gemini: geminiAccountsService,
  geminiApi: geminiApiAccountsService,
  openai: openaiAccountsService,
  openaiResponses: openaiResponsesAccountsService,
  bedrock: bedrockAccountsService,
  azureOpenai: azureOpenaiAccountsService,
  droid: droidAccountsService,
  ccr: ccrAccountsService,
};

