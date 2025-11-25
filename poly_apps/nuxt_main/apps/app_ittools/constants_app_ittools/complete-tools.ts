// IT Tools Complete Collection - 88 Tools
// Complete tool definitions migrated from original IT Tools project

export type ToolCategory =
  | 'crypto'
  | 'converter'
  | 'web'
  | 'text'
  | 'math'
  | 'network'
  | 'media'
  | 'development'
  | 'measurement'
  | 'data';

export interface ToolParam {
  type: 'string' | 'number' | 'boolean' | 'integer' | 'email' | 'url' | 'textarea' | 'select';
  required: boolean;
  default?: string | number | boolean;
  min?: number;
  max?: number;
  enum?: (string | number)[];
  placeholder?: string;
  description?: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string;
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params: Record<string, ToolParam>;
  keywords: string[];
  tags?: string[];
  isNew?: boolean;
  createdAt?: Date;
}

// ================== CRYPTO TOOLS (15 tools) ==================
export const CRYPTO_TOOLS: Tool[] = [
  {
    id: 'hash_text',
    name: 'Hash Text',
    description: 'Generate MD5, SHA1, SHA256, SHA512 hashes and more',
    category: 'crypto',
    icon: 'hashtag',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter text to hash' },
      algorithm: {
        type: 'select',
        required: true,
        default: 'sha256',
        enum: ['md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512', 'sha3', 'ripemd160']
      }
    },
    keywords: ['hash', 'md5', 'sha256', 'checksum', 'encryption', 'digest', 'crypto', 'security']
  },
  {
    id: 'bcrypt',
    name: 'Bcrypt',
    description: 'Generate and verify bcrypt password hashes',
    category: 'crypto',
    icon: 'key',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter text or password to hash' },
      salt_rounds: { type: 'integer', required: false, default: 10, min: 4, max: 31 }
    },
    keywords: ['bcrypt', 'password', 'hash', 'security', 'encryption']
  },
  {
    id: 'uuid_generator',
    name: 'UUID Generator',
    description: 'Generate v4 UUIDs (Universally Unique Identifiers)',
    category: 'crypto',
    icon: 'fingerprint',
    params: {
      count: { type: 'integer', required: false, default: 1, min: 1, max: 100 },
      uppercase: { type: 'boolean', required: false, default: false }
    },
    keywords: ['uuid', 'guid', 'unique', 'identifier', 'generator']
  },
  {
    id: 'token_generator',
    name: 'Token Generator',
    description: 'Generate random tokens with custom length and charset',
    category: 'crypto',
    icon: 'key',
    params: {
      length: { type: 'integer', required: false, default: 32, min: 1, max: 256 },
      charset: {
        type: 'select',
        required: false,
        default: 'alphanumeric',
        enum: ['alphanumeric', 'numeric', 'alphabetic', 'hex', 'base64', 'special']
      }
    },
    keywords: ['token', 'random', 'generate', 'string', 'password', 'api-key']
  },
  {
    id: 'ulid_generator',
    name: 'ULID Generator',
    description: 'Generate Universally Unique Lexicographically Sortable Identifiers',
    category: 'crypto',
    icon: 'sort-numeric-down',
    params: {
      count: { type: 'integer', required: false, default: 1, min: 1, max: 100 }
    },
    keywords: ['ulid', 'identifier', 'sortable', 'unique', 'generator']
  },
  {
    id: 'bip39_generator',
    name: 'BIP39 Generator',
    description: 'Generate BIP39 mnemonic seed phrases for crypto wallets',
    category: 'crypto',
    icon: 'wallet',
    params: {
      entropy_bits: {
        type: 'select',
        required: false,
        default: 128,
        enum: [128, 160, 192, 224, 256]
      }
    },
    keywords: ['bip39', 'mnemonic', 'seed', 'crypto', 'wallet', 'recovery']
  },
  {
    id: 'hmac_generator',
    name: 'HMAC Generator',
    description: 'Generate HMAC (Hash-based Message Authentication Code)',
    category: 'crypto',
    icon: 'shield-alt',
    params: {
      message: { type: 'string', required: true, placeholder: 'Enter message' },
      secret: { type: 'string', required: true, placeholder: 'Enter secret key' },
      algorithm: {
        type: 'select',
        required: false,
        default: 'sha256',
        enum: ['md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512']
      }
    },
    keywords: ['hmac', 'hash', 'authentication', 'security', 'signature']
  },
  {
    id: 'rsa_key_pair_generator',
    name: 'RSA Key Pair Generator',
    description: 'Generate RSA public/private key pairs',
    category: 'crypto',
    icon: 'lock',
    params: {
      key_size: {
        type: 'select',
        required: false,
        default: 2048,
        enum: [512, 1024, 2048, 4096, 8192]
      },
      format: {
        type: 'select',
        required: false,
        default: 'pem',
        enum: ['pem', 'der']
      }
    },
    keywords: ['rsa', 'key-pair', 'encryption', 'ssl', 'tls', 'certificate']
  },
  {
    id: 'encryption',
    name: 'Encryption',
    description: 'Encrypt and decrypt text using various algorithms',
    category: 'crypto',
    icon: 'lock',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter text to encrypt/decrypt' },
      password: { type: 'string', required: true, placeholder: 'Enter encryption password' },
      algorithm: {
        type: 'select',
        required: false,
        default: 'aes-256-gcm',
        enum: ['aes-256-gcm', 'aes-256-cbc', 'aes-128-gcm', 'aes-128-cbc']
      },
      operation: {
        type: 'select',
        required: true,
        default: 'encrypt',
        enum: ['encrypt', 'decrypt']
      }
    },
    keywords: ['encryption', 'decryption', 'aes', 'cipher', 'security']
  },
  {
    id: 'password_strength_analyser',
    name: 'Password Strength Analyser',
    description: 'Analyze password strength and get suggestions',
    category: 'crypto',
    icon: 'shield-alt',
    params: {
      password: { type: 'string', required: true, placeholder: 'Enter password to analyze' }
    },
    keywords: ['password', 'strength', 'security', 'analyze', 'checker']
  },
  {
    id: 'otp_code_generator_and_validator',
    name: 'OTP Generator & Validator',
    description: 'Generate and validate One-Time Password codes (TOTP)',
    category: 'crypto',
    icon: 'clock',
    params: {
      secret: { type: 'string', required: false, placeholder: 'Enter TOTP secret (leave empty to generate)' },
      digits: { type: 'integer', required: false, default: 6, min: 6, max: 8 },
      period: { type: 'integer', required: false, default: 30, min: 15, max: 300 }
    },
    keywords: ['otp', 'totp', '2fa', 'authenticator', 'verification']
  },
  {
    id: 'pdf_signature_checker',
    name: 'PDF Signature Checker',
    description: 'Verify digital signatures in PDF files',
    category: 'crypto',
    icon: 'file-pdf',
    params: {
      file: { type: 'string', required: true, placeholder: 'Upload PDF file' }
    },
    keywords: ['pdf', 'signature', 'verify', 'digital', 'document']
  },
  {
    id: 'basic_auth_generator',
    name: 'Basic Auth Generator',
    description: 'Generate Basic Authentication headers',
    category: 'crypto',
    icon: 'user-shield',
    params: {
      username: { type: 'string', required: true, placeholder: 'Enter username' },
      password: { type: 'string', required: true, placeholder: 'Enter password' }
    },
    keywords: ['basic-auth', 'authorization', 'header', 'http', 'credentials']
  },
  {
    id: 'random_port_generator',
    name: 'Random Port Generator',
    description: 'Generate random available network ports',
    category: 'crypto',
    icon: 'network-wired',
    params: {
      count: { type: 'integer', required: false, default: 1, min: 1, max: 10 },
      range: { type: 'string', required: false, default: '1024-65535', placeholder: '1024-65535' }
    },
    keywords: ['port', 'random', 'network', 'tcp', 'udp']
  },
  {
    id: 'numeronym_generator',
    name: 'Numeronym Generator',
    description: 'Generate numeronyms (like i18n for internationalization)',
    category: 'crypto',
    icon: 'compress',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter text to convert' }
    },
    keywords: ['numeronym', 'abbreviation', 'i18n', 'shorten']
  }
];

