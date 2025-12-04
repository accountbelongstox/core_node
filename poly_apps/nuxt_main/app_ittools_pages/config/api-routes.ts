/**
 * ITTools API Routes Configuration
 * Centralized API endpoint definitions for ITTools application
 *
 * This file defines all API routes used by ITTools in a structured way.
 * No hardcoded URLs in components - all endpoints are defined here.
 */

export const ITTOOLS_API_ROUTES = {
  /**
   * Crypto & Security Tools
   */
  CRYPTO: {
    /** Hash text using various algorithms */
    HASH: '/api/ittools/v1/crypto/hash',
    /** BCrypt password hashing */
    BCRYPT_HASH: '/api/ittools/v1/crypto/bcrypt/hash',
    /** BCrypt password verification */
    BCRYPT_VERIFY: '/api/ittools/v1/crypto/bcrypt/verify',
    /** Generate UUID v4 */
    UUID_GENERATE: '/api/ittools/v1/crypto/uuid/generate',
    /** Generate ULID */
    ULID_GENERATE: '/api/ittools/v1/crypto/ulid/generate',
    /** Generate random token */
    TOKEN_GENERATE: '/api/ittools/v1/crypto/token/generate',
    /** Generate basic auth header */
    BASIC_AUTH: '/api/ittools/v1/crypto/basic-auth',
    /** Generate HMAC */
    HMAC: '/api/ittools/v1/crypto/hmac',
    /** Generate RSA key pair */
    RSA_GENERATE: '/api/ittools/v1/crypto/rsa/generate',
    /** Generate BIP39 mnemonic */
    BIP39_GENERATE: '/api/ittools/v1/crypto/bip39/generate',
    /** Generate OTP code */
    OTP_GENERATE: '/api/ittools/v1/crypto/otp/generate',
    /** Verify OTP code */
    OTP_VERIFY: '/api/ittools/v1/crypto/otp/verify',
    /** Analyze password strength */
    PASSWORD_ANALYZE: '/api/ittools/v1/crypto/password/analyze',
    /** Encrypt text */
    ENCRYPT: '/api/ittools/v1/crypto/encrypt',
    /** Decrypt text */
    DECRYPT: '/api/ittools/v1/crypto/decrypt',
  },

  /**
   * Converter Tools
   */
  CONVERTER: {
    /** Base64 encode */
    BASE64_ENCODE: '/api/ittools/v1/converter/base64/encode',
    /** Base64 decode */
    BASE64_DECODE: '/api/ittools/v1/converter/base64/decode',
    /** Base64 file encoding */
    BASE64_FILE_ENCODE: '/api/ittools/v1/converter/base64-file/encode',
    /** Base64 file decoding */
    BASE64_FILE_DECODE: '/api/ittools/v1/converter/base64-file/decode',
    /** Text case conversion */
    CASE: '/api/ittools/v1/converter/case',
    /** URL encode */
    URL_ENCODE: '/api/ittools/v1/converter/url/encode',
    /** URL decode */
    URL_DECODE: '/api/ittools/v1/converter/url/decode',
    /** Color format conversion */
    COLOR: '/api/ittools/v1/converter/color',
    /** Number base conversion */
    BASE: '/api/ittools/v1/converter/base',
    /** Slugify text */
    SLUGIFY: '/api/ittools/v1/converter/slugify',
    /** JSON to YAML */
    JSON_TO_YAML: '/api/ittools/v1/converter/json-to-yaml',
    /** YAML to JSON */
    YAML_TO_JSON: '/api/ittools/v1/converter/yaml-to-json',
    /** JSON to XML */
    JSON_TO_XML: '/api/ittools/v1/converter/json-to-xml',
    /** XML to JSON */
    XML_TO_JSON: '/api/ittools/v1/converter/xml-to-json',
    /** JSON to TOML */
    JSON_TO_TOML: '/api/ittools/v1/converter/json-to-toml',
    /** TOML to JSON */
    TOML_TO_JSON: '/api/ittools/v1/converter/toml-to-json',
    /** YAML to TOML */
    YAML_TO_TOML: '/api/ittools/v1/converter/yaml-to-toml',
    /** TOML to YAML */
    TOML_TO_YAML: '/api/ittools/v1/converter/toml-to-yaml',
    /** Temperature conversion */
    TEMPERATURE: '/api/ittools/v1/converter/temperature',
    /** Roman numerals conversion */
    ROMAN_TO_ARABIC: '/api/ittools/v1/converter/roman/to-arabic',
    /** Arabic to Roman numerals */
    ARABIC_TO_ROMAN: '/api/ittools/v1/converter/roman/from-arabic',
    /** Date time conversion */
    DATETIME: '/api/ittools/v1/converter/datetime',
    /** List format conversion */
    LIST: '/api/ittools/v1/converter/list',
    /** Text encoding conversion */
    TEXT_ENCODING: '/api/ittools/v1/converter/text-encoding',
    /** HTML entities encode/decode */
    HTML_ENTITIES: '/api/ittools/v1/converter/html-entities',
  },

  /**
   * Web Development Tools
   */
  WEB: {
    /** JSON prettify */
    JSON_PRETTIFY: '/api/ittools/v1/web/json/prettify',
    /** JSON minify */
    JSON_MINIFY: '/api/ittools/v1/web/json/minify',
    /** JSON diff */
    JSON_DIFF: '/api/ittools/v1/web/json/diff',
    /** JWT parse */
    JWT_PARSE: '/api/ittools/v1/web/jwt/parse',
    /** JWT generate */
    JWT_GENERATE: '/api/ittools/v1/web/jwt/generate',
    /** HTML encode */
    HTML_ENCODE: '/api/ittools/v1/web/html/encode',
    /** HTML decode */
    HTML_DECODE: '/api/ittools/v1/web/html/decode',
    /** HTML format */
    HTML_FORMAT: '/api/ittools/v1/web/html/format',
    /** CSS format */
    CSS_FORMAT: '/api/ittools/v1/web/css/format',
    /** JavaScript format */
    JS_FORMAT: '/api/ittools/v1/web/js/format',
    /** Markdown to HTML */
    MARKDOWN_TO_HTML: '/api/ittools/v1/web/markdown/to-html',
    /** SQL format */
    SQL_FORMAT: '/api/ittools/v1/web/sql/format',
    /** QR code generate */
    QR_CODE_GENERATE: '/api/ittools/v1/web/qr-code/generate',
    /** QR code read */
    QR_CODE_READ: '/api/ittools/v1/web/qr-code/read',
    /** YAML format */
    YAML_FORMAT: '/api/ittools/v1/web/yaml/format',
    /** XML format */
    XML_FORMAT: '/api/ittools/v1/web/xml/format',
    /** HTTP status info */
    HTTP_STATUS: '/api/ittools/v1/web/http/status',
    /** MIME types lookup */
    MIME_TYPES: '/api/ittools/v1/web/mime-types',
    /** Meta tags generate */
    META_TAGS_GENERATE: '/api/ittools/v1/web/meta-tags/generate',
    /** SVG optimize */
    SVG_OPTIMIZE: '/api/ittools/v1/web/svg/optimize',
  },

  /**
   * Text Processing Tools
   */
  TEXT: {
    /** Text statistics */
    STATISTICS: '/api/ittools/v1/text/statistics',
    /** Regex test */
    REGEX_TEST: '/api/ittools/v1/text/regex/test',
    /** URL parse */
    URL_PARSE: '/api/ittools/v1/text/url/parse',
    /** Lorem ipsum generate */
    LOREM_IPSUM: '/api/ittools/v1/text/lorem-ipsum',
    /** Email normalize */
    EMAIL_NORMALIZE: '/api/ittools/v1/text/email/normalize',
    /** Numeronym generate */
    NUMERONYM: '/api/ittools/v1/text/numeronym',
    /** Text diff */
    DIFF: '/api/ittools/v1/text/diff',
    /** ASCII art generate */
    ASCII_ART: '/api/ittools/v1/text/ascii-art',
    /** Crontab parse */
    CRONTAB_PARSE: '/api/ittools/v1/text/crontab/parse',
    /** Phone number parse */
    PHONE_PARSE: '/api/ittools/v1/text/phone/parse',
    /** IBAN validate */
    IBAN_VALIDATE: '/api/ittools/v1/text/iban/validate',
    /** Safelink encode/decode */
    SAFELINK: '/api/ittools/v1/text/safelink',
    /** Emoji picker data */
    EMOJI_PICKER: '/api/ittools/v1/text/emoji/picker',
    /** Git memo */
    GIT_MEMO: '/api/ittools/v1/text/git/memo',
  },

  /**
   * Math & Calculation Tools
   */
  MATH: {
    /** Expression evaluate */
    EVALUATE: '/api/ittools/v1/math/evaluate',
    /** Percentage calculate */
    PERCENTAGE: '/api/ittools/v1/math/percentage',
    /** ETA calculate */
    ETA: '/api/ittools/v1/math/eta',
    /** Unit conversion */
    UNIT_CONVERT: '/api/ittools/v1/math/unit-convert',
    /** Number to words */
    NUMBER_TO_WORDS: '/api/ittools/v1/math/number-to-words',
  },

  /**
   * Network Tools
   */
  NETWORK: {
    /** IPv4 address conversion */
    IPV4_CONVERT: '/api/ittools/v1/network/ipv4/convert',
    /** IPv4 subnet calculator */
    IPV4_SUBNET: '/api/ittools/v1/network/ipv4/subnet',
    /** IPv4 range expand */
    IPV4_EXPAND: '/api/ittools/v1/network/ipv4/expand',
    /** IPv6 address conversion */
    IPV6_CONVERT: '/api/ittools/v1/network/ipv6/convert',
    /** MAC address generate */
    MAC_GENERATE: '/api/ittools/v1/network/mac/generate',
    /** Chmod calculator */
    CHMOD: '/api/ittools/v1/network/chmod',
    /** Random port generate */
    PORT_RANDOM: '/api/ittools/v1/network/port/random',
    /** Device info */
    DEVICE_INFO: '/api/ittools/v1/network/device-info',
  },

  /**
   * Color Tools
   */
  COLOR: {
    /** Color blindness simulator */
    COLOR_BLINDNESS: '/api/ittools/v1/color/blindness',
    /** Palette generator */
    PALETTE_GENERATE: '/api/ittools/v1/color/palette/generate',
    /** Gradient generator */
    GRADIENT_GENERATE: '/api/ittools/v1/color/gradient/generate',
    /** Contrast checker */
    CONTRAST_CHECK: '/api/ittools/v1/color/contrast/check',
  },

  /**
   * Calculator Tools
   */
  CALCULATOR: {
    /** Age calculator */
    AGE: '/api/ittools/v1/calculator/age',
    /** BMI calculator */
    BMI: '/api/ittools/v1/calculator/bmi',
    /** GST calculator */
    GST: '/api/ittools/v1/calculator/gst',
    /** Loan EMI calculator */
    LOAN_EMI: '/api/ittools/v1/calculator/loan-emi',
    /** Currency converter */
    CURRENCY: '/api/ittools/v1/calculator/currency',
  },

  /**
   * Development Tools
   */
  DEVELOPMENT: {
    /** Docker run to compose */
    DOCKER_CONVERTER: '/api/ittools/v1/development/docker/converter',
    /** Keycode info */
    KEYCODE_INFO: '/api/ittools/v1/development/keycode/info',
    /** Regex cheatsheet */
    REGEX_CHEATSHEET: '/api/ittools/v1/development/regex/cheatsheet',
  },

  /**
   * Meta Operations
   */
  META: {
    /** List all tools */
    TOOLS_LIST: '/api/ittools/v1/tools',
    /** Get tool by ID */
    TOOL_BY_ID: '/api/ittools/v1/tools/:id',
    /** Search tools */
    TOOLS_SEARCH: '/api/ittools/v1/tools/search',
    /** Get tools by category */
    TOOLS_BY_CATEGORY: '/api/ittools/v1/tools/category/:category',
    /** Execute tool */
    TOOL_EXECUTE: '/api/ittools/v1/tools/:id/execute',
    /** Server health check */
    SERVER_STATUS: '/api/ittools/v1/status',
    /** Integration status */
    INTEGRATION_STATUS: '/api/ittools/v1/integration/status',
  },
} as const;

