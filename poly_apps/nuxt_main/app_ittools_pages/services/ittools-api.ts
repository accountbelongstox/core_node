// IT Tools API Service
// Centralized API service using common httpClient
// Per NUXT_MULTI_APP_ARCHITECTURE.md - uses common utilities

import { httpClient } from '@/common/utils/http-client';
import { itToolsApiConfig, buildEndpoint } from '../config_app_ittools/api-config';
import type { ApiResponse } from '../types_app_ittools';

/**
 * IT Tools API Service
 * Provides typed methods for all IT Tools API endpoints
 */
class ItToolsApiService {
  private namespace: string;
  private headers: Record<string, string>;

  constructor() {
    this.namespace = itToolsApiConfig.namespace;
    this.headers = itToolsApiConfig.headers;
  }

  // ==================== CRYPTO TOOLS ====================

  async hashText(text: string, algorithm: string = 'sha256'): Promise<ApiResponse<{ hash: string }>> {
    return httpClient.post(buildEndpoint('/crypto/hash'), { text, algorithm }, { headers: this.headers });
  }

  async bcryptHash(password: string, rounds: number = 10): Promise<ApiResponse<{ hash: string }>> {
    return httpClient.post(buildEndpoint('/crypto/bcrypt/hash'), { password, rounds }, { headers: this.headers });
  }

  async bcryptVerify(password: string, hash: string): Promise<ApiResponse<{ valid: boolean }>> {
    return httpClient.post(buildEndpoint('/crypto/bcrypt/verify'), { password, hash }, { headers: this.headers });
  }

  async generateUUID(count: number = 1, uppercase: boolean = false, version: number = 4): Promise<ApiResponse<{ uuids: string[] }>> {
    return httpClient.post(buildEndpoint('/crypto/uuid/generate'), { count, uppercase, version }, { headers: this.headers });
  }

  async generateULID(count: number = 1): Promise<ApiResponse<{ ulids: string[] }>> {
    return httpClient.post(buildEndpoint('/crypto/ulid/generate'), { count }, { headers: this.headers });
  }

  async generateToken(length: number = 32, charset: string = 'alphanumeric', count: number = 1): Promise<ApiResponse<{ tokens: string[] }>> {
    return httpClient.post(buildEndpoint('/crypto/token/generate'), { length, charset, count }, { headers: this.headers });
  }

  async generateBasicAuth(username: string, password: string): Promise<ApiResponse<{ header: string; token: string }>> {
    return httpClient.post(buildEndpoint('/crypto/basic-auth'), { username, password }, { headers: this.headers });
  }

  async generateHmac(message: string, secret: string, algorithm: string = 'sha256'): Promise<ApiResponse<{ hmac: string }>> {
    return httpClient.post(buildEndpoint('/crypto/hmac'), { message, text: message, secret, algorithm }, { headers: this.headers });
  }

  async generateRsaKeyPair(keySize: number = 2048, format: 'pem' | 'der' = 'pem'): Promise<ApiResponse<{ publicKey: string; privateKey: string }>> {
    return httpClient.post(buildEndpoint('/crypto/rsa/generate'), { keySize, format }, { headers: this.headers });
  }

  async generateBip39(strength: number = 128, language: string = 'english'): Promise<ApiResponse<{ mnemonic: string; entropy: string }>> {
    return httpClient.post(buildEndpoint('/crypto/bip39/generate'), { strength, language }, { headers: this.headers });
  }

  async generateOtp(secret: string, type: 'totp' | 'hotp' = 'totp', digits: number = 6, period: number = 30): Promise<ApiResponse<{ code: string; remainingTime?: number }>> {
    return httpClient.post(buildEndpoint('/crypto/otp/generate'), { secret, type, digits, period }, { headers: this.headers });
  }

  async verifyOtp(secret: string, code: string, type: 'totp' | 'hotp' = 'totp'): Promise<ApiResponse<{ valid: boolean }>> {
    return httpClient.post(buildEndpoint('/crypto/otp/verify'), { secret, code, type }, { headers: this.headers });
  }

  async analyzePassword(password: string): Promise<ApiResponse<{ score: number; strength: string; suggestions: string[] }>> {
    return httpClient.post(buildEndpoint('/crypto/password/analyze'), { password }, { headers: this.headers });
  }