// ================== CONVERTER TOOLS (25 tools) ==================
export const CONVERTER_TOOLS: Tool[] = [
  {
    id: 'base64_string_converter',
    name: 'Base64 String Converter',
    description: 'Encode and decode strings to/from Base64',
    category: 'converter',
    icon: 'code',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter text to encode/decode' },
      operation: {
        type: 'select',
        required: true,
        default: 'encode',
        enum: ['encode', 'decode']
      }
    },
    keywords: ['base64', 'encode', 'decode', 'string', 'conversion']
  },
  {
    id: 'base64_file_converter',
    name: 'Base64 File Converter',
    description: 'Encode and decode files to/from Base64',
    category: 'converter',
    icon: 'file',
    params: {
      file: { type: 'string', required: true, placeholder: 'Upload file' },
      operation: {
        type: 'select',
        required: true,
        default: 'encode',
        enum: ['encode', 'decode']
      }
    },
    keywords: ['base64', 'file', 'encode', 'decode', 'upload']
  },
  {
    id: 'url_encoder',
    name: 'URL Encoder/Decoder',
    description: 'Encode and decode URLs for safe transmission',
    category: 'converter',
    icon: 'link',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter URL to encode/decode' },
      operation: {
        type: 'select',
        required: true,
        default: 'encode',
        enum: ['encode', 'decode']
      }
    },
    keywords: ['url', 'encode', 'decode', 'percent-encoding']
  },
  {
    id: 'color_converter',
    name: 'Color Converter',
    description: 'Convert between different color formats (HEX, RGB, HSL, etc.)',
    category: 'converter',
    icon: 'palette',
    params: {
      color: { type: 'string', required: true, placeholder: 'Enter color (e.g., #FF0000)' },
      input_format: {
        type: 'select',
        required: false,
        default: 'hex',
        enum: ['hex', 'rgb', 'hsl', 'hsv', 'cmyk']
      }
    },
    keywords: ['color', 'convert', 'hex', 'rgb', 'hsl', 'hsv', 'cmyk']
  },
  {
    id: 'case_converter',
    name: 'Case Converter',
    description: 'Convert text between different cases (camelCase, snake_case, etc.)',
    category: 'converter',
    icon: 'text-height',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter text to convert' }
    },
    keywords: ['case', 'convert', 'camelcase', 'snakecase', 'kebabcase', 'pascalcase']
  },
  {
    id: 'date_time_converter',
    name: 'Date Time Converter',
    description: 'Convert between different date and time formats',
    category: 'converter',
    icon: 'calendar',
    params: {
      datetime: { type: 'string', required: true, placeholder: 'Enter date/time or timestamp' },
      input_format: {
        type: 'select',
        required: false,
        default: 'auto',
        enum: ['auto', 'iso', 'unix', 'unix_ms', 'rfc2822', 'custom']
      },
      output_format: {
        type: 'select',
        required: false,
        default: 'all',
        enum: ['all', 'iso', 'timestamp', 'unix', 'utc', 'locale', 'relative', 'custom']
      },
      timezone: {
        type: 'select',
        required: false,
        default: 'utc',
        enum: ['utc', 'local', 'est', 'pst', 'gmt', 'cet']
      },
      custom_format: { type: 'string', required: false, placeholder: 'Custom output pattern (optional)' },
      custom_input_format: { type: 'string', required: false, placeholder: 'Custom input pattern (optional)' }
    },
    keywords: ['date', 'time', 'convert', 'format', 'timestamp', 'timezone']
  },
  {
    id: 'roman_numeral_converter',
    name: 'Roman Numeral Converter',
    description: 'Convert between Arabic numbers and Roman numerals',
    category: 'converter',
    icon: 'sort-numeric-up',
    params: {
      number: { type: 'string', required: true, placeholder: 'Enter number or Roman numeral' }
    },
    keywords: ['roman', 'numeral', 'convert', 'number', 'history']
  },
  {
    id: 'integer_base_converter',
    name: 'Integer Base Converter',
    description: 'Convert integers between different number bases',
    category: 'converter',
    icon: 'calculator',
    params: {
      number: { type: 'string', required: true, placeholder: 'Enter number' },
      from_base: { type: 'integer', required: false, default: 10, min: 2, max: 36 },
      to_base: { type: 'integer', required: false, default: 2, min: 2, max: 36 }
    },
    keywords: ['base', 'convert', 'binary', 'decimal', 'hexadecimal', 'octal']
  },
  {
    id: 'text_to_nato_alphabet',
    name: 'Text to NATO Alphabet',
    description: 'Convert text to NATO phonetic alphabet',
    category: 'converter',
    icon: 'microphone',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter text to convert' }
    },
    keywords: ['nato', 'phonetic', 'alphabet', 'spelling', 'aviation']
  },
  {
    id: 'text_to_binary',
    name: 'Text to Binary',
    description: 'Convert text to binary representation',
    category: 'converter',
    icon: 'memory',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter text to convert' },
      separator: { type: 'string', required: false, default: ' ' }
    },
    keywords: ['binary', 'convert', 'text', 'bits', 'ascii']
  },
  {
    id: 'text_to_unicode',
    name: 'Text to Unicode',
    description: 'Convert text to Unicode escape sequences',
    category: 'converter',
    icon: 'globe',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter text to convert' }
    },
    keywords: ['unicode', 'convert', 'text', 'escape', 'encoding']
  },
  {
    id: 'yaml_to_json_converter',
    name: 'YAML to JSON Converter',
    description: 'Convert YAML to JSON format',
    category: 'converter',
    icon: 'code',
    params: {
      yaml: { type: 'textarea', required: true, placeholder: 'Enter YAML to convert' }
    },
    keywords: ['yaml', 'json', 'convert', 'format', 'data']
  },
  {
    id: 'json_to_yaml_converter',
    name: 'JSON to YAML Converter',
    description: 'Convert JSON to YAML format',
    category: 'converter',
    icon: 'code',
    params: {
      json: { type: 'textarea', required: true, placeholder: 'Enter JSON to convert' }
    },
    keywords: ['json', 'yaml', 'convert', 'format', 'data']
  },
  {
    id: 'yaml_to_toml_converter',
    name: 'YAML to TOML Converter',
    description: 'Convert YAML to TOML format',
    category: 'converter',
    icon: 'code',
    params: {
      yaml: { type: 'textarea', required: true, placeholder: 'Enter YAML to convert' }
    },
    keywords: ['yaml', 'toml', 'convert', 'format', 'config']
  },
  {
    id: 'json_to_toml_converter',
    name: 'JSON to TOML Converter',
    description: 'Convert JSON to TOML format',
    category: 'converter',
    icon: 'code',
    params: {
      json: { type: 'textarea', required: true, placeholder: 'Enter JSON to convert' }
    },
    keywords: ['json', 'toml', 'convert', 'format', 'config']
  },
  {
    id: 'toml_to_yaml_converter',
    name: 'TOML to YAML Converter',
    description: 'Convert TOML to YAML format',
    category: 'converter',
    icon: 'code',
    params: {
      toml: { type: 'textarea', required: true, placeholder: 'Enter TOML to convert' }
    },
    keywords: ['toml', 'yaml', 'convert', 'format', 'config']
  },
  {
    id: 'toml_to_json_converter',
    name: 'TOML to JSON Converter',
    description: 'Convert TOML to JSON format',
    category: 'converter',
    icon: 'code',
    params: {
      toml: { type: 'textarea', required: true, placeholder: 'Enter TOML to convert' }
    },
    keywords: ['toml', 'json', 'convert', 'format', 'config']
  },
  {
    id: 'xml_to_json_converter',
    name: 'XML to JSON Converter',
    description: 'Convert XML to JSON format',
    category: 'converter',
    icon: 'code',
    params: {
      xml: { type: 'textarea', required: true, placeholder: 'Enter XML to convert' }
    },
    keywords: ['xml', 'json', 'convert', 'format', 'data']
  },
  {
    id: 'json_to_xml_converter',
    name: 'JSON to XML Converter',
    description: 'Convert JSON to XML format',
    category: 'converter',
    icon: 'code',
    params: {
      json: { type: 'textarea', required: true, placeholder: 'Enter JSON to convert' },
      root_element: { type: 'string', required: false, default: 'root' }
    },
    keywords: ['json', 'xml', 'convert', 'format', 'data']
  },
  {
    id: 'markdown_to_html_converter',
    name: 'Markdown to HTML Converter',
    description: 'Convert Markdown to HTML',
    category: 'converter',
    icon: 'code',
    params: {
      markdown: { type: 'textarea', required: true, placeholder: 'Enter Markdown to convert' }
    },
    keywords: ['markdown', 'html', 'convert', 'format', 'documentation']
  },
  {
    id: 'list_converter',
    name: 'List Converter',
    description: 'Convert between different list formats',
    category: 'converter',
    icon: 'list',
    params: {
      list: { type: 'textarea', required: true, placeholder: 'Enter list to convert' },
      input_format: {
        type: 'select',
        required: false,
        default: 'comma',
        enum: ['comma', 'newline', 'semicolon', 'space', 'json-array']
      },
      output_format: {
        type: 'select',
        required: false,
        default: 'newline',
        enum: ['comma', 'newline', 'semicolon', 'space', 'json-array', 'bullet-points']
      }
    },
    keywords: ['list', 'convert', 'format', 'array', 'delimiter']
  },
  {
    id: 'temperature_converter',
    name: 'Temperature Converter',
    description: 'Convert between Celsius, Fahrenheit, Kelvin',
    category: 'converter',
    icon: 'temperature-high',
    params: {
      temperature: { type: 'number', required: true, placeholder: 'Enter temperature' },
      from_unit: {
        type: 'select',
        required: true,
        default: 'celsius',
        enum: ['celsius', 'fahrenheit', 'kelvin', 'rankine']
      },
      to_unit: {
        type: 'select',
        required: true,
        default: 'fahrenheit',
        enum: ['celsius', 'fahrenheit', 'kelvin', 'rankine']
      }
    },
    keywords: ['temperature', 'convert', 'celsius', 'fahrenheit', 'kelvin']
  },
  {
    id: 'slugify_string',
    name: 'Slugify String',
    description: 'Convert text to URL-friendly slugs',
    category: 'converter',
    icon: 'link',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter text to slugify' },
      separator: { type: 'string', required: false, default: '-', placeholder: 'Separator (default: -)' }
    },
    keywords: ['slugify', 'url', 'slug', 'friendly', 'convert']
  }
];

