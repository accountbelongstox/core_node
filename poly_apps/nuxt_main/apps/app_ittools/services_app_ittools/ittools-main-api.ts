// IT Tools Main API Service
// Handles all API calls to IT Tools backend

import { $fetch } from 'ofetch';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

export interface ToolResult {
  input: Record<string, any>;
  output: any;
  timestamp: string;
  executionTime: number;
}

export class ItToolsMainAPI {
  private baseUrl: string;
  private namespace: string;
  private timeout: number;

  constructor(baseUrl: string = '/api/ittools', namespace: string = 'ittools', timeout: number = 30000) {
    this.baseUrl = baseUrl;
    this.namespace = namespace;
    this.timeout = timeout;
  }

  /**
   * Set API base URL
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Get API base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Crypto Tools - Hash Text
   */
  async hashText(text: string, algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512'): Promise<ApiResponse<{ hash: string }>> {
    return this.post('/crypto/hash', {
      text,
      algorithm
    });
  }

  /**
   * Crypto Tools - UUID Generate
   */
  async generateUUID(count: number = 1, uppercase: boolean = false): Promise<ApiResponse<{ uuids: string[] }>> {
    return this.post('/crypto/uuid/generate', {
      count,
      uppercase
    });
  }

  /**
   * Crypto Tools - Token Generate
   */
  async generateToken(length: number = 32, charset: string = 'alphanumeric'): Promise<ApiResponse<{ token: string }>> {
    return this.post('/crypto/token/generate', {
      length,
      charset
    });
  }

  /**
   * Converter - Base64 Encode
   */
  async base64Encode(text: string): Promise<ApiResponse<{ encoded: string }>> {
    return this.post('/converter/base64/encode', { text });
  }

  /**
   * Converter - Base64 Decode
   */
  async base64Decode(text: string): Promise<ApiResponse<{ decoded: string }>> {
    return this.post('/converter/base64/decode', { text });
  }

  /**
   * Converter - URL Encode
   */
  async urlEncode(text: string): Promise<ApiResponse<{ encoded: string }>> {
    return this.post('/converter/url/encode', { text });
  }

  /**
   * Converter - URL Decode
   */
  async urlDecode(text: string): Promise<ApiResponse<{ decoded: string }>> {
    return this.post('/converter/url/decode', { text });
  }

  /**
   * Web Dev - JSON Prettify
   */
  async jsonPrettify(json: string, indent: number = 2): Promise<ApiResponse<{ formatted: string }>> {
    return this.post('/web/json/prettify', { json, indent });
  }

  /**
   * Web Dev - JSON Minify
   */
  async jsonMinify(json: string): Promise<ApiResponse<{ minified: string }>> {
    return this.post('/web/json/minify', { json });
  }

  /**
   * Text - Statistics
   */
  async textStatistics(text: string): Promise<ApiResponse<any>> {
    return this.post('/text/statistics', { text });
  }

  /**
   * Text - Regex Test
   */
  async regexTest(pattern: string, text: string, flags?: string): Promise<ApiResponse<any>> {
    return this.post('/text/regex/test', { pattern, text, flags });
  }

  /**
   * Math - Evaluate Expression
   */
  async evaluateExpression(expression: string): Promise<ApiResponse<{ result: number }>> {
    return this.post('/math/evaluate', { expression });
  }

  /**
   * Network - IPv4 Convert
   */
  async ipv4Convert(ip: string, format: string): Promise<ApiResponse<any>> {
    return this.post('/network/ipv4/convert', { ip, format });
  }

  /**
   * Get all available tools
   */
  async getAllTools(): Promise<ApiResponse<any>> {
    return this.get('/tools');
  }

  /**
   * Get tools by category
   */
  async getToolsByCategory(category: string): Promise<ApiResponse<any>> {
    return this.get(`/tools/category/${category}`);
  }

  /**
   * Search tools
   */
  async searchTools(query: string): Promise<ApiResponse<any>> {
    return this.get('/tools/search', { q: query });
  }

  /**
   * Execute custom tool endpoint
   */
  async executeTool(endpoint: string, method: string = 'POST', params: Record<string, any> = {}): Promise<ApiResponse<any>> {
    if (method.toUpperCase() === 'GET') {
      return this.get(endpoint, params);
    } else if (method.toUpperCase() === 'POST') {
      return this.post(endpoint, params);
    } else if (method.toUpperCase() === 'PUT') {
      return this.put(endpoint, params);
    } else if (method.toUpperCase() === 'DELETE') {
      return this.delete(endpoint, params);
    }
    throw new Error(`Unsupported HTTP method: ${method}`);
  }

  /**
   * GET request
   */
  private async get(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<any>> {
    try {
      const url = this.buildUrl(endpoint, params);
      const response = await $fetch(url, {
        timeout: this.timeout,
        headers: {
          'X-App-Namespace': this.namespace,
          'Content-Type': 'application/json'
        }
      });
      return response;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * POST request
   */
  private async post(endpoint: string, data: Record<string, any>): Promise<ApiResponse<any>> {
    try {
      const response = await $fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        body: data,
        timeout: this.timeout,
        headers: {
          'X-App-Namespace': this.namespace,
          'Content-Type': 'application/json'
        }
      });
      return response;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * PUT request
   */
  private async put(endpoint: string, data: Record<string, any>): Promise<ApiResponse<any>> {
    try {
      const response = await $fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        body: data,
        timeout: this.timeout,
        headers: {
          'X-App-Namespace': this.namespace,
          'Content-Type': 'application/json'
        }
      });
      return response;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * DELETE request
   */
  private async delete(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<any>> {
    try {
      const url = this.buildUrl(endpoint, params);
      const response = await $fetch(url, {
        method: 'DELETE',
        timeout: this.timeout,
        headers: {
          'X-App-Namespace': this.namespace,
          'Content-Type': 'application/json'
        }
      });
      return response;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    let url = `${this.baseUrl}${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      url += `?${queryString}`;
    }
    return url;
  }

  /**
   * Handle API errors
   */
  private handleError(error: any): ApiResponse<null> {
    console.error('IT Tools API Error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      code: error.status || 'ERROR',
      data: null
    };
  }
}

// Create singleton instance
export const itToolsAPI = new ItToolsMainAPI();

export default ItToolsMainAPI;