  async encrypt(text: string, algorithm: string, key: string, iv?: string): Promise<ApiResponse<{ encrypted: string }>> {
    return httpClient.post(buildEndpoint('/crypto/encrypt'), { text, algorithm, key, iv }, { headers: this.headers });
  }

  async decrypt(encrypted: string, algorithm: string, key: string, iv?: string): Promise<ApiResponse<{ decrypted: string }>> {
    return httpClient.post(buildEndpoint('/crypto/decrypt'), { encrypted, algorithm, key, iv }, { headers: this.headers });
  }

  // ==================== CONVERTER TOOLS ====================

  async base64Encode(text: string): Promise<ApiResponse<{ encoded: string }>> {
    return httpClient.post(buildEndpoint('/converter/base64/encode'), { text }, { headers: this.headers });
  }

  async base64Decode(encoded: string): Promise<ApiResponse<{ decoded: string }>> {
    return httpClient.post(buildEndpoint('/converter/base64/decode'), { encoded }, { headers: this.headers });
  }

  async urlEncode(text: string): Promise<ApiResponse<{ encoded: string }>> {
    return httpClient.post(buildEndpoint('/converter/url/encode'), { text }, { headers: this.headers });
  }

  async urlDecode(text: string): Promise<ApiResponse<{ decoded: string }>> {
    return httpClient.post(buildEndpoint('/converter/url/decode'), { text }, { headers: this.headers });
  }

  async convertCase(text: string): Promise<ApiResponse<Record<string, string>>> {
    return httpClient.post(buildEndpoint('/converter/case'), { text }, { headers: this.headers });
  }

  async convertColor(color: string): Promise<ApiResponse<Record<string, string>>> {
    return httpClient.post(buildEndpoint('/converter/color'), { color }, { headers: this.headers });
  }

  async slugify(text: string, separator: string = '-'): Promise<ApiResponse<{ slug: string }>> {
    return httpClient.post(buildEndpoint('/converter/slugify'), { text, separator }, { headers: this.headers });
  }

  async convertTemperature(value: number, from: string): Promise<ApiResponse<Record<string, number>>> {
    return httpClient.post(buildEndpoint('/converter/temperature'), { value, from }, { headers: this.headers });
  }

  async convertDateTime(input: string, inputFormat?: string, outputFormat?: string, timezone?: string): Promise<ApiResponse<Record<string, any>>> {
    return httpClient.post(buildEndpoint('/converter/datetime'), { input, inputFormat, outputFormat, timezone }, { headers: this.headers });
  }

  async jsonToYaml(json: string): Promise<ApiResponse<{ yaml: string }>> {
    return httpClient.post(buildEndpoint('/converter/json-to-yaml'), { json }, { headers: this.headers });
  }

  async yamlToJson(yaml: string): Promise<ApiResponse<{ json: string }>> {
    return httpClient.post(buildEndpoint('/converter/yaml-to-json'), { yaml }, { headers: this.headers });
  }

  async jsonToXml(json: string): Promise<ApiResponse<{ xml: string }>> {
    return httpClient.post(buildEndpoint('/converter/json-to-xml'), { json }, { headers: this.headers });
  }

  async xmlToJson(xml: string): Promise<ApiResponse<{ json: string }>> {
    return httpClient.post(buildEndpoint('/converter/xml-to-json'), { xml }, { headers: this.headers });
  }

  async jsonToToml(json: string): Promise<ApiResponse<{ toml: string }>> {
    return httpClient.post(buildEndpoint('/converter/json-to-toml'), { json }, { headers: this.headers });
  }

  async tomlToJson(toml: string): Promise<ApiResponse<{ json: string }>> {
    return httpClient.post(buildEndpoint('/converter/toml-to-json'), { toml }, { headers: this.headers });
  }

  async jsonToCsv(json: string, delimiter: string = ','): Promise<ApiResponse<{ csv: string }>> {
    return httpClient.post(buildEndpoint('/converter/json-to-csv'), { json, delimiter }, { headers: this.headers });
  }

  async convertIntegerBase(value: string, fromBase: number, toBase: number): Promise<ApiResponse<{ result: string }>> {
    return httpClient.post(buildEndpoint('/converter/base'), { value, fromBase, toBase }, { headers: this.headers });
  }

  async romanToArabic(value: string): Promise<ApiResponse<{ roman: string; arabic: number }>> {
    return httpClient.post(buildEndpoint('/converter/roman/to-arabic'), { value }, { headers: this.headers });
  }