// ================== WEB TOOLS (18 tools) ==================
export const WEB_TOOLS: Tool[] = [
  {
    id: 'json_prettify',
    name: 'JSON Prettify',
    description: 'Format and prettify JSON with proper indentation',
    category: 'web',
    icon: 'align-left',
    params: {
      json: { type: 'textarea', required: true, placeholder: 'Enter JSON to format' },
      indent: { type: 'integer', required: false, default: 2, min: 1, max: 8 }
    },
    keywords: ['json', 'format', 'prettify', 'indent', 'beautify']
  },
  {
    id: 'json_minify',
    name: 'JSON Minify',
    description: 'Minify JSON by removing whitespace',
    category: 'web',
    icon: 'compress',
    params: {
      json: { type: 'textarea', required: true, placeholder: 'Enter JSON to minify' }
    },
    keywords: ['json', 'minify', 'compress', 'reduce', 'optimize']
  },
  {
    id: 'json_to_csv_converter',
    name: 'JSON to CSV Converter',
    description: 'Convert JSON data to CSV format',
    category: 'web',
    icon: 'file-csv',
    params: {
      json: { type: 'textarea', required: true, placeholder: 'Enter JSON to convert' },
      delimiter: { type: 'string', required: false, default: ',', placeholder: 'CSV delimiter' }
    },
    keywords: ['json', 'csv', 'convert', 'export', 'data']
  },
  {
    id: 'json_diff',
    name: 'JSON Diff',
    description: 'Compare and find differences between JSON objects',
    category: 'web',
    icon: 'code-branch',
    params: {
      json1: { type: 'textarea', required: true, placeholder: 'First JSON' },
      json2: { type: 'textarea', required: true, placeholder: 'Second JSON' }
    },
    keywords: ['json', 'diff', 'compare', 'difference', 'change']
  },
  {
    id: 'html_entities',
    name: 'HTML Entities',
    description: 'Encode and decode HTML entities',
    category: 'web',
    icon: 'code',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter text to encode/decode' },
      operation: {
        type: 'select',
        required: true,
        default: 'encode',
        enum: ['encode', 'decode']
      }
    },
    keywords: ['html', 'entities', 'encode', 'decode', 'escape']
  },
  {
    id: 'url_parser',
    name: 'URL Parser',
    description: 'Parse and analyze URL components',
    category: 'web',
    icon: 'link',
    params: {
      url: { type: 'url', required: true, placeholder: 'Enter URL to parse' }
    },
    keywords: ['url', 'parse', 'analyze', 'components', 'protocol']
  },
  {
    id: 'jwt_parser',
    name: 'JWT Parser',
    description: 'Parse and decode JSON Web Tokens',
    category: 'web',
    icon: 'key',
    params: {
      token: { type: 'string', required: true, placeholder: 'Enter JWT token' }
    },
    keywords: ['jwt', 'token', 'parse', 'decode', 'jsonwebtoken']
  },
  {
    id: 'sql_prettify',
    name: 'SQL Prettify',
    description: 'Format and beautify SQL queries',
    category: 'web',
    icon: 'database',
    params: {
      sql: { type: 'textarea', required: true, placeholder: 'Enter SQL to format' }
    },
    keywords: ['sql', 'format', 'prettify', 'beautify', 'query']
  },
  {
    id: 'xml_formatter',
    name: 'XML Formatter',
    description: 'Format and prettify XML documents',
    category: 'web',
    icon: 'code',
    params: {
      xml: { type: 'textarea', required: true, placeholder: 'Enter XML to format' },
      indent: { type: 'integer', required: false, default: 2, min: 1, max: 8 }
    },
    keywords: ['xml', 'format', 'prettify', 'indent', 'beautify']
  },
  {
    id: 'yaml_viewer',
    name: 'YAML Viewer',
    description: 'View and format YAML documents',
    category: 'web',
    icon: 'file-code',
    params: {
      yaml: { type: 'textarea', required: true, placeholder: 'Enter YAML to view' }
    },
    keywords: ['yaml', 'view', 'format', 'validate']
  },
  {
    id: 'qr_code_generator',
    name: 'QR Code Generator',
    description: 'Generate QR codes from text or URLs',
    category: 'web',
    icon: 'qrcode',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter text or URL' },
      size: { type: 'integer', required: false, default: 200, min: 50, max: 1000 },
      error_correction: {
        type: 'select',
        required: false,
        default: 'M',
        enum: ['L', 'M', 'Q', 'H']
      }
    },
    keywords: ['qr', 'code', 'generate', 'barcode', 'mobile']
  },
  {
    id: 'wifi_qr_code_generator',
    name: 'WiFi QR Code Generator',
    description: 'Generate QR codes for WiFi network credentials',
    category: 'web',
    icon: 'wifi',
    params: {
      ssid: { type: 'string', required: true, placeholder: 'WiFi network name' },
      password: { type: 'string', required: false, placeholder: 'WiFi password (optional)' },
      encryption: {
        type: 'select',
        required: false,
        default: 'WPA',
        enum: ['WPA', 'WEP', 'nopass']
      },
      hidden: { type: 'boolean', required: false, default: false }
    },
    keywords: ['wifi', 'qr', 'code', 'network', 'password']
  },
  {
    id: 'meta_tag_generator',
    name: 'Meta Tag Generator',
    description: 'Generate HTML meta tags for SEO and social media',
    category: 'web',
    icon: 'tags',
    params: {
      title: { type: 'string', required: true, placeholder: 'Page title' },
      description: { type: 'string', required: true, placeholder: 'Page description' },
      keywords: { type: 'string', required: false, placeholder: 'SEO keywords' },
      author: { type: 'string', required: false, placeholder: 'Author name' },
      image_url: { type: 'url', required: false, placeholder: 'OG image URL' }
    },
    keywords: ['meta', 'tags', 'seo', 'html', 'social', 'opengraph']
  },
  {
    id: 'mime_types',
    name: 'MIME Types',
    description: 'Lookup and explore MIME types',
    category: 'web',
    icon: 'file',
    params: {
      extension: { type: 'string', required: false, placeholder: 'File extension (e.g., .pdf)' },
      mime_type: { type: 'string', required: false, placeholder: 'MIME type (e.g., application/pdf)' }
    },
    keywords: ['mime', 'type', 'file', 'extension', 'content-type']
  },
  {
    id: 'http_status_codes',
    name: 'HTTP Status Codes',
    description: 'Reference for HTTP status codes and their meanings',
    category: 'web',
    icon: 'info-circle',
    params: {
      code: { type: 'integer', required: false, placeholder: 'Enter status code (e.g., 404)' }
    },
    keywords: ['http', 'status', 'codes', 'reference', 'api']
  },
  {
    id: 'html_wysiwyg_editor',
    name: 'HTML WYSIWYG Editor',
    description: 'Rich text HTML editor with live preview',
    category: 'web',
    icon: 'edit',
    params: {
      content: { type: 'textarea', required: false, placeholder: 'Enter HTML content' }
    },
    keywords: ['html', 'editor', 'wysiwyg', 'rich-text', 'preview']
  },
  {
    id: 'user_agent_parser',
    name: 'User Agent Parser',
    description: 'Parse browser user agent strings',
    category: 'web',
    icon: 'globe',
    params: {
      user_agent: { type: 'string', required: true, placeholder: 'Enter user agent string' }
    },
    keywords: ['user-agent', 'browser', 'parse', 'detect', 'client']
  }
];

