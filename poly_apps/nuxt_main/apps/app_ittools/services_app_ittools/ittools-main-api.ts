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
  async generateUUID(count: number = 1, uppercase: boolean = false, version: number = 4): Promise<ApiResponse<{ uuids: string[] }>> {
    return this.post('/crypto/uuid/generate', {
      count,
      uppercase,
      version
    });
  }

  /**
   * Crypto Tools - ULID Generate
   */
  async generateULID(count: number = 1, timestamp: string | null = null): Promise<ApiResponse<{ ulids: string[] }>> {
    return this.post('/crypto/ulid/generate', {
      count,
      timestamp
    });
  }

  /**
   * Crypto Tools - Bcrypt Hash
   */
  async bcryptHash(password: string, rounds: number = 10): Promise<ApiResponse<{ hash: string }>> {
    return this.post('/crypto/bcrypt/hash', {
      password,
      rounds
    });
  }

  /**
   * Crypto Tools - Bcrypt Verify
   */
  async bcryptVerify(password: string, hash: string): Promise<ApiResponse<{ valid: boolean }>> {
    return this.post('/crypto/bcrypt/verify', {
      password,
      hash
    });
  }

  /**
   * Crypto Tools - BIP39 Mnemonic Generator
   */
  async generateBip39(strength: number = 128, language: string = 'english'): Promise<ApiResponse<{ mnemonic: string; entropy: string }>> {
    return this.post('/crypto/bip39/generate', {
      strength,
      language
    });
  }

  /**
   * Crypto Tools - HMAC Generator
   */
  async generateHmac(message: string, secret: string, algorithm: string = 'sha256'): Promise<ApiResponse<{ hmac: string; algorithm: string }>> {
    return this.post('/crypto/hmac', {
      message,
      text: message,
      secret,
      algorithm
    });
  }

  /**
   * Crypto Tools - RSA Key Pair Generator
   */
  async generateRsaKeyPair(keySize: number = 2048, format: 'pem' | 'der' = 'pem'): Promise<ApiResponse<{ publicKey: string; privateKey: string; keySize: number }>> {
    return this.post('/crypto/rsa/generate', {
      keySize,
      format
    });
  }

  /**
   * Crypto Tools - OTP Generate
   */
  async generateOtp(
    secret: string,
    type: 'totp' | 'hotp' = 'totp',
    digits: number = 6,
    period: number = 30,
    counter?: number
  ): Promise<ApiResponse<{ code: string; remainingTime?: number; type: string }>> {
    return this.post('/crypto/otp/generate', {
      secret,
      type,
      digits,
      period,
      counter
    });
  }

  /**
   * Crypto Tools - OTP Verify
   */
  async verifyOtp(secret: string, code: string, type: 'totp' | 'hotp' = 'totp'): Promise<ApiResponse<{ valid: boolean }>> {
    return this.post('/crypto/otp/verify', {
      secret,
      code,
      type
    });
  }

  /**
   * Crypto Tools - Encrypt
   */
  async encryptText(text: string, algorithm: string, key: string, iv?: string): Promise<ApiResponse<{ encrypted: string; algorithm: string }>> {
    return this.post('/crypto/encrypt', {
      text,
      algorithm,
      key,
      iv
    });
  }

  /**
   * Crypto Tools - Decrypt
   */
  async decryptText(encrypted: string, algorithm: string, key: string, iv?: string): Promise<ApiResponse<{ decrypted: string }>> {
    return this.post('/crypto/decrypt', {
      encrypted,
      algorithm,
      key,
      iv
    });
  }

  /**
   * Crypto Tools - Password Strength
   */
  async analyzePassword(password: string): Promise<ApiResponse<{ score: number; strength: string; crackTime: string; suggestions: string[]; warnings: string[]; entropy: number }>> {
    return this.post('/crypto/password/analyze', {
      password
    });
  }

  /**
   * Crypto Tools - Basic Auth
   */
  async generateBasicAuth(username: string, password: string): Promise<ApiResponse<{ header: string; token: string }>> {
    return this.post('/crypto/basic-auth', {
      username,
      password
    });
  }

  /**
   * Crypto Tools - Token Generate
   */
  async generateToken(
    length: number = 32,
    charset: string = 'alphanumeric',
    includeSymbols: boolean = false,
    count: number = 1
  ): Promise<ApiResponse<{ tokens: string[] }>> {
    return this.post('/crypto/token/generate', {
      length,
      charset,
      includeSymbols,
      count
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
  async base64Decode(encoded: string): Promise<ApiResponse<{ decoded: string }>> {
    return this.post('/converter/base64/decode', { encoded });
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
   * Converter - Case
   */
  async convertCase(text: string): Promise<ApiResponse<Record<string, string>>> {
    return this.post('/converter/case', { text });
  }

  /**
   * Converter - Slugify
   */
  async slugify(text: string, separator: string = '-', lowercase: boolean = true): Promise<ApiResponse<{ slug: string }>> {
    return this.post('/converter/slugify', {
      text,
      separator,
      lowercase
    });
  }

  /**
   * Converter - Color
   */
  async convertColor(color: string): Promise<ApiResponse<Record<string, string>>> {
    return this.post('/converter/color', { color });
  }

  /**
   * Converter - Temperature
   */
  async convertTemperature(value: number, from: 'celsius' | 'fahrenheit' | 'kelvin'): Promise<ApiResponse<Record<string, number>>> {
    return this.post('/converter/temperature', { value, from });
  }

  /**
   * Converter - JSON to YAML
   */
  async jsonToYaml(json: string): Promise<ApiResponse<{ yaml: string }>> {
    return this.post('/converter/json-to-yaml', { json });
  }

  /**
   * Converter - YAML to JSON
   */
  async yamlToJson(yaml: string): Promise<ApiResponse<{ json: string }>> {
    return this.post('/converter/yaml-to-json', { yaml });
  }

  /**
   * Converter - JSON to XML
   */
  async jsonToXml(json: string): Promise<ApiResponse<{ xml: string }>> {
    return this.post('/converter/json-to-xml', { json });
  }

  /**
   * Converter - XML to JSON
   */
  async xmlToJson(xml: string): Promise<ApiResponse<{ json: string }>> {
    return this.post('/converter/xml-to-json', { xml });
  }

  /**
   * Converter - Markdown to HTML
   */
  async markdownToHtml(markdown: string): Promise<ApiResponse<{ html: string }>> {
    return this.post('/web/markdown/to-html', { markdown });
  }

  /**
   * Converter - List format conversions
   */
  async convertList(list: string, from: string = 'comma', to: string = 'newline'): Promise<ApiResponse<Record<string, string>>> {
    return this.post('/converter/list', { list, from, to });
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
