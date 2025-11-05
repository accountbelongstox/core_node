export interface ToolParam {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'file';
  required?: boolean;
  placeholder?: string;
  default?: any;
  min?: number;
  max?: number;
  rows?: number;
  options?: Array<{ value: string; label: string }>;
  description?: string;
}

export const TOOL_PARAMS: Record<string, ToolParam[]> = {
  // Crypto Tools
  hash_text: [
    { name: 'text', label: 'Text to hash', type: 'textarea', required: true, placeholder: 'Enter text...', rows: 4 },
    {
      name: 'algorithm',
      label: 'Algorithm',
      type: 'select',
      required: true,
      default: 'md5',
      options: [
        { value: 'md5', label: 'MD5' },
        { value: 'sha1', label: 'SHA-1' },
        { value: 'sha256', label: 'SHA-256' },
        { value: 'sha512', label: 'SHA-512' }
      ]
    }
  ],

  bcrypt: [
    { name: 'password', label: 'Password', type: 'text', required: true, placeholder: 'Enter password...' },
    { name: 'rounds', label: 'Salt Rounds', type: 'number', default: 10, min: 4, max: 31, description: 'Cost factor (4-31, default: 10)' }
  ],

  uuid_generator: [
    { name: 'count', label: 'Number of UUIDs', type: 'number', default: 1, min: 1, max: 100 },
    { name: 'uppercase', label: 'Uppercase', type: 'checkbox', default: false }
  ],

  token_generator: [
    { name: 'length', label: 'Token Length', type: 'number', required: true, default: 32, min: 8, max: 256 },
    {
      name: 'charset',
      label: 'Character Set',
      type: 'select',
      default: 'alphanumeric',
      options: [
        { value: 'alphanumeric', label: 'Alphanumeric (a-z, A-Z, 0-9)' },
        { value: 'alphabetic', label: 'Alphabetic (a-z, A-Z)' },
        { value: 'numeric', label: 'Numeric (0-9)' },
        { value: 'lowercase', label: 'Lowercase (a-z)' },
        { value: 'uppercase', label: 'Uppercase (A-Z)' },
        { value: 'hex', label: 'Hexadecimal (0-9, a-f)' }
      ]
    },
    { name: 'includeSymbols', label: 'Include Symbols (!@#$...)', type: 'checkbox', default: false },
    { name: 'count', label: 'Number of Tokens', type: 'number', default: 1, min: 1, max: 50 }
  ],

  ulid_generator: [
    { name: 'count', label: 'Number of ULIDs', type: 'number', default: 1, min: 1, max: 100 }
  ],

  bip39_generator: [
    {
      name: 'strength',
      label: 'Entropy Strength (bits)',
      type: 'select',
      default: '128',
      options: [
        { value: '128', label: '128 bits (12 words)' },
        { value: '160', label: '160 bits (15 words)' },
        { value: '192', label: '192 bits (18 words)' },
        { value: '224', label: '224 bits (21 words)' },
        { value: '256', label: '256 bits (24 words)' }
      ]
    },
    {
      name: 'language',
      label: 'Language',
      type: 'select',
      default: 'english',
      options: [
        { value: 'english', label: 'English' },
        { value: 'chinese_simplified', label: 'Chinese (Simplified)' },
        { value: 'chinese_traditional', label: 'Chinese (Traditional)' },
        { value: 'french', label: 'French' },
        { value: 'italian', label: 'Italian' },
        { value: 'japanese', label: 'Japanese' },
        { value: 'korean', label: 'Korean' },
        { value: 'spanish', label: 'Spanish' }
      ]
    }
  ],

  hmac_generator: [
    { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Enter message...', rows: 4 },
    { name: 'secret', label: 'Secret Key', type: 'text', required: true, placeholder: 'Enter secret key...' },
    {
      name: 'algorithm',
      label: 'Algorithm',
      type: 'select',
      default: 'sha256',
      options: [
        { value: 'sha256', label: 'SHA-256' },
        { value: 'sha512', label: 'SHA-512' },
        { value: 'sha1', label: 'SHA-1' },
        { value: 'md5', label: 'MD5' }
      ]
    }
  ],

  rsa_key_pair_generator: [
    {
      name: 'keySize',
      label: 'Key Size',
      type: 'select',
      default: '2048',
      options: [
        { value: '1024', label: '1024 bits' },
        { value: '2048', label: '2048 bits' },
        { value: '4096', label: '4096 bits' }
      ]
    },
    {
      name: 'format',
      label: 'Output Format',
      type: 'select',
      default: 'pem',
      options: [
        { value: 'pem', label: 'PEM' },
        { value: 'der', label: 'DER' }
      ]
    }
  ],

  // Converter Tools
  base64_string_converter: [
    { name: 'text', label: 'Text', type: 'textarea', required: true, placeholder: 'Enter text to encode...', rows: 6 }
  ],

  url_encoder: [
    { name: 'text', label: 'Text to encode', type: 'textarea', required: true, placeholder: 'Enter text...', rows: 6 }
  ],

  color_converter: [
    { name: 'color', label: 'Color Value', type: 'text', required: true, placeholder: '#FF5733 or rgb(255, 87, 51)...' },
    {
      name: 'outputFormat',
      label: 'Output Format',
      type: 'select',
      default: 'all',
      options: [
        { value: 'all', label: 'All Formats' },
        { value: 'hex', label: 'HEX' },
        { value: 'rgb', label: 'RGB' },
        { value: 'hsl', label: 'HSL' },
        { value: 'hsv', label: 'HSV' }
      ]
    }
  ],

  case_converter: [
    { name: 'text', label: 'Text to convert', type: 'textarea', required: true, placeholder: 'Enter text...', rows: 4 },
    {
      name: 'targetCase',
      label: 'Target Case',
      type: 'select',
      required: true,
      options: [
        { value: 'camelCase', label: 'camelCase' },
        { value: 'PascalCase', label: 'PascalCase' },
        { value: 'snake_case', label: 'snake_case' },
        { value: 'kebab-case', label: 'kebab-case' },
        { value: 'UPPER_CASE', label: 'UPPER_CASE' },
        { value: 'lower case', label: 'lower case' }
      ]
    }
  ],

  slugify_string: [
    { name: 'text', label: 'Text to convert', type: 'textarea', required: true, placeholder: 'Hello World! This is a Test.', rows: 3 },
    { name: 'separator', label: 'Separator', type: 'text', default: '-', placeholder: '-' },
    { name: 'lowercase', label: 'Lowercase output', type: 'checkbox', default: true }
  ],

  temperature_converter: [
    { name: 'value', label: 'Temperature Value', type: 'number', required: true, default: 0 },
    {
      name: 'from',
      label: 'From Unit',
      type: 'select',
      default: 'celsius',
      options: [
        { value: 'celsius', label: 'Celsius (°C)' },
        { value: 'fahrenheit', label: 'Fahrenheit (°F)' },
        { value: 'kelvin', label: 'Kelvin (K)' }
      ]
    }
  ],

  json_to_yaml_converter: [
    { name: 'json', label: 'JSON Input', type: 'textarea', required: true, placeholder: '{"name":"John","age":30}', rows: 8 }
  ],

  yaml_to_json_converter: [
    { name: 'yaml', label: 'YAML Input', type: 'textarea', required: true, placeholder: 'name: John\nage: 30', rows: 8 }
  ],

  // Web Dev Tools
  json_prettify: [
    { name: 'json', label: 'JSON to prettify', type: 'textarea', required: true, placeholder: '{"key":"value"}', rows: 8 },
    { name: 'indent', label: 'Indent Spaces', type: 'number', default: 2, min: 1, max: 8 }
  ],

  json_minify: [
    { name: 'json', label: 'JSON to minify', type: 'textarea', required: true, placeholder: 'Enter JSON...', rows: 8 }
  ],

  json_diff: [
    { name: 'json1', label: 'JSON 1', type: 'textarea', required: true, placeholder: 'Enter first JSON...', rows: 6 },
    { name: 'json2', label: 'JSON 2', type: 'textarea', required: true, placeholder: 'Enter second JSON...', rows: 6 }
  ],

  url_parser: [
    { name: 'url', label: 'URL to parse', type: 'text', required: true, placeholder: 'https://example.com/path?query=value' }
  ],

  jwt_parser: [
    { name: 'token', label: 'JWT Token', type: 'textarea', required: true, placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', rows: 6 }
  ],

  qr_code_generator: [
    { name: 'text', label: 'Text or URL', type: 'textarea', required: true, placeholder: 'Enter text or URL...', rows: 3 },
    {
      name: 'size',
      label: 'QR Code Size',
      type: 'select',
      default: '200',
      options: [
        { value: '100', label: '100x100' },
        { value: '200', label: '200x200' },
        { value: '300', label: '300x300' },
        { value: '400', label: '400x400' }
      ]
    }
  ],

  // Text Tools
  text_statistics: [
    { name: 'text', label: 'Text to analyze', type: 'textarea', required: true, placeholder: 'Enter text...', rows: 8 }
  ],

  regex_tester: [
    { name: 'pattern', label: 'Regular Expression', type: 'text', required: true, placeholder: '\\d+' },
    { name: 'text', label: 'Test Text', type: 'textarea', required: true, placeholder: 'Enter text to test...', rows: 6 },
    { name: 'flags', label: 'Flags', type: 'text', placeholder: 'gi', description: 'e.g., g (global), i (case-insensitive), m (multiline)' }
  ],

  lorem_ipsum_generator: [
    {
      name: 'type',
      label: 'Type',
      type: 'select',
      default: 'paragraphs',
      options: [
        { value: 'words', label: 'Words' },
        { value: 'sentences', label: 'Sentences' },
        { value: 'paragraphs', label: 'Paragraphs' }
      ]
    },
    { name: 'count', label: 'Count', type: 'number', default: 3, min: 1, max: 100 }
  ],

  text_diff: [
    { name: 'text1', label: 'Text 1', type: 'textarea', required: true, placeholder: 'Enter first text...', rows: 8 },
    { name: 'text2', label: 'Text 2', type: 'textarea', required: true, placeholder: 'Enter second text...', rows: 8 }
  ],

  // Math Tools
  expression_evaluate: [
    { name: 'expression', label: 'Mathematical Expression', type: 'text', required: true, placeholder: '2 + 2 * 3', description: 'Supports +, -, *, /, ^, sqrt(), sin(), cos(), etc.' }
  ],

  // Network Tools
  ipv4_convert: [
    { name: 'ip', label: 'IPv4 Address', type: 'text', required: true, placeholder: '192.168.1.1' },
    {
      name: 'format',
      label: 'Convert To',
      type: 'select',
      required: true,
      options: [
        { value: 'decimal', label: 'Decimal' },
        { value: 'binary', label: 'Binary' },
        { value: 'hex', label: 'Hexadecimal' }
      ]
    }
  ],

  // Additional Crypto Tools (Next 8)
  encryption: [
    { name: 'text', label: 'Text to encrypt/decrypt', type: 'textarea', required: true, placeholder: 'Enter text...', rows: 4 },
    { name: 'key', label: 'Encryption Key', type: 'text', required: true, placeholder: 'Enter secret key...' },
    { name: 'iv', label: 'Initialization Vector (optional)', type: 'text', placeholder: 'Enter IV if required (e.g., 16 bytes for AES-CBC)' },
    {
      name: 'algorithm',
      label: 'Algorithm',
      type: 'select',
      default: 'aes-256-cbc',
      options: [
        { value: 'aes-256-cbc', label: 'AES-256-CBC' },
        { value: 'aes-192-cbc', label: 'AES-192-CBC' },
        { value: 'aes-128-cbc', label: 'AES-128-CBC' }
      ]
    },
    {
      name: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'encrypt',
      options: [
        { value: 'encrypt', label: 'Encrypt' },
        { value: 'decrypt', label: 'Decrypt' }
      ]
    }
  ],

  password_strength_analyser: [
    { name: 'password', label: 'Password to analyze', type: 'text', required: true, placeholder: 'Enter password...' }
  ],

  otp_code_generator_and_validator: [
    { name: 'secret', label: 'Secret Key (Base32)', type: 'text', required: true, placeholder: 'Enter Base32 secret, e.g., JBSWY3DPEHPK3PXP' },
    {
      name: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'generate',
      options: [
        { value: 'generate', label: 'Generate OTP' },
        { value: 'verify', label: 'Verify OTP' }
      ]
    },
    {
      name: 'type',
      label: 'OTP Type',
      type: 'select',
      default: 'totp',
      options: [
        { value: 'totp', label: 'TOTP (Time-based)' },
        { value: 'hotp', label: 'HOTP (Counter-based)' }
      ]
    },
    { name: 'digits', label: 'Digits', type: 'number', default: 6, min: 4, max: 8 },
    { name: 'period', label: 'Period (seconds)', type: 'number', default: 30, min: 15, max: 300 },
    { name: 'counter', label: 'Counter (HOTP only)', type: 'number', default: 0, min: 0 },
    { name: 'code', label: 'OTP Code (Verify mode)', type: 'text', placeholder: '123456' }
  ],

  basic_auth_generator: [
    { name: 'username', label: 'Username', type: 'text', required: true, placeholder: 'Enter username...' },
    { name: 'password', label: 'Password', type: 'text', required: true, placeholder: 'Enter password...' }
  ],

  random_port_generator: [
    {
      name: 'range',
      label: 'Port Range',
      type: 'select',
      default: 'dynamic',
      options: [
        { value: 'dynamic', label: 'Dynamic Ports (49152-65535)' },
        { value: 'registered', label: 'Registered Ports (1024-49151)' },
        { value: 'all', label: 'All Non-System Ports (1024-65535)' }
      ]
    },
    { name: 'count', label: 'Number of Ports', type: 'number', default: 5, min: 1, max: 20 }
  ],

  numeronym_generator: [
    { name: 'text', label: 'Text to convert', type: 'text', required: true, placeholder: 'internationalization' }
  ],

  // Converter Tools (Next batch)
  base64_file_converter: [
    { name: 'file', label: 'File to convert', type: 'file', required: true },
    {
      name: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'encode',
      options: [
        { value: 'encode', label: 'Encode to Base64' },
        { value: 'decode', label: 'Decode from Base64' }
      ]
    }
  ],

  yaml_to_json_converter: [
    { name: 'yaml', label: 'YAML to convert', type: 'textarea', required: true, placeholder: 'Enter YAML...', rows: 8 }
  ],

  json_to_yaml_converter: [
    { name: 'json', label: 'JSON to convert', type: 'textarea', required: true, placeholder: 'Enter JSON...', rows: 8 }
  ],

  xml_to_json_converter: [
    { name: 'xml', label: 'XML to convert', type: 'textarea', required: true, placeholder: 'Enter XML...', rows: 8 }
  ],

  json_to_xml_converter: [
    { name: 'json', label: 'JSON to convert', type: 'textarea', required: true, placeholder: 'Enter JSON...', rows: 8 }
  ],

  markdown_to_html_converter: [
    { name: 'markdown', label: 'Markdown to convert', type: 'textarea', required: true, placeholder: '# Heading\n\nParagraph...', rows: 8 }
  ],

  html_entities: [
    { name: 'text', label: 'Text', type: 'textarea', required: true, placeholder: 'Enter text...', rows: 4 },
    {
      name: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'encode',
      options: [
        { value: 'encode', label: 'Encode' },
        { value: 'decode', label: 'Decode' }
      ]
    }
  ],

  sql_prettify: [
    { name: 'sql', label: 'SQL to format', type: 'textarea', required: true, placeholder: 'SELECT * FROM users WHERE id=1', rows: 8 }
  ]
};