// ================== TEXT TOOLS (18 tools) ==================
export const TEXT_TOOLS: Tool[] = [
  {
    id: 'text_statistics',
    name: 'Text Statistics',
    description: 'Analyze text for word count, character count, reading time, etc.',
    category: 'text',
    icon: 'chart-bar',
    params: {
      text: { type: 'textarea', required: true, placeholder: 'Enter text to analyze' }
    },
    keywords: ['statistics', 'count', 'analysis', 'text', 'words', 'characters']
  },
  {
    id: 'lorem_ipsum_generator',
    name: 'Lorem Ipsum Generator',
    description: 'Generate placeholder Lorem Ipsum text',
    category: 'text',
    icon: 'paragraph',
    params: {
      type: {
        type: 'select',
        required: false,
        default: 'paragraphs',
        enum: ['words', 'sentences', 'paragraphs']
      },
      count: { type: 'integer', required: false, default: 3, min: 1, max: 100 },
      start_with_lorem: { type: 'boolean', required: false, default: true }
    },
    keywords: ['lorem', 'ipsum', 'placeholder', 'text', 'dummy']
  },
  {
    id: 'regex_tester',
    name: 'Regex Tester',
    description: 'Test regular expressions with sample text',
    category: 'text',
    icon: 'code',
    params: {
      pattern: { type: 'string', required: true, placeholder: 'Enter regex pattern' },
      text: { type: 'string', required: true, placeholder: 'Enter text to test' },
      flags: {
        type: 'select',
        required: false,
        default: 'g',
        enum: ['g', 'i', 'm', 's', 'u', 'y'],
        multiple: true
      }
    },
    keywords: ['regex', 'pattern', 'regular-expression', 'match', 'test']
  },
  {
    id: 'email_normalizer',
    name: 'Email Normalizer',
    description: 'Normalize and validate email addresses',
    category: 'text',
    icon: 'envelope',
    params: {
      email: { type: 'email', required: true, placeholder: 'Enter email address' }
    },
    keywords: ['email', 'normalize', 'validate', 'sanitize', 'format']
  },
  {
    id: 'text_diff',
    name: 'Text Diff',
    description: 'Compare two texts and find differences',
    category: 'text',
    icon: 'code-branch',
    params: {
      text1: { type: 'textarea', required: true, placeholder: 'Original text' },
      text2: { type: 'textarea', required: true, placeholder: 'Modified text' }
    },
    keywords: ['text', 'diff', 'compare', 'difference', 'change']
  },
  {
    id: 'string_obfuscator',
    name: 'String Obfuscator',
    description: 'Obfuscate strings to protect sensitive data',
    category: 'text',
    icon: 'eye-slash',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter text to obfuscate' },
      method: {
        type: 'select',
        required: false,
        default: 'asterisks',
        enum: ['asterisks', 'dots', 'hashes', 'partial']
      },
      visible_chars: { type: 'integer', required: false, default: 2, min: 0, max: 10 }
    },
    keywords: ['obfuscate', 'hide', 'mask', 'sensitive', 'protect']
  },
  {
    id: 'ascii_text_drawer',
    name: 'ASCII Text Drawer',
    description: 'Convert text to ASCII art',
    category: 'text',
    icon: 'font',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter text to convert' },
      font: {
        type: 'select',
        required: false,
        default: 'standard',
        enum: ['standard', 'big', 'block', '3d', 'banner']
      }
    },
    keywords: ['ascii', 'art', 'text', 'convert', 'banner']
  },
  {
    id: 'emoji_picker',
    name: 'Emoji Picker',
    description: 'Browse and copy emojis',
    category: 'text',
    icon: 'smile',
    params: {
      search: { type: 'string', required: false, placeholder: 'Search emojis...' },
      category: {
        type: 'select',
        required: false,
        default: 'all',
        enum: ['all', 'smileys', 'people', 'animals', 'food', 'activities', 'travel', 'objects', 'symbols', 'flags']
      }
    },
    keywords: ['emoji', 'picker', 'copy', 'unicode', 'emoticon']
  },
  {
    id: 'safelink_decoder',
    name: 'Safelink Decoder',
    description: 'Decode safe links and redirects',
    category: 'text',
    icon: 'external-link-alt',
    params: {
      url: { type: 'url', required: true, placeholder: 'Enter safelink URL' }
    },
    keywords: ['safelink', 'decode', 'redirect', 'url', 'unwrap']
  },
  {
    id: 'regex_memo',
    name: 'Regex Memo',
    description: 'Quick reference for common regex patterns',
    category: 'text',
    icon: 'bookmark',
    params: {
      category: {
        type: 'select',
        required: false,
        default: 'all',
        enum: ['all', 'validation', 'matching', 'searching', 'formatting']
      }
    },
    keywords: ['regex', 'memo', 'reference', 'patterns', 'cheatsheet']
  }
];

