// IT Tools API Configuration
// Centralized API configuration for IT Tools namespace

import { itToolsAppConfig } from '@/configs/ittools.config';

/**
 * IT Tools API Configuration
 * Uses global config with namespace-specific overrides
 */
export const itToolsApiConfig = {
  namespace: 'ittools',
  baseUrl: itToolsAppConfig.api.baseUrl,
  version: 'v1',
  timeout: 30000,

  // API Endpoint paths organized by category
  endpoints: {
    // Crypto & Security
    crypto: {
      hash: '/crypto/hash',
      bcryptHash: '/crypto/bcrypt/hash',
      bcryptVerify: '/crypto/bcrypt/verify',
      uuidGenerate: '/crypto/uuid/generate',
      ulidGenerate: '/crypto/ulid/generate',
      tokenGenerate: '/crypto/token/generate',
      basicAuth: '/crypto/basic-auth',
      hmac: '/crypto/hmac',
      rsaGenerate: '/crypto/rsa/generate',
      bip39Generate: '/crypto/bip39/generate',
      otpGenerate: '/crypto/otp/generate',
      otpVerify: '/crypto/otp/verify',
      passwordAnalyze: '/crypto/password/analyze',
      encrypt: '/crypto/encrypt',
      decrypt: '/crypto/decrypt'
    },

    // Converters
    converter: {
      base64Encode: '/converter/base64/encode',
      base64Decode: '/converter/base64/decode',
      base64FileEncode: '/converter/base64/file/encode',
      base64FileDecode: '/converter/base64/file/decode',
      urlEncode: '/converter/url/encode',
      urlDecode: '/converter/url/decode',
      case: '/converter/case',
      color: '/converter/color',
      base: '/converter/base',
      slugify: '/converter/slugify',
      temperature: '/converter/temperature',
      datetime: '/converter/datetime',
      jsonToYaml: '/converter/json-to-yaml',
      yamlToJson: '/converter/yaml-to-json',
      jsonToXml: '/converter/json-to-xml',
      xmlToJson: '/converter/xml-to-json',
      jsonToToml: '/converter/json-to-toml',
      tomlToJson: '/converter/toml-to-json',
      tomlToYaml: '/converter/toml-to-yaml',
      yamlToToml: '/converter/yaml-to-toml',
      jsonToCsv: '/converter/json-to-csv',
      list: '/converter/list',
      textToBinary: '/converter/text-to-binary',
      textToUnicode: '/converter/text-to-unicode',
      textToNato: '/converter/text-to-nato',
      romanToArabic: '/converter/roman/to-arabic'
    },

    // Web Development
    web: {
      jsonPrettify: '/web/json/prettify',
      jsonMinify: '/web/json/minify',
      jsonDiff: '/web/json/diff',
      jwtParse: '/web/jwt/parse',
      jwtVerify: '/web/jwt/verify',
      htmlEncode: '/web/html/encode',
      htmlDecode: '/web/html/decode',
      htmlRender: '/web/html/render',
      markdownToHtml: '/web/markdown/to-html',
      sqlFormat: '/web/sql/format',
      xmlFormat: '/web/xml/format',
      yamlValidate: '/web/yaml/validate',
      qrCodeGenerate: '/web/qr-code/generate',
      wifiQrCodeGenerate: '/web/wifi-qr-code/generate',
      httpStatus: '/web/http-status',
      mimeTypes: '/web/mime-types',
      metaTagsGenerate: '/web/meta-tags/generate'
    },

    // Text Processing
    text: {
      statistics: '/text/statistics',
      regexTest: '/text/regex/test',
      urlParse: '/text/url/parse',
      loremIpsum: '/text/lorem-ipsum',
      diff: '/text/diff'
    },

    // Math
    math: {
      evaluate: '/math/evaluate',
      percentage: '/math/percentage',
      eta: '/math/eta',
      benchmark: '/math/benchmark',
      chronometerStart: '/math/chronometer/start',
      chronometerStop: '/math/chronometer/stop',
      chronometerLap: '/math/chronometer/lap'
    },

    // Network
    network: {
      ipv4Convert: '/network/ipv4/convert',
      ipv4Subnet: '/network/ipv4/subnet',
      ipv4Expand: '/network/ipv4/expand',
      ipv6Ula: '/network/ipv6/ula',
      macGenerate: '/network/mac/generate',
      macLookup: '/network/mac/lookup',
      userAgentParse: '/network/user-agent/parse'
    },

    // Tools management
    tools: {
      list: '/tools',
      search: '/tools/search',
      byCategory: '/tools/category'
    },

    // Nginx management
    nginx: {
      sites: '/v1/nginx/sites',
      config: '/v1/nginx/config',
      enable: '/v1/nginx/enable',
      disable: '/v1/nginx/disable',
      test: '/v1/nginx/test',
      reload: '/v1/nginx/reload'
    }
  },

  // HTTP Headers for all requests
  headers: {
    'X-App-Namespace': 'ittools',
    'Content-Type': 'application/json'
  }
};

/**
 * Get full endpoint URL
 */
export function getEndpointUrl(category: keyof typeof itToolsApiConfig.endpoints, endpoint: string): string {
  const categoryEndpoints = itToolsApiConfig.endpoints[category] as Record<string, string>;
  const path = categoryEndpoints?.[endpoint];
  if (!path) {
    console.warn(`[IT Tools API] Unknown endpoint: ${category}.${endpoint}`);
    return '';
  }
  return `${itToolsApiConfig.baseUrl}${path}`;
}

/**
 * Build endpoint path with base URL
 */
export function buildEndpoint(path: string): string {
  return `${itToolsApiConfig.baseUrl}${path}`;
}

export default itToolsApiConfig;

