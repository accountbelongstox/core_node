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
   * Converter - Base64 File Encode
   */
  async base64FileEncode(fileData: string, fileName: string): Promise<ApiResponse<{ encoded: string; size?: number }>> {
    return this.post('/converter/base64/file/encode', {
      fileData,
      fileName
    });
  }

  /**
   * Converter - Base64 File Decode
   */
  async base64FileDecode(encoded: string): Promise<ApiResponse<{ fileData: string; mimeType?: string; size?: number }>> {
    return this.post('/converter/base64/file/decode', {
      encoded
    });
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
   * Converter - Date Time
   */
  async convertDateTime(params: {
    input: string;
    inputFormat?: string | null;
    outputFormat?: string | null;
    timezone?: string | null;
    customFormat?: string | null;
    customInputFormat?: string | null;
  }): Promise<ApiResponse<Record<string, any>>> {
    const payload: Record<string, any> = {
      input: params.input
    };

    if (params.inputFormat) payload.inputFormat = params.inputFormat;
    if (params.outputFormat) payload.outputFormat = params.outputFormat;
    if (params.timezone) payload.timezone = params.timezone;
    if (params.customFormat) payload.customFormat = params.customFormat;
    if (params.customInputFormat) payload.customInputFormat = params.customInputFormat;

    return this.post('/converter/datetime', payload);
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
   * Converter - JSON <-> TOML and TOML <-> YAML
   */
  async jsonToToml(json: string): Promise<ApiResponse<{ toml: string }>> {
    return this.post('/converter/json-to-toml', { json });
  }

  async tomlToJson(toml: string): Promise<ApiResponse<{ json: string }>> {
    return this.post('/converter/toml-to-json', { toml });
  }

  async tomlToYaml(toml: string): Promise<ApiResponse<{ yaml: string }>> {
    return this.post('/converter/toml-to-yaml', { toml });
  }

  async yamlToToml(yaml: string): Promise<ApiResponse<{ toml: string }>> {
    return this.post('/converter/yaml-to-toml', { yaml });
  }

  /**
   * Text/Web - URL Parser
   */
  async parseUrl(url: string): Promise<ApiResponse<Record<string, any>>> {
    return this.post('/text/url/parse', { url });
  }

  /**
   * Converter - JSON to CSV
   */
  async jsonToCsv(json: string, delimiter: string = ',', includeHeaders: boolean = true): Promise<ApiResponse<{ csv: string }>> {
    return this.post('/converter/json-to-csv', {
      json,
      delimiter,
      includeHeaders
    });
  }

  /**
   * Converter - HTML entities encode/decode
   */
  async htmlEncode(text: string): Promise<ApiResponse<{ encoded: string }>> {
    return this.post('/web/html/encode', { text });
  }

  async htmlDecode(text: string): Promise<ApiResponse<{ decoded: string }>> {
    return this.post('/web/html/decode', { text });
  }

  /**
   * Converter - Text to binary/Unicode/NATO
   */
  async textToBinary(text: string): Promise<ApiResponse<{ binary: string }>> {
    return this.post('/converter/text-to-binary', { text });
  }

  async textToUnicode(text: string): Promise<ApiResponse<{ unicode: string }>> {
    return this.post('/converter/text-to-unicode', { text });
  }

  async textToNato(text: string): Promise<ApiResponse<{ nato: string }>> {
    return this.post('/converter/text-to-nato', { text });
  }

  /**
   * Converter - Integer base conversion
   */
  async convertIntegerBase(value: string, fromBase: number, toBase: number): Promise<ApiResponse<{ result: string }>> {
    return this.post('/converter/base', { value, fromBase, toBase });
  }

  /**
   * Converter - Roman numeral conversion
   */
  async romanToArabic(value: string): Promise<ApiResponse<{ roman: string; arabic: number }>> {
    return this.post('/converter/roman/to-arabic', { value });
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
   * Web Dev - JSON Diff
   */
  async jsonDiff(json1: string, json2: string): Promise<ApiResponse<{ differences: any[]; hasDifferences: boolean }>> {
    return this.post('/web/json/diff', { json1, json2 });
  }

  /**
   * Web - JWT Parser/Verifier
   */
  async parseJwt(token: string): Promise<ApiResponse<{ header: Record<string, any>; payload: Record<string, any>; signature: string }>> {
    return this.post('/web/jwt/parse', { token });
  }

  async verifyJwt(token: string, secret: string, algorithm: string = 'HS256'): Promise<ApiResponse<{ valid: boolean; expired?: boolean; payload?: Record<string, any> }>> {
    return this.post('/web/jwt/verify', { token, secret, algorithm });
  }

  /**
   * Web - QR Code Generators
   */
  async generateQrCode(text: string, size: number = 256, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M'): Promise<ApiResponse<{ qrCode: string }>> {
    return this.post('/web/qr-code/generate', { text, size, errorCorrectionLevel });
  }

  async generateWifiQrCode(params: { ssid: string; password?: string; encryption?: 'WPA' | 'WEP' | 'nopass'; hidden?: boolean }): Promise<ApiResponse<{ qrCode: string }>> {
    return this.post('/web/wifi-qr-code/generate', {
      ssid: params.ssid,
      password: params.password,
      encryption: params.encryption ?? 'WPA',
      hidden: params.hidden ?? false
    });
  }

  /**
   * Web - Meta Tag Generator
   */
  async generateMetaTags(payload: {
    title: string;
    description: string;
    keywords?: string[] | string;
    author?: string;
    image?: string;
    ogType?: string;
  }): Promise<ApiResponse<{ html: string }>> {
    return this.post('/web/meta-tags/generate', {
      title: payload.title,
      description: payload.description,
      keywords: payload.keywords,
      author: payload.author,
      ogType: payload.ogType,
      ogImage: payload.image
    });
  }

  /**
   * Web - HTML Renderer (WYSIWYG)
   */
  async renderHtml(content: string, mode: 'markdown' | 'html' = 'markdown', sanitize: boolean = true): Promise<ApiResponse<{ html: string }>> {
    const payload: Record<string, any> = { sanitize };
    if (mode === 'markdown') {
      payload.markdown = content;
    } else {
      payload.html = content;
    }
    return this.post('/web/html/render', payload);
  }

  /**
   * Web - SQL Formatter
   */
  async formatSql(sql: string, indent: string = '  ', uppercase: boolean = true): Promise<ApiResponse<{ formatted: string }>> {
    return this.post('/web/sql/format', { sql, indent, uppercase });
  }

  /**
   * Web - XML Formatter
   */
  async formatXml(xml: string, indent: number = 2): Promise<ApiResponse<{ formatted: string; valid?: boolean; errors?: string[] }>> {
    return this.post('/web/xml/format', { xml, indent });
  }

  /**
   * Web - YAML Viewer / Validator
   */
  async validateYaml(yaml: string): Promise<ApiResponse<{ valid: boolean; parsed?: Record<string, any>; error?: string }>> {
    return this.post('/web/yaml/validate', { yaml });
  }

  /**
   * Web - HTTP Status Codes
   */
  async getHttpStatus(code?: number): Promise<ApiResponse<any>> {
    if (typeof code === 'number') {
      return this.get(`/web/http-status/${code}`);
    }
    return this.get('/web/http-status');
  }

  /**
   * Web - MIME Types
   */
  async getMimeTypes(extension?: string): Promise<ApiResponse<any>> {
    if (extension && extension.trim()) {
      const normalized = extension.replace(/^\./, '');
      return this.get(`/web/mime-types/${normalized}`);
    }
    return this.get('/web/mime-types');
  }

  /**
   * Network - User Agent Parser
   */
  async parseUserAgent(userAgent: string): Promise<ApiResponse<Record<string, any>>> {
    return this.post('/network/user-agent/parse', { userAgent });
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

  async calculatePercentage(operation: string, value1: number, value2?: number): Promise<ApiResponse<Record<string, any>>> {
    return this.post('/math/percentage', { operation, value1, value2 });
  }

  async calculateEta(totalItems: number, completedItems: number, elapsedTime: number, unit: string = 'seconds'): Promise<ApiResponse<Record<string, any>>> {
    return this.post('/math/eta', { totalItems, completedItems, elapsedTime, unit });
  }

  async benchmark(operation: string, iterations: number, data?: any): Promise<ApiResponse<Record<string, any>>> {
    return this.post('/math/benchmark', { operation, iterations, data });
  }

  async startChronometer(): Promise<ApiResponse<{ sessionId: string }>> {
    return this.post('/math/chronometer/start', {});
  }

  async stopChronometer(sessionId: string): Promise<ApiResponse<Record<string, any>>> {
    return this.post('/math/chronometer/stop', { sessionId });
  }

  async lapChronometer(sessionId: string): Promise<ApiResponse<Record<string, any>>> {
    return this.post('/math/chronometer/lap', { sessionId });
  }

  /**
   * Network - IPv4 Convert
   */
  async ipv4Convert(ip: string, format: string): Promise<ApiResponse<any>> {
    return this.post('/network/ipv4/convert', { ip, format });
  }

  async ipv4Subnet(ip: string, cidr: number): Promise<ApiResponse<Record<string, any>>> {
    return this.post('/network/ipv4/subnet', { ip, cidr });
  }

  async ipv4Expand(range: string): Promise<ApiResponse<{ ips: string[]; count: number }>> {
    return this.post('/network/ipv4/expand', { range });
  }

  async ipv6GenerateUla(count: number = 1): Promise<ApiResponse<{ addresses: string[] }>> {
    return this.post('/network/ipv6/ula', { count });
  }

  async macGenerate(count: number = 1, separator: ':' | '-' = ':', uppercase: boolean = true, vendor?: string): Promise<ApiResponse<{ addresses: string[] }>> {
    const payload: Record<string, any> = { count, separator, uppercase };
    if (vendor) payload.vendor = vendor;
    return this.post('/network/mac/generate', payload);
  }

  async macLookup(mac: string): Promise<ApiResponse<{ vendor?: string; prefix?: string; country?: string }>> {
    return this.post('/network/mac/lookup', { mac });
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
   * Nginx Management - List Sites
   */
  async nginxListSites(): Promise<ApiResponse<any[]>> {
    return this.get('/v1/nginx/sites');
  }

  /**
   * Nginx Management - Get Site Config
   */
  async nginxGetSiteConfig(siteName: string): Promise<ApiResponse<any>> {
    return this.get('/v1/nginx/config', { site_name: siteName });
  }

  /**
   * Nginx Management - Enable Site
   */
  async nginxEnableSite(siteName: string): Promise<ApiResponse<any>> {
    return this.post('/v1/nginx/enable', { site: siteName });
  }

  /**
   * Nginx Management - Disable Site
   */
  async nginxDisableSite(siteName: string): Promise<ApiResponse<any>> {
    return this.post('/v1/nginx/disable', { site: siteName });
  }

  /**
   * Nginx Management - Test Config
   */
  async nginxTestConfig(): Promise<ApiResponse<any>> {
    return this.post('/v1/nginx/test', {});
  }

  /**
   * Nginx Management - Reload Nginx
   */
  async nginxReload(): Promise<ApiResponse<any>> {
    return this.post('/v1/nginx/reload', {});
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