// ================== MATH TOOLS (5 tools) ==================
export const MATH_TOOLS: Tool[] = [
  {
    id: 'math_evaluator',
    name: 'Math Expression Evaluator',
    description: 'Evaluate mathematical expressions and equations',
    category: 'math',
    icon: 'calculator',
    params: {
      expression: { type: 'string', required: true, placeholder: 'e.g., 2 + 2 * 5' }
    },
    keywords: ['math', 'calculator', 'evaluate', 'expression', 'equation']
  },
  {
    id: 'eta_calculator',
    name: 'ETA Calculator',
    description: 'Calculate estimated time of arrival',
    category: 'math',
    icon: 'clock',
    params: {
      start_time: { type: 'string', required: true, placeholder: 'Start time' },
      distance: { type: 'number', required: true, placeholder: 'Total distance' },
      completed: { type: 'number', required: true, placeholder: 'Completed distance' },
      speed: { type: 'number', required: false, placeholder: 'Current speed (optional)' }
    },
    keywords: ['eta', 'time', 'arrival', 'calculate', 'estimate']
  },
  {
    id: 'percentage_calculator',
    name: 'Percentage Calculator',
    description: 'Calculate percentages and percentage changes',
    category: 'math',
    icon: 'percent',
    params: {
      calculation_type: {
        type: 'select',
        required: true,
        default: 'percentage',
        enum: ['percentage', 'increase', 'decrease', 'of_value']
      },
      value1: { type: 'number', required: true, placeholder: 'First value' },
      value2: { type: 'number', required: false, placeholder: 'Second value' }
    },
    keywords: ['percentage', 'calculate', 'percent', 'change', 'math']
  }
];