  // ==================== WEB TOOLS ====================

  async jsonPrettify(json: string, indent: number = 2): Promise<ApiResponse<{ formatted: string }>> {
    return httpClient.post(buildEndpoint('/web/json/prettify'), { json, indent }, { headers: this.headers });
  }

  async jsonMinify(json: string): Promise<ApiResponse<{ minified: string }>> {
    return httpClient.post(buildEndpoint('/web/json/minify'), { json }, { headers: this.headers });
  }

  async jsonDiff(json1: string, json2: string): Promise<ApiResponse<{ differences: any[]; hasDifferences: boolean }>> {
    return httpClient.post(buildEndpoint('/web/json/diff'), { json1, json2 }, { headers: this.headers });
  }

  async parseJwt(token: string): Promise<ApiResponse<{ header: any; payload: any; signature: string }>> {
    return httpClient.post(buildEndpoint('/web/jwt/parse'), { token }, { headers: this.headers });
  }

  async htmlEncode(text: string): Promise<ApiResponse<{ encoded: string }>> {
    return httpClient.post(buildEndpoint('/web/html/encode'), { text }, { headers: this.headers });
  }

  async htmlDecode(text: string): Promise<ApiResponse<{ decoded: string }>> {
    return httpClient.post(buildEndpoint('/web/html/decode'), { text }, { headers: this.headers });
  }

  async markdownToHtml(markdown: string): Promise<ApiResponse<{ html: string }>> {
    return httpClient.post(buildEndpoint('/web/markdown/to-html'), { markdown }, { headers: this.headers });
  }

  async formatSql(sql: string, indent: string = '  ', uppercase: boolean = true): Promise<ApiResponse<{ formatted: string }>> {
    return httpClient.post(buildEndpoint('/web/sql/format'), { sql, indent, uppercase }, { headers: this.headers });
  }

  async formatXml(xml: string, indent: number = 2): Promise<ApiResponse<{ formatted: string }>> {
    return httpClient.post(buildEndpoint('/web/xml/format'), { xml, indent }, { headers: this.headers });
  }

  async validateYaml(yaml: string): Promise<ApiResponse<{ valid: boolean; parsed?: any; error?: string }>> {
    return httpClient.post(buildEndpoint('/web/yaml/validate'), { yaml }, { headers: this.headers });
  }

  async generateQrCode(text: string, size: number = 256, errorCorrectionLevel: string = 'M'): Promise<ApiResponse<{ qrCode: string }>> {
    return httpClient.post(buildEndpoint('/web/qr-code/generate'), { text, size, errorCorrectionLevel }, { headers: this.headers });
  }

  async generateWifiQrCode(ssid: string, password?: string, encryption: string = 'WPA', hidden: boolean = false): Promise<ApiResponse<{ qrCode: string }>> {
    return httpClient.post(buildEndpoint('/web/wifi-qr-code/generate'), { ssid, password, encryption, hidden }, { headers: this.headers });
  }

  async generateMetaTags(title: string, description: string, keywords?: string, author?: string, image?: string): Promise<ApiResponse<{ html: string }>> {
    return httpClient.post(buildEndpoint('/web/meta-tags/generate'), { title, description, keywords, author, ogImage: image }, { headers: this.headers });
  }

  async getHttpStatus(code?: number): Promise<ApiResponse<any>> {
    const endpoint = code ? `/web/http-status/${code}` : '/web/http-status';
    return httpClient.get(buildEndpoint(endpoint), { headers: this.headers });
  }

  async getMimeTypes(extension?: string): Promise<ApiResponse<any>> {
    const endpoint = extension ? `/web/mime-types/${extension.replace(/^\./, '')}` : '/web/mime-types';
    return httpClient.get(buildEndpoint(endpoint), { headers: this.headers });
  }

  // ==================== TEXT TOOLS ====================

  async textStatistics(text: string): Promise<ApiResponse<any>> {
    return httpClient.post(buildEndpoint('/text/statistics'), { text }, { headers: this.headers });
  }

  async regexTest(pattern: string, text: string, flags?: string): Promise<ApiResponse<any>> {
    return httpClient.post(buildEndpoint('/text/regex/test'), { pattern, text, flags }, { headers: this.headers });
  }

  async parseUrl(url: string): Promise<ApiResponse<any>> {
    return httpClient.post(buildEndpoint('/text/url/parse'), { url }, { headers: this.headers });
  }

