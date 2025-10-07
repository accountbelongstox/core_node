// IT Tools Configuration
// All API endpoints, parameters, and settings are centralized here

const CONFIG = {
    // API Base URL
    API_BASE_URL: 'https://api.si.12gm.com/it-tools/v1',

    // API Endpoints by category
    ENDPOINTS: {
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

    // Tool Definitions with Parameters
    TOOLS: {
        // Crypto & Security Tools
        'hash_text': {
            name: 'Hash Text',
            description: 'Generate MD5, SHA1, SHA256, SHA512 hashes',
            category: 'crypto',
            icon: '<i class="fas fa-hashtag"></i>',
            endpoint: 'CRYPTO.HASH',
            method: 'POST',
            params: {
                text: { type: 'string', required: true },
                algorithm: { type: 'string', required: true, enum: ['md5', 'sha1', 'sha256', 'sha512'] }
            },
            keywords: ['hash', 'md5', 'sha256', 'checksum']
        },

        'bcrypt': {
            name: 'Bcrypt',
            description: 'Hash and verify passwords with bcrypt',
            category: 'crypto',
            icon: '<i class="fas fa-lock"></i>',
            endpoint: 'CRYPTO.BCRYPT_HASH',
            method: 'POST',
            params: {
                password: { type: 'string', required: true },
                rounds: { type: 'integer', required: false, default: 10, min: 4, max: 31 }
            },
            keywords: ['bcrypt', 'password', 'hash', 'verify']
        },

        'uuid_generator': {
            name: 'UUID Generator',
            description: 'Generate v4 UUIDs',
            category: 'crypto',
            icon: '<i class="fas fa-fingerprint"></i>',
            endpoint: 'CRYPTO.UUID_GENERATE',
            method: 'POST',
            params: {
                count: { type: 'integer', required: false, default: 1, min: 1, max: 100 },
                uppercase: { type: 'boolean', required: false, default: false }
            },
            keywords: ['uuid', 'guid', 'unique', 'identifier']
        },

        'token_generator': {
            name: 'Token Generator',
            description: 'Generate random tokens with custom length and charset',
            category: 'crypto',
            icon: '<i class="fas fa-key"></i>',
            endpoint: 'CRYPTO.TOKEN_GENERATE',
            method: 'POST',
            params: {
                length: { type: 'integer', required: false, default: 32, min: 8, max: 256 },
                charset: { type: 'string', required: false, default: 'alphanumeric', enum: ['alphanumeric', 'alphabetic', 'numeric', 'lowercase', 'uppercase', 'hex'] },
                includeSymbols: { type: 'boolean', required: false, default: false },
                count: { type: 'integer', required: false, default: 1, min: 1, max: 50 }
            },
            keywords: ['random', 'token', 'password', 'generate']
        },

        'base64_string': {
            name: 'Base64 String Converter',
            description: 'Encode/decode base64 strings',
            category: 'converter',
            icon: '<i class="fas fa-exchange-alt"></i>',
            endpoint: 'CONVERTER.BASE64_ENCODE',
            method: 'POST',
            params: {
                text: { type: 'string', required: true }
            },
            keywords: ['base64', 'encode', 'decode']
        },

        'color_converter': {
            name: 'Color Converter',
            description: 'Convert between HEX, RGB, HSL, HSV, CMYK',
            category: 'converter',
            icon: '<i class="fas fa-palette"></i>',
            endpoint: 'CONVERTER.COLOR',
            method: 'POST',
            params: {
                color: { type: 'string', required: true }
            },
            keywords: ['color', 'hex', 'rgb', 'hsl', 'cmyk']
        },

        'json_viewer': {
            name: 'JSON Viewer',
            description: 'Pretty print and explore JSON data',
            category: 'web',
            icon: '<i class="fas fa-eye"></i>',
            endpoint: 'WEB.JSON_PRETTIFY',
            method: 'POST',
            params: {
                json: { type: 'string', required: true },
                indent: { type: 'integer', required: false, default: 2, enum: [2, 4, 8] }
            },
            keywords: ['json', 'pretty', 'format', 'view']
        },

        'jwt_parser': {
            name: 'JWT Parser',
            description: 'Decode and validate JWT tokens',
            category: 'web',
            icon: '<i class="fas fa-id-card"></i>',
            endpoint: 'WEB.JWT_PARSE',
            method: 'POST',
            params: {
                token: { type: 'string', required: true }
            },
            keywords: ['jwt', 'token', 'decode', 'parse']
        },

        'qr_code': {
            name: 'QR Code Generator',
            description: 'Generate QR codes from text/URLs',
            category: 'web',
            icon: '<i class="fas fa-qrcode"></i>',
            endpoint: 'WEB.QR_CODE_GENERATE',
            method: 'POST',
            params: {
                text: { type: 'string', required: true },
                size: { type: 'integer', required: false, default: 300, min: 100, max: 1000 },
                errorCorrection: { type: 'string', required: false, default: 'M', enum: ['L', 'M', 'Q', 'H'] }
            },
            keywords: ['qr', 'code', 'generate', 'barcode']
        },

        'text_stats': {
            name: 'Text Statistics',
            description: 'Analyze text (word count, character count, etc.)',
            category: 'text',
            icon: '<i class="fas fa-chart-bar"></i>',
            endpoint: 'TEXT.STATISTICS',
            method: 'POST',
            params: {
                text: { type: 'string', required: true }
            },
            keywords: ['text', 'statistics', 'word count', 'analyze']
        },

        'regex_tester': {
            name: 'Regex Tester',
            description: 'Test regular expressions with real-time matching',
            category: 'text',
            icon: '<i class="fas fa-search"></i>',
            endpoint: 'TEXT.REGEX_TEST',
            method: 'POST',
            params: {
                pattern: { type: 'string', required: true },
                text: { type: 'string', required: true },
                flags: { type: 'string', required: false, default: 'g' }
            },
            keywords: ['regex', 'regexp', 'pattern', 'match']
        }
    },

    // API Request Configuration
    REQUEST: {
        TIMEOUT: 30000, // 30 seconds
        HEADERS: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    },

    // UI Configuration
    UI: {
        SEARCH_DEBOUNCE: 300, // milliseconds
        TOAST_DURATION: 3000, // milliseconds
        DEFAULT_CATEGORY: 'all'
    },

    // Local Storage Keys
    STORAGE: {
        API_BASE_URL: 'it_tools_api_base_url',
        FAVORITES: 'it_tools_favorites',
        RECENT: 'it_tools_recent',
        THEME: 'it_tools_theme'
    },

    // Helper methods to get full endpoint URL
    getEndpointUrl(endpointKey) {
        const keys = endpointKey.split('.');
        let endpoint = this.ENDPOINTS;

        for (const key of keys) {
            endpoint = endpoint[key];
            if (!endpoint) {
                console.error(`Endpoint not found: ${endpointKey}`);
                return null;
            }
        }

        const baseUrl = localStorage.getItem(this.STORAGE.API_BASE_URL) || this.API_BASE_URL;
        return baseUrl + endpoint;
    },

    // Get tool configuration by ID
    getTool(toolId) {
        return this.TOOLS[toolId] || null;
    },

    // Get endpoint from tool
    getToolEndpoint(toolId) {
        const tool = this.getTool(toolId);
        if (!tool) return null;
        return this.getEndpointUrl(tool.endpoint);
    },

    // Get parameter validation rules for a tool
    getToolParams(toolId) {
        const tool = this.getTool(toolId);
        return tool ? tool.params : null;
    }
};

// Make CONFIG globally available
window.CONFIG = CONFIG;