// ================== NETWORK TOOLS (11 tools) ==================
export const NETWORK_TOOLS: Tool[] = [
  {
    id: 'ipv4_subnet_calculator',
    name: 'IPv4 Subnet Calculator',
    description: 'Calculate IPv4 subnets and network ranges',
    category: 'network',
    icon: 'network-wired',
    params: {
      ip_address: { type: 'string', required: true, placeholder: 'e.g., 192.168.1.1' },
      subnet_mask: { type: 'string', required: true, placeholder: 'e.g., 255.255.255.0 or /24' }
    },
    keywords: ['ipv4', 'subnet', 'calculate', 'network', 'range', 'mask']
  },
  {
    id: 'ipv4_address_converter',
    name: 'IPv4 Address Converter',
    description: 'Convert IPv4 addresses between different formats',
    category: 'network',
    icon: 'network-wired',
    params: {
      ip: { type: 'string', required: true, placeholder: 'e.g., 192.168.1.1' },
      output_format: {
        type: 'select',
        required: true,
        default: 'all',
        enum: ['decimal', 'binary', 'hex', 'integer', 'all']
      }
    },
    keywords: ['ipv4', 'ip', 'convert', 'format', 'network']
  },
  {
    id: 'ipv4_range_expander',
    name: 'IPv4 Range Expander',
    description: 'Expand IP ranges and generate IP lists',
    category: 'network',
    icon: 'network-wired',
    params: {
      start_ip: { type: 'string', required: true, placeholder: 'Start IP (e.g., 192.168.1.1)' },
      end_ip: { type: 'string', required: true, placeholder: 'End IP (e.g., 192.168.1.10)' }
    },
    keywords: ['ipv4', 'range', 'expand', 'generate', 'list']
  },
  {
    id: 'mac_address_generator',
    name: 'MAC Address Generator',
    description: 'Generate random MAC addresses',
    category: 'network',
    icon: 'network-wired',
    params: {
      count: { type: 'integer', required: false, default: 1, min: 1, max: 100 },
      vendor: { type: 'string', required: false, placeholder: 'Vendor OUI (optional)' }
    },
    keywords: ['mac', 'address', 'generate', 'random', 'network']
  },
  {
    id: 'mac_address_lookup',
    name: 'MAC Address Lookup',
    description: 'Lookup vendor information for MAC addresses',
    category: 'network',
    icon: 'search',
    params: {
      mac_address: { type: 'string', required: true, placeholder: 'Enter MAC address' }
    },
    keywords: ['mac', 'address', 'lookup', 'vendor', 'oui']
  },
  {
    id: 'ipv6_ula_generator',
    name: 'IPv6 ULA Generator',
    description: 'Generate IPv6 Unique Local Addresses',
    category: 'network',
    icon: 'network-wired',
    params: {
      count: { type: 'integer', required: false, default: 1, min: 1, max: 100 }
    },
    keywords: ['ipv6', 'ula', 'generate', 'local', 'address']
  }
];

// ================== MEDIA TOOLS (7 tools) ==================
export const MEDIA_TOOLS: Tool[] = [
  {
    id: 'svg_placeholder_generator',
    name: 'SVG Placeholder Generator',
    description: 'Generate SVG placeholder images with custom dimensions',
    category: 'media',
    icon: 'image',
    params: {
      width: { type: 'integer', required: true, default: 300, min: 1, max: 2000 },
      height: { type: 'integer', required: false, default: 200, min: 1, max: 2000 },
      text: { type: 'string', required: false, placeholder: 'Custom text (optional)' },
      background_color: { type: 'string', required: false, default: '#ccc' },
      text_color: { type: 'string', required: false, default: '#888' }
    },
    keywords: ['svg', 'placeholder', 'image', 'generate', 'dimensions']
  },
  {
    id: 'image_compressor',
    name: 'Image Compressor',
    description: 'Compress and optimize images',
    category: 'media',
    icon: 'image',
    params: {
      image: { type: 'string', required: true, placeholder: 'Upload image' },
      quality: { type: 'integer', required: false, default: 80, min: 1, max: 100 },
      format: {
        type: 'select',
        required: false,
        default: 'auto',
        enum: ['auto', 'jpeg', 'png', 'webp']
      }
    },
    keywords: ['image', 'compress', 'optimize', 'resize', 'format']
  },
  {
    id: 'video_compressor',
    name: 'Video Compressor',
    description: 'Compress and optimize video files',
    category: 'media',
    icon: 'video',
    params: {
      video: { type: 'string', required: true, placeholder: 'Upload video file' },
      quality: {
        type: 'select',
        required: false,
        default: 'medium',
        enum: ['low', 'medium', 'high']
      }
    },
    keywords: ['video', 'compress', 'optimize', 'reduce', 'file-size']
  },
  {
    id: 'archive_creator',
    name: 'Archive Creator',
    description: 'Create archives (ZIP, TAR, etc.)',
    category: 'media',
    icon: 'file-archive',
    params: {
      files: { type: 'string', required: true, placeholder: 'Select files to archive' },
      format: {
        type: 'select',
        required: true,
        default: 'zip',
        enum: ['zip', 'tar', 'tar.gz', 'tar.bz2']
      }
    },
    keywords: ['archive', 'zip', 'tar', 'compress', 'files']
  }
];

// ================== DEVELOPMENT TOOLS (14 tools) ==================
export const DEVELOPMENT_TOOLS: Tool[] = [
  {
    id: 'git_memo',
    name: 'Git Memo',
    description: 'Quick reference for Git commands',
    category: 'development',
    icon: 'code-branch',
    params: {
      category: {
        type: 'select',
        required: false,
        default: 'all',
        enum: ['all', 'basic', 'branching', 'remotes', 'history', 'stashing']
      }
    },
    keywords: ['git', 'memo', 'reference', 'commands', 'cheatsheet']
  },
  {
    id: 'crontab_generator',
    name: 'Crontab Generator',
    description: 'Generate crontab expressions with visual editor',
    category: 'development',
    icon: 'clock',
    params: {
      minute: { type: 'string', required: false, default: '*' },
      hour: { type: 'string', required: false, default: '*' },
      day: { type: 'string', required: false, default: '*' },
      month: { type: 'string', required: false, default: '*' },
      weekday: { type: 'string', required: false, default: '*' },
      command: { type: 'string', required: true, placeholder: 'Enter command' }
    },
    keywords: ['crontab', 'cron', 'schedule', 'generator', 'linux']
  },
  {
    id: 'json_viewer',
    name: 'JSON Viewer',
    description: 'View and explore JSON data structure',
    category: 'development',
    icon: 'file-code',
    params: {
      json: { type: 'textarea', required: true, placeholder: 'Enter JSON to view' }
    },
    keywords: ['json', 'view', 'explore', 'structure', 'validate']
  },
  {
    id: 'chmod_calculator',
    name: 'Chmod Calculator',
    description: 'Calculate Linux file permissions and chmod commands',
    category: 'development',
    icon: 'shield-alt',
    params: {
      permissions: { type: 'string', required: false, default: '755', placeholder: 'Permission number (e.g., 755)' }
    },
    keywords: ['chmod', 'permissions', 'linux', 'file', 'calculate']
  },
  {
    id: 'docker_run_to_docker_compose_converter',
    name: 'Docker Run to Docker Compose Converter',
    description: 'Convert docker run commands to docker-compose.yml',
    category: 'development',
    icon: 'docker',
    params: {
      docker_run_command: { type: 'textarea', required: true, placeholder: 'Enter docker run command' }
    },
    keywords: ['docker', 'compose', 'convert', 'container', 'yaml']
  },
  {
    id: 'device_information',
    name: 'Device Information',
    description: 'Display device and browser information',
    category: 'development',
    icon: 'desktop',
    params: {},
    keywords: ['device', 'information', 'browser', 'system', 'detect']
  },
  {
    id: 'keycode_info',
    name: 'Keycode Info',
    description: 'Check keyboard key codes and events',
    category: 'development',
    icon: 'keyboard',
    params: {
      interactive: { type: 'boolean', required: false, default: true }
    },
    keywords: ['keycode', 'keyboard', 'event', 'javascript', 'code']
  }
];