/**
 * Helper function to build API URL with parameters
 * @param route API route template
 * @param params URL parameters to replace
 * @returns Complete API URL
 */
export function buildApiRoute(route: string, params?: Record<string, string | number>): string {
  if (!params) return route;

  let url = route;
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`:${key}`, String(value));
  }
  return url;
}

/**
 * Get all API routes as flat array
 */
export function getAllApiRoutes(): string[] {
  const routes: string[] = [];

  for (const category of Object.values(ITTOOLS_API_ROUTES)) {
    if (typeof category === 'object') {
      routes.push(...Object.values(category));
    }
  }

  return routes;
}

/**
 * API Route categories for organization
 */
export const API_ROUTE_CATEGORIES = Object.keys(ITTOOLS_API_ROUTES) as Array<keyof typeof ITTOOLS_API_ROUTES>;

/**
 * Type-safe API route getter
 */
export type ApiRouteCategory = keyof typeof ITTOOLS_API_ROUTES;
export type ApiRouteKey<C extends ApiRouteCategory> = keyof typeof ITTOOLS_API_ROUTES[C];

export function getApiRoute<C extends ApiRouteCategory>(
  category: C,
  key: ApiRouteKey<C>
): string {
  return ITTOOLS_API_ROUTES[category][key] as string;
}