  // ==================== MATH TOOLS ====================

  async evaluateExpression(expression: string): Promise<ApiResponse<{ result: number }>> {
    return httpClient.post(buildEndpoint('/math/evaluate'), { expression }, { headers: this.headers });
  }

  async calculatePercentage(operation: string, value1: number, value2?: number): Promise<ApiResponse<any>> {
    return httpClient.post(buildEndpoint('/math/percentage'), { operation, value1, value2 }, { headers: this.headers });
  }

  async calculateEta(totalItems: number, completedItems: number, elapsedTime: number, unit: string = 'seconds'): Promise<ApiResponse<any>> {
    return httpClient.post(buildEndpoint('/math/eta'), { totalItems, completedItems, elapsedTime, unit }, { headers: this.headers });
  }

  // ==================== NETWORK TOOLS ====================

  async ipv4Convert(ip: string, format: string): Promise<ApiResponse<any>> {
    return httpClient.post(buildEndpoint('/network/ipv4/convert'), { ip, format }, { headers: this.headers });
  }

  async ipv4Subnet(ip: string, cidr: number): Promise<ApiResponse<any>> {
    return httpClient.post(buildEndpoint('/network/ipv4/subnet'), { ip, cidr }, { headers: this.headers });
  }

  async ipv4Expand(range: string): Promise<ApiResponse<{ ips: string[]; count: number }>> {
    return httpClient.post(buildEndpoint('/network/ipv4/expand'), { range }, { headers: this.headers });
  }

  async ipv6GenerateUla(count: number = 1): Promise<ApiResponse<{ addresses: string[] }>> {
    return httpClient.post(buildEndpoint('/network/ipv6/ula'), { count }, { headers: this.headers });
  }

  async macGenerate(count: number = 1, separator: string = ':', uppercase: boolean = true): Promise<ApiResponse<{ addresses: string[] }>> {
    return httpClient.post(buildEndpoint('/network/mac/generate'), { count, separator, uppercase }, { headers: this.headers });
  }

  async macLookup(mac: string): Promise<ApiResponse<{ vendor?: string; prefix?: string }>> {
    return httpClient.post(buildEndpoint('/network/mac/lookup'), { mac }, { headers: this.headers });
  }

  async parseUserAgent(userAgent: string): Promise<ApiResponse<any>> {
    return httpClient.post(buildEndpoint('/network/user-agent/parse'), { userAgent }, { headers: this.headers });
  }

  // ==================== TOOLS MANAGEMENT ====================

  async getAllTools(): Promise<ApiResponse<any>> {
    return httpClient.get(buildEndpoint('/tools'), { headers: this.headers });
  }

  async getToolsByCategory(category: string): Promise<ApiResponse<any>> {
    return httpClient.get(buildEndpoint(`/tools/category/${category}`), { headers: this.headers });
  }

  async searchTools(query: string): Promise<ApiResponse<any>> {
    return httpClient.get(buildEndpoint(`/tools/search?q=${encodeURIComponent(query)}`), { headers: this.headers });
  }

  // ==================== NGINX MANAGEMENT ====================

  async nginxListSites(): Promise<ApiResponse<any[]>> {
    return httpClient.get(buildEndpoint('/v1/nginx/sites'), { headers: this.headers });
  }

  async nginxGetSiteConfig(siteName: string): Promise<ApiResponse<any>> {
    return httpClient.get(buildEndpoint(`/v1/nginx/config?site_name=${encodeURIComponent(siteName)}`), { headers: this.headers });
  }

  async nginxEnableSite(siteName: string): Promise<ApiResponse<any>> {
    return httpClient.post(buildEndpoint('/v1/nginx/enable'), { site: siteName }, { headers: this.headers });
  }

  async nginxDisableSite(siteName: string): Promise<ApiResponse<any>> {
    return httpClient.post(buildEndpoint('/v1/nginx/disable'), { site: siteName }, { headers: this.headers });
  }

  async nginxTestConfig(): Promise<ApiResponse<any>> {
    return httpClient.post(buildEndpoint('/v1/nginx/test'), {}, { headers: this.headers });
  }

  async nginxReload(): Promise<ApiResponse<any>> {
    return httpClient.post(buildEndpoint('/v1/nginx/reload'), {}, { headers: this.headers });
  }
}

// Export singleton instance
export const itToolsApi = new ItToolsApiService();

// Export class for custom instances
export default ItToolsApiService;