// ================== MEASUREMENT TOOLS (5 tools) ==================
export const MEASUREMENT_TOOLS: Tool[] = [
  {
    id: 'chronometer',
    name: 'Chronometer',
    description: 'Precision timer and stopwatch',
    category: 'measurement',
    icon: 'stopwatch',
    params: {},
    keywords: ['chronometer', 'timer', 'stopwatch', 'measure', 'time']
  },
  {
    id: 'benchmark_builder',
    name: 'Benchmark Builder',
    description: 'Create and run performance benchmarks',
    category: 'measurement',
    icon: 'tachometer-alt',
    params: {
      test_type: {
        type: 'select',
        required: true,
        default: 'javascript',
        enum: ['javascript', 'api', 'rendering']
      },
      iterations: { type: 'integer', required: false, default: 1000, min: 1, max: 100000 }
    },
    keywords: ['benchmark', 'performance', 'test', 'speed', 'measure']
  }
];

// ================== IMAGE TOOLS (7 tools) ==================
export const IMAGE_TOOLS: Tool[] = [
  {
    id: 'image_resizer',
    name: 'Image Resizer',
    description: 'Resize images to specific dimensions',
    category: 'media',
    icon: 'expand-arrows-alt',
    params: {
      width: { type: 'integer', required: true, min: 1, max: 10000 },
      height: { type: 'integer', required: true, min: 1, max: 10000 },
      keep_aspect_ratio: { type: 'boolean', required: false, default: true }
    },
    keywords: ['image', 'resize', 'scale', 'dimensions', 'photo']
  },
  {
    id: 'image_compressor',
    name: 'Image Compressor',
    description: 'Compress and optimize images',
    category: 'media',
    icon: 'compress-alt',
    params: {
      quality: { type: 'integer', required: false, default: 80, min: 1, max: 100 }
    },
    keywords: ['image', 'compress', 'optimize', 'reduce', 'size']
  },
  {
    id: 'image_converter',
    name: 'Image Converter',
    description: 'Convert images between formats',
    category: 'media',
    icon: 'exchange-alt',
    params: {
      format: { type: 'select', required: true, enum: ['jpeg', 'png', 'webp', 'gif'] }
    },
    keywords: ['image', 'convert', 'format', 'jpeg', 'png', 'webp']
  },
  {
    id: 'image_rotate',
    name: 'Image Rotate & Flip',
    description: 'Rotate and flip images',
    category: 'media',
    icon: 'sync-alt',
    params: {
      rotation: { type: 'select', required: false, default: 90, enum: [0, 90, 180, 270] }
    },
    keywords: ['image', 'rotate', 'flip', 'transform']
  },
  {
    id: 'image_crop',
    name: 'Image Cropper',
    description: 'Crop images to specific dimensions',
    category: 'media',
    icon: 'crop-alt',
    params: {
      x: { type: 'integer', required: true, min: 0 },
      y: { type: 'integer', required: true, min: 0 },
      width: { type: 'integer', required: true, min: 1 },
      height: { type: 'integer', required: true, min: 1 }
    },
    keywords: ['image', 'crop', 'cut', 'trim']
  },
  {
    id: 'image_color_extractor',
    name: 'Color Extractor',
    description: 'Extract color palette from images',
    category: 'media',
    icon: 'eye-dropper',
    params: {
      count: { type: 'integer', required: false, default: 6, min: 3, max: 12 }
    },
    keywords: ['image', 'color', 'palette', 'extract', 'picker']
  },
  {
    id: 'svg_placeholder_generator',
    name: 'SVG Placeholder Generator',
    description: 'Generate SVG placeholder images',
    category: 'media',
    icon: 'image',
    params: {
      width: { type: 'integer', required: true, default: 300 },
      height: { type: 'integer', required: false, default: 200 }
    },
    keywords: ['svg', 'placeholder', 'image', 'generate']
  }
];

// ================== CALCULATOR TOOLS (5 tools) ==================
export const CALCULATOR_TOOLS: Tool[] = [
  {
    id: 'age_calculator',
    name: 'Age Calculator',
    description: 'Calculate exact age from birth date',
    category: 'math',
    icon: 'birthday-cake',
    params: {
      birth_date: { type: 'string', required: true, placeholder: 'YYYY-MM-DD' }
    },
    keywords: ['age', 'calculator', 'birth', 'date', 'years']
  },
  {
    id: 'bmi_calculator',
    name: 'BMI Calculator',
    description: 'Calculate Body Mass Index',
    category: 'math',
    icon: 'weight',
    params: {
      weight: { type: 'number', required: true, placeholder: 'Weight in kg' },
      height: { type: 'number', required: true, placeholder: 'Height in cm' }
    },
    keywords: ['bmi', 'body', 'mass', 'index', 'health', 'weight']
  },
  {
    id: 'loan_emi_calculator',
    name: 'Loan EMI Calculator',
    description: 'Calculate monthly EMI for loans',
    category: 'math',
    icon: 'money-bill-wave',
    params: {
      principal: { type: 'number', required: true, placeholder: 'Loan amount' },
      interest_rate: { type: 'number', required: true, placeholder: 'Annual interest rate %' },
      tenure: { type: 'integer', required: true, placeholder: 'Loan tenure in months' }
    },
    keywords: ['loan', 'emi', 'mortgage', 'calculator', 'finance']
  },
  {
    id: 'gst_calculator',
    name: 'GST/VAT Calculator',
    description: 'Calculate GST/VAT inclusive and exclusive amounts',
    category: 'math',
    icon: 'percent',
    params: {
      amount: { type: 'number', required: true, placeholder: 'Amount' },
      gst_rate: { type: 'number', required: true, default: 18, placeholder: 'GST rate %' }
    },
    keywords: ['gst', 'vat', 'tax', 'calculator', 'inclusive', 'exclusive']
  },
  {
    id: 'number_to_words',
    name: 'Number to Words',
    description: 'Convert numbers to written words',
    category: 'math',
    icon: 'spell-check',
    params: {
      number: { type: 'string', required: true, placeholder: 'Enter number' },
      language: { type: 'select', required: false, default: 'en', enum: ['en', 'zh', 'es', 'fr', 'de'] }
    },
    keywords: ['number', 'words', 'convert', 'spell', 'currency']
  }
];

