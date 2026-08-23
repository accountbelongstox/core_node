/** Core IT tool definitions. */

import type { ToolDefinition } from '@/apps/laravel-manager/types';



/**
 * IT Developer Tools Configuration
 */
export const IT_TOOLS: Record<string, ToolDefinition> = {
  // Hash & Crypto Tools
  hashGenerator: {
    id: 'hashGenerator',
    name: 'Hash Generator',
    category: 'Crypto & Security',
    icon: 'Hash',
    description: 'Generate hash using various algorithms (MD5, SHA-1, SHA-256, etc.)',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.hash',
    inputSchema: {
      required: ['algorithm', 'text'],
      properties: {
        algorithm: { type: 'string' },
        text: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        hash: { type: 'string' },
        algorithm: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  uuidGenerator: {
    id: 'uuidGenerator',
    name: 'UUID Generator',
    category: 'Crypto & Security',
    icon: 'Key',
    description: 'Generate UUID (v1, v4, v5) and ULID',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.generateUuid',
    inputSchema: {
      required: [],
      properties: {
        version: { type: 'number', enum: [1, 4, 5] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        uuid: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  base64Converter: {
    id: 'base64Converter',
    name: 'Base64 Encoder/Decoder',
    category: 'Converters',
    icon: 'Code',
    description: 'Encode and decode Base64 strings',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.encode',
    inputSchema: {
      required: ['type', 'text'],
      properties: {
        type: { type: 'string', enum: ['base64'] },
        text: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        output: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  jsonFormatter: {
    id: 'jsonFormatter',
    name: 'JSON Formatter',
    category: 'Web Development',
    icon: 'FileCode',
    description: 'Prettify, minify, and validate JSON',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.jsonPrettify',
    inputSchema: {
      required: ['json'],
      properties: {
        json: { type: 'string', minLength: 1 },
        indent: { type: 'number', min: 2, max: 8 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        formatted: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  colorConverter: {
    id: 'colorConverter',
    name: 'Color Converter',
    category: 'Converters',
    icon: 'Palette',
    description: 'Convert colors between HEX, RGB, HSL, and more',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.convertColor',
    inputSchema: {
      required: ['color', 'from', 'to'],
      properties: {
        color: { type: 'string', minLength: 1 },
        from: { type: 'string', enum: ['hex', 'rgb', 'hsl', 'hsv'] },
        to: { type: 'string', enum: ['hex', 'rgb', 'hsl', 'hsv'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        color: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  qrCodeGenerator: {
    id: 'qrCodeGenerator',
    name: 'QR Code Generator',
    category: 'Web Development',
    icon: 'Code',
    description: 'Generate QR codes from text or URLs',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.generateQrCode',
    inputSchema: {
      required: ['text'],
      properties: {
        text: { type: 'string', minLength: 1 },
        size: { type: 'number', min: 100, max: 1000 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        qr_code: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  ipCalculator: {
    id: 'ipCalculator',
    name: 'IP Subnet Calculator',
    category: 'Network Tools',
    icon: 'Globe',
    description: 'Calculate IP subnets and CIDR ranges',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.ipv4Subnet',
    inputSchema: {
      required: ['ip', 'cidr'],
      properties: {
        ip: { type: 'string', pattern: '^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$' },
        cidr: { type: 'number', min: 0, max: 32 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        network: { type: 'string' },
        broadcast: { type: 'string' },
        first_host: { type: 'string' },
        last_host: { type: 'string' },
        total_hosts: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  regexTester: {
    id: 'regexTester',
    name: 'Regex Tester',
    category: 'Text Processing',
    icon: 'Code',
    description: 'Test and validate regular expressions',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.regexTest',
    inputSchema: {
      required: ['text', 'pattern'],
      properties: {
        text: { type: 'string', minLength: 1 },
        pattern: { type: 'string', minLength: 1 },
        flags: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        matches: { type: 'array' },
        is_match: { type: 'boolean' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  bcryptGenerator: {
    id: 'bcryptGenerator',
    name: 'Bcrypt Hash Generator',
    category: 'Crypto & Security',
    icon: 'Lock',
    description: 'Generate and verify Bcrypt hashes',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.bcryptHash',
    inputSchema: {
      required: ['password'],
      properties: {
        password: { type: 'string', minLength: 1 },
        rounds: { type: 'number', min: 4, max: 12 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        hash: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  // NOTE: `textStatistics` is defined canonically in tools.config.missing.ts
  // (richer schema with readingTime). The duplicate that lived here was removed
  // during the registry dedupe so each tool id resolves to a single definition.

  // ========== Crypto & Security Tools (14 new) ==========

  ulidGenerator: {
    id: 'ulidGenerator',
    name: 'ULID Generator',
    category: 'Crypto & Security',
    icon: 'Key',
    description: 'Generate Universally Unique Lexicographically Sortable Identifiers',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.generateUlid',
    inputSchema: {
      required: [],
      properties: {}
    },
    outputSchema: {
      type: 'object',
      properties: {
        ulid: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  // NOTE: `tokenGenerator` is defined canonically in tools.config.missing.ts
  // (richer schema with length + token type). The duplicate that lived here
  // was removed during the registry dedupe.

  hmacGenerator: {
    id: 'hmacGenerator',
    name: 'HMAC Generator',
    category: 'Crypto & Security',
    icon: 'Hash',
    description: 'Generate HMAC with various algorithms',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.hmac',
    inputSchema: {
      required: ['algorithm', 'text', 'secret'],
      properties: {
        algorithm: { type: 'string', enum: ['sha256', 'sha512'] },
        text: { type: 'string', minLength: 1 },
        secret: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        hmac: { type: 'string' },
        algorithm: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  rsaKeyGenerator: {
    id: 'rsaKeyGenerator',
    name: 'RSA Key Pair Generator',
    category: 'Crypto & Security',
    icon: 'Lock',
    description: 'Generate RSA public/private key pairs',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.generateRsaKeyPair',
    inputSchema: {
      required: [],
      properties: {
        keySize: { type: 'number', enum: [2048, 4096] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        public_key: { type: 'string' },
        private_key: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  bip39Generator: {
    id: 'bip39Generator',
    name: 'BIP39 Mnemonic Generator',
    category: 'Crypto & Security',
    icon: 'Key',
    description: 'Generate BIP39 mnemonic phrases for crypto wallets',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.generateBip39',
    inputSchema: {
      required: [],
      properties: {
        strength: { type: 'number', enum: [128, 160, 192, 224, 256] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        mnemonic: { type: 'string' },
        words: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  otpGenerator: {
    id: 'otpGenerator',
    name: 'OTP Generator',
    category: 'Crypto & Security',
    icon: 'Lock',
    description: 'Generate Time-based One-Time Passwords (TOTP)',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.generateOtp',
    inputSchema: {
      required: [],
      properties: {
        secret: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        otp: { type: 'string' },
        expires_in: { type: 'number' }
      }
    },
    history: true,
    favorites: false,
    cache: false
  },

  otpVerifier: {
    id: 'otpVerifier',
    name: 'OTP Verifier',
    category: 'Crypto & Security',
    icon: 'Lock',
    description: 'Verify Time-based One-Time Passwords',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.verifyOtp',
    inputSchema: {
      required: ['secret', 'otp'],
      properties: {
        secret: { type: 'string', minLength: 1 },
        otp: { type: 'string', minLength: 6, maxLength: 6 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        message: { type: 'string' }
      }
    },
    history: true,
    favorites: false,
    cache: false
  },

  textEncryption: {
    id: 'textEncryption',
    name: 'Text Encryption',
    category: 'Crypto & Security',
    icon: 'Lock',
    description: 'Encrypt text using AES encryption',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.encrypt',
    inputSchema: {
      required: ['text', 'key'],
      properties: {
        text: { type: 'string', minLength: 1 },
        key: { type: 'string', minLength: 8 },
        algorithm: { type: 'string', enum: ['aes-256-cbc', 'aes-128-cbc'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        encrypted: { type: 'string' },
        iv: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  textDecryption: {
    id: 'textDecryption',
    name: 'Text Decryption',
    category: 'Crypto & Security',
    icon: 'Lock',
    description: 'Decrypt AES encrypted text',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.decrypt',
    inputSchema: {
      required: ['encrypted', 'key'],
      properties: {
        encrypted: { type: 'string', minLength: 1 },
        key: { type: 'string', minLength: 8 },
        algorithm: { type: 'string', enum: ['aes-256-cbc', 'aes-128-cbc'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        decrypted: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  passwordAnalyzer: {
    id: 'passwordAnalyzer',
    name: 'Password Strength Analyzer',
    category: 'Crypto & Security',
    icon: 'Lock',
    description: 'Analyze password strength and security',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.analyzePassword',
    inputSchema: {
      required: ['password'],
      properties: {
        password: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        strength: { type: 'string' },
        score: { type: 'number' },
        suggestions: { type: 'array' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  // NOTE: `basicAuthGenerator` is defined canonically in tools.config.missing.ts
  // (richer schema with field titles). The duplicate that lived here was
  // removed during the registry dedupe.

  bcryptVerifier: {
    id: 'bcryptVerifier',
    name: 'Bcrypt Hash Verifier',
    category: 'Crypto & Security',
    icon: 'Lock',
    description: 'Verify password against Bcrypt hash',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.bcryptVerify',
    inputSchema: {
      required: ['password', 'hash'],
      properties: {
        password: { type: 'string', minLength: 1 },
        hash: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        message: { type: 'string' }
      }
    },
    history: true,
    favorites: false,
    cache: false
  },

  hashTextTool: {
    id: 'hashTextTool',
    name: 'Text Hash (Crypto)',
    category: 'Crypto & Security',
    icon: 'Hash',
    description: 'Hash text with cryptographic algorithms',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.hashText',
    inputSchema: {
      required: ['text', 'algorithm'],
      properties: {
        text: { type: 'string', minLength: 1 },
        algorithm: { type: 'string', enum: ['md5', 'sha1', 'sha256', 'sha512'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        hash: { type: 'string' },
        algorithm: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  cryptoUuidGenerator: {
    id: 'cryptoUuidGenerator',
    name: 'Crypto UUID Generator',
    category: 'Crypto & Security',
    icon: 'Key',
    description: 'Generate cryptographically secure UUIDs',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.generateCryptoUuid',
    inputSchema: {
      required: [],
      properties: {
        version: { type: 'number', enum: [4] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        uuid: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  }
};


