// IT Tools App Configuration
// Centralized configuration for IT Tools application

export const itToolsConfig = {
  name: 'IT Tools',
  namespace: 'ittools',
  description: 'Collection of 88+ handy online tools for developers',
  version: 'v1',

  // API Configuration
  api: {
    namespace: 'ittools',
    baseUrl: '/api/ittools',
    version: 'v1',
    timeout: 30000
  },

  // Route Configuration
  routes: {
    prefix: '/ittools',
    pages: [
      'index',
      'tools',
      'tool-detail',
      'favorites',
      'history'
    ]
  },

  // Tool Categories
  categories: [
    { id: 'crypto', name: 'Crypto & Security', icon: '🔐', count: 12 },
    { id: 'converter', name: 'Converters', icon: '🔄', count: 25 },
    { id: 'web', name: 'Web Dev', icon: '🌐', count: 15 },
    { id: 'text', name: 'Text Processing', icon: '📝', count: 18 },
    { id: 'math', name: 'Math', icon: '🔢', count: 5 },
    { id: 'network', name: 'Network', icon: '🖥️', count: 11 },
    { id: 'media', name: 'Media', icon: '🎥', count: 3 }
  ],

  // Features
  features: {
    search: true,
    favorites: true,
    history: true,
    api: true,
    themes: true,
    localization: true,
    offline: false
  },

  // API Endpoints organized by category
  endpoints: {
    // Crypto & Security
    CRYPTO: {
      HASH: '/crypto/hash',
      BCRYPT_HASH: '/crypto/bcrypt/hash',
      BCRYPT_VERIFY: '/crypto/bcrypt/verify',
      UUID_GENERATE: '/crypto/uuid/generate',
      ULID_GENERATE: '/crypto/ulid/generate',
      TOKEN_GENERATE: '/crypto/token/generate',
      BASIC_AUTH: '/crypto/basic-auth',
      HMAC: '/crypto/hmac',
      RSA_GENERATE: '/crypto/rsa/generate',
      BIP39_GENERATE: '/crypto/bip39/generate',
      OTP_GENERATE: '/crypto/otp/generate',
      OTP_VERIFY: '/crypto/otp/verify',
      PASSWORD_ANALYZE: '/crypto/password/analyze',
      ENCRYPT: '/crypto/encrypt',
      DECRYPT: '/crypto/decrypt'
    },

    // Converters
    CONVERTER: {
      BASE64_ENCODE: '/converter/base64/encode',
      BASE64_DECODE: '/converter/base64/decode',
      CASE: '/converter/case',
      URL_ENCODE: '/converter/url/encode',
      URL_DECODE: '/converter/url/decode',
      COLOR: '/converter/color',
      BASE: '/converter/base',
      SLUGIFY: '/converter/slugify',
      JSON_TO_YAML: '/converter/json-to-yaml',
      YAML_TO_JSON: '/converter/yaml-to-json',
      JSON_TO_CSV: '/converter/json-to-csv',
      TEMPERATURE: '/converter/temperature',
      ROMAN_TO_ARABIC: '/converter/roman/to-arabic'
    },

    // Web Development
    WEB: {
      JSON_PRETTIFY: '/web/json/prettify',
      JSON_MINIFY: '/web/json/minify',
      JSON_DIFF: '/web/json/diff',
      JWT_PARSE: '/web/jwt/parse',
      HTML_ENCODE: '/web/html/encode',
      HTML_DECODE: '/web/html/decode',
      MARKDOWN_TO_HTML: '/web/markdown/to-html',
      SQL_FORMAT: '/web/sql/format',
      QR_CODE_GENERATE: '/web/qr-code/generate',
      YAML_FORMAT: '/web/yaml/format',
      XML_FORMAT: '/web/xml/format',
      HTTP_STATUS: '/web/http/status',
      MIME_TYPES: '/web/mime-types',
      META_TAGS_GENERATE: '/web/meta-tags/generate',
      SVG_OPTIMIZE: '/web/svg/optimize'
    },

    // Text Processing
    TEXT: {
      STATISTICS: '/text/statistics',
      REGEX_TEST: '/text/regex/test',
      URL_PARSE: '/text/url/parse',
      LOREM_IPSUM: '/text/lorem-ipsum',
      EMAIL_NORMALIZE: '/text/email/normalize',
      NUMERONYM: '/text/numeronym',
      DIFF: '/text/diff',
      ASCII_ART: '/text/ascii-art',
      CRONTAB_PARSE: '/text/crontab/parse',
      PHONE_PARSE: '/text/phone/parse',
      IBAN_VALIDATE: '/text/iban/validate',
      SAFELINK_ENCODE: '/text/safelink/encode',
      EMOJI_PICKER: '/text/emoji/picker',
      GIT_MEMO: '/text/git/memo'
    },

    // Math
    MATH: {
      EVALUATE: '/math/evaluate',
      PERCENTAGE: '/math/percentage',
      ETA: '/math/eta'
    },

    // Network
    NETWORK: {
      IPV4_CONVERT: '/network/ipv4/convert',
      IPV4_SUBNET: '/network/ipv4/subnet',
      IPV4_EXPAND: '/network/ipv4/expand',
      MAC_GENERATE: '/network/mac/generate',
      CHMOD: '/network/chmod',
      PORT_RANDOM: '/network/port/random'
    }
  },

  // Storage Keys
  storage: {
    API_BASE_URL: 'ittools_api_base_url',
    FAVORITES: 'ittools_favorites',
    HISTORY: 'ittools_history',
    SETTINGS: 'ittools_settings'
  }
};

export default itToolsConfig;