// ================== PDF TOOLS (5 tools) ==================
export const PDF_TOOLS: Tool[] = [
  {
    id: 'pdf_split',
    name: 'PDF Splitter',
    description: 'Split PDF into multiple files',
    category: 'media',
    icon: 'file-pdf',
    params: {
      method: { type: 'select', required: true, enum: ['range', 'every', 'extract'] }
    },
    keywords: ['pdf', 'split', 'extract', 'pages']
  },
  {
    id: 'pdf_merge',
    name: 'PDF Merger',
    description: 'Merge multiple PDFs into one',
    category: 'media',
    icon: 'object-group',
    params: {},
    keywords: ['pdf', 'merge', 'combine', 'join']
  },
  {
    id: 'pdf_compress',
    name: 'PDF Compressor',
    description: 'Reduce PDF file size',
    category: 'media',
    icon: 'compress-arrows-alt',
    params: {
      level: { type: 'select', required: false, default: 'medium', enum: ['low', 'medium', 'high'] }
    },
    keywords: ['pdf', 'compress', 'reduce', 'size', 'optimize']
  },
  {
    id: 'pdf_rotate',
    name: 'PDF Rotate',
    description: 'Rotate PDF pages',
    category: 'media',
    icon: 'sync-alt',
    params: {
      rotation: { type: 'select', required: true, default: 90, enum: [90, 180, 270] }
    },
    keywords: ['pdf', 'rotate', 'pages', 'orientation']
  },
  {
    id: 'pdf_password',
    name: 'PDF Password',
    description: 'Add or remove PDF password protection',
    category: 'media',
    icon: 'lock',
    params: {
      action: { type: 'select', required: true, enum: ['add', 'remove'] }
    },
    keywords: ['pdf', 'password', 'protect', 'encrypt', 'security']
  }
];

// ================== DATA TOOLS (4 tools) ==================
export const DATA_TOOLS: Tool[] = [
  {
    id: 'phone_parser_and_formatter',
    name: 'Phone Parser and Formatter',
    description: 'Parse, validate and format phone numbers',
    category: 'data',
    icon: 'phone',
    params: {
      phone: { type: 'string', required: true, placeholder: 'Enter phone number' },
      country_code: { type: 'string', required: false, default: 'US', placeholder: 'Country code (e.g., US)' }
    },
    keywords: ['phone', 'parse', 'format', 'validate', 'international']
  },
  {
    id: 'iban_validator_and_parser',
    name: 'IBAN Validator and Parser',
    description: 'Validate and parse IBAN bank account numbers',
    category: 'data',
    icon: 'university',
    params: {
      iban: { type: 'string', required: true, placeholder: 'Enter IBAN number' }
    },
    keywords: ['iban', 'validate', 'parse', 'bank', 'account']
  },
  {
    id: 'safelink_decoder',
    name: 'Safelink Decoder',
    description: 'Decode safe links and redirects',
    category: 'data',
    icon: 'external-link-alt',
    params: {
      url: { type: 'url', required: true, placeholder: 'Enter safelink URL' }
    },
    keywords: ['safelink', 'decode', 'redirect', 'url', 'unwrap']
  },
  {
    id: 'numeronym_generator',
    name: 'Numeronym Generator',
    description: 'Generate numeronyms (like i18n for internationalization)',
    category: 'data',
    icon: 'compress',
    params: {
      text: { type: 'string', required: true, placeholder: 'Enter text to convert' }
    },
    keywords: ['numeronym', 'abbreviation', 'i18n', 'shorten']
  }
];

// Export all tools combined
export const ALL_TOOLS: Tool[] = [
  ...CRYPTO_TOOLS,      // 15 tools
  ...CONVERTER_TOOLS,   // 25 tools
  ...WEB_TOOLS,         // 18 tools
  ...TEXT_TOOLS,        // 10 tools
  ...MATH_TOOLS,        // 3 tools
  ...NETWORK_TOOLS,     // 6 tools
  ...MEDIA_TOOLS,       // 4 tools
  ...IMAGE_TOOLS,       // 7 tools
  ...CALCULATOR_TOOLS,  // 5 tools
  ...PDF_TOOLS,         // 5 tools
  ...DEVELOPMENT_TOOLS, // 7 tools
  ...MEASUREMENT_TOOLS, // 2 tools
  ...DATA_TOOLS         // 4 tools
];

// Export tools by category for easy access
export const TOOLS_BY_CATEGORY = {
  crypto: CRYPTO_TOOLS,
  converter: CONVERTER_TOOLS,
  web: WEB_TOOLS,
  text: TEXT_TOOLS,
  math: [...MATH_TOOLS, ...CALCULATOR_TOOLS],
  network: NETWORK_TOOLS,
  media: [...MEDIA_TOOLS, ...IMAGE_TOOLS, ...PDF_TOOLS],
  development: DEVELOPMENT_TOOLS,
  measurement: MEASUREMENT_TOOLS,
  data: DATA_TOOLS
};

// Tool lookup helpers
export const getToolById = (id: string): Tool | undefined => {
  return ALL_TOOLS.find(tool => tool.id === id);
};

export const getToolsByCategory = (category: ToolCategory): Tool[] => {
  return TOOLS_BY_CATEGORY[category] || [];
};

export const searchTools = (query: string): Tool[] => {
  const lowerQuery = query.toLowerCase();
  return ALL_TOOLS.filter(tool =>
    tool.name.toLowerCase().includes(lowerQuery) ||
    tool.description.toLowerCase().includes(lowerQuery) ||
    tool.keywords.some(k => k.toLowerCase().includes(lowerQuery))
  );
};

export const getRandomTools = (count: number): Tool[] => {
  const shuffled = [...ALL_TOOLS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};
