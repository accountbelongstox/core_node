import { ToolDefinition } from '../core/types';

/**
 * Missing Tool Configurations
 *
 * These tools have backend APIs but were not previously configured in frontend
 *
 * Total: 15 tools
 */

// ========== Crypto & Security ==========

export const MISSING_CRYPTO_TOOLS: Record<string, ToolDefinition> = {
  basicAuthGenerator: {
    id: 'basicAuthGenerator',
    name: 'Basic Auth Generator',
    category: 'Crypto & Security',
    icon: 'Lock',
    description: 'Generate Basic Authentication header from username and password',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.basicAuth',
    inputSchema: {
      required: ['username', 'password'],
      properties: {
        username: {
          type: 'string',
          title: 'Username',
          minLength: 1
        },
        password: {
          type: 'string',
          title: 'Password',
          minLength: 1
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        header: { type: 'string', title: 'Authorization Header' },
        encoded: { type: 'string', title: 'Encoded Credentials' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  tokenGenerator: {
    id: 'tokenGenerator',
    name: 'Token Generator',
    category: 'Crypto & Security',
    icon: 'Key',
    description: 'Generate random secure tokens for authentication or API keys',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.token',
    inputSchema: {
      required: [],
      properties: {
        length: {
          type: 'number',
          title: 'Token Length',
          default: 32,
          min: 16,
          max: 128
        },
        type: {
          type: 'string',
          title: 'Token Type',
          enum: ['alphanumeric', 'hex', 'base64', 'urlsafe'],
          default: 'alphanumeric'
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  uuidGeneratorV2: {
    id: 'uuidGeneratorV2',
    name: 'UUID Generator (Enhanced)',
    category: 'Crypto & Security',
    icon: 'Hash',
    description: 'Generate UUIDs with version selection (v1, v4, v5)',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.uuid',
    inputSchema: {
      required: [],
      properties: {
        version: {
          type: 'string',
          title: 'UUID Version',
          enum: ['v1', 'v4', 'v5'],
          default: 'v4'
        }
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

  hmacGeneratorV2: {
    id: 'hmacGeneratorV2',
    name: 'HMAC Generator (Enhanced)',
    category: 'Crypto & Security',
    icon: 'Shield',
    description: 'Generate HMAC with algorithm selection',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.generateHmac',
    inputSchema: {
      required: ['algorithm', 'key', 'message'],
      properties: {
        algorithm: {
          type: 'string',
          title: 'Algorithm',
          enum: ['sha256', 'sha512', 'sha1', 'md5'],
          default: 'sha256'
        },
        key: {
          type: 'string',
          title: 'Secret Key',
          minLength: 1
        },
        message: {
          type: 'string',
          title: 'Message',
          minLength: 1,
          multiline: true
        }
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
  }
};

// ========== Converters ==========

export const MISSING_CONVERTER_TOOLS: Record<string, ToolDefinition> = {
  base64EncoderV2: {
    id: 'base64EncoderV2',
    name: 'Base64 Encoder',
    category: 'Converters',
    icon: 'Code',
    description: 'Encode text to Base64 format',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.base64Encode',
    inputSchema: {
      required: ['text'],
      properties: {
        text: {
          type: 'string',
          title: 'Text to Encode',
          minLength: 1,
          multiline: true
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        encoded: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  base64DecoderV2: {
    id: 'base64DecoderV2',
    name: 'Base64 Decoder',
    category: 'Converters',
    icon: 'Code',
    description: 'Decode Base64 encoded text',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.base64Decode',
    inputSchema: {
      required: ['text'],
      properties: {
        text: {
          type: 'string',
          title: 'Base64 Text to Decode',
          minLength: 1,
          multiline: true
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        decoded: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  temperatureConverter: {
    id: 'temperatureConverter',
    name: 'Temperature Converter',
    category: 'Converters',
    icon: 'Thermometer',
    description: 'Convert between Celsius, Fahrenheit, and Kelvin',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.temperature',
    inputSchema: {
      required: ['value', 'from', 'to'],
      properties: {
        value: {
          type: 'number',
          title: 'Temperature Value'
        },
        from: {
          type: 'string',
          title: 'From Unit',
          enum: ['celsius', 'fahrenheit', 'kelvin'],
          default: 'celsius'
        },
        to: {
          type: 'string',
          title: 'To Unit',
          enum: ['celsius', 'fahrenheit', 'kelvin'],
          default: 'fahrenheit'
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: true
  }
};

// ========== Web Development ==========

export const MISSING_WEB_TOOLS: Record<string, ToolDefinition> = {
  jsonMinifier: {
    id: 'jsonMinifier',
    name: 'JSON Minifier',
    category: 'Web Development',
    icon: 'Minimize',
    description: 'Minify JSON by removing whitespace and formatting',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.jsonMinify',
    inputSchema: {
      required: ['json'],
      properties: {
        json: {
          type: 'string',
          title: 'JSON to Minify',
          minLength: 1,
          multiline: true
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        minified: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  mimeTypesLookup: {
    id: 'mimeTypesLookup',
    name: 'MIME Types Lookup',
    category: 'Web Development',
    icon: 'FileType',
    description: 'Lookup MIME type by file extension or vice versa',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.mimeTypes',
    inputSchema: {
      required: [],
      properties: {
        extension: {
          type: 'string',
          title: 'File Extension (e.g., .jpg)',
          minLength: 0
        },
        mimeType: {
          type: 'string',
          title: 'MIME Type (e.g., image/jpeg)',
          minLength: 0
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        extension: { type: 'string' },
        mimeType: { type: 'string' },
        description: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: true
  }
};

// ========== Math Tools ==========

// NOTE: `etaCalculator`, `mathEvaluator` and `percentageCalculator(V2)` are
// defined canonically in tools.config.extended.ts (MATH_TOOLS, with richer
// schemas). Their near-duplicates that lived here were removed during the
// registry dedupe, so MISSING_MATH_TOOLS is now empty.
export const MISSING_MATH_TOOLS: Record<string, ToolDefinition> = {};

// ========== Text Processing ==========

export const MISSING_TEXT_TOOLS: Record<string, ToolDefinition> = {
  textStatistics: {
    id: 'textStatistics',
    name: 'Text Statistics',
    category: 'Text Processing',
    icon: 'BarChart',
    description: 'Analyze text and get detailed statistics',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.statistics',
    inputSchema: {
      required: ['text'],
      properties: {
        text: {
          type: 'string',
          title: 'Text to Analyze',
          minLength: 1,
          multiline: true
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        characters: { type: 'number' },
        words: { type: 'number' },
        lines: { type: 'number' },
        paragraphs: { type: 'number' },
        readingTime: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  }
};

// ========== Network Tools ==========

export const MISSING_NETWORK_TOOLS: Record<string, ToolDefinition> = {
  ipv4Converter: {
    id: 'ipv4Converter',
    name: 'IPv4 Converter',
    category: 'Network Tools',
    icon: 'Network',
    description: 'Convert IPv4 address between different formats',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.ipv4Convert',
    inputSchema: {
      required: ['ip', 'format'],
      properties: {
        ip: {
          type: 'string',
          title: 'IPv4 Address',
          minLength: 7
        },
        format: {
          type: 'string',
          title: 'Output Format',
          enum: ['decimal', 'binary', 'hex', 'octal'],
          default: 'decimal'
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        original: { type: 'string' },
        converted: { type: 'string' },
        format: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: true
  },

  // NOTE: `macAddressGenerator` was a near-duplicate (by name) of `macGenerator`
  // in tools.config.extended.ts (NETWORK_TOOLS), which has the more complete
  // schema. It was removed during the registry dedupe.
};

// ========== Export All Missing Tools ==========

export const ALL_MISSING_TOOLS: Record<string, ToolDefinition> = {
  ...MISSING_CRYPTO_TOOLS,
  ...MISSING_CONVERTER_TOOLS,
  ...MISSING_WEB_TOOLS,
  ...MISSING_MATH_TOOLS,
  ...MISSING_TEXT_TOOLS,
  ...MISSING_NETWORK_TOOLS
};

// Export count for verification
export const MISSING_TOOLS_COUNT = Object.keys(ALL_MISSING_TOOLS).length;

console.log(`[tools.config.missing] Loaded ${MISSING_TOOLS_COUNT} missing tool configurations`);

