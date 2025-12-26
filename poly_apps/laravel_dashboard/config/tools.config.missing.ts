import { ToolConfig } from '../core/types';

/**
 * Missing Tool Configurations (补充缺失的工具配置)
 *
 * 这些工具的后端API已存在，但之前未在前端配置
 * These tools have backend APIs but were not previously configured in frontend
 *
 * Total: 15 tools
 */

// ========== Crypto & Security (加密与安全) ==========

export const MISSING_CRYPTO_TOOLS: Record<string, ToolConfig> = {
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

// ========== Converters (转换器) ==========

export const MISSING_CONVERTER_TOOLS: Record<string, ToolConfig> = {
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

// ========== Web Development (Web开发) ==========

export const MISSING_WEB_TOOLS: Record<string, ToolConfig> = {
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

// ========== Math Tools (数学工具) ==========

export const MISSING_MATH_TOOLS: Record<string, ToolConfig> = {
  etaCalculator: {
    id: 'etaCalculator',
    name: 'ETA Calculator',
    category: 'Math Tools',
    icon: 'Clock',
    description: 'Calculate Estimated Time of Arrival based on progress',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.eta',
    inputSchema: {
      required: ['current', 'total', 'start_time'],
      properties: {
        current: {
          type: 'number',
          title: 'Current Progress',
          min: 0
        },
        total: {
          type: 'number',
          title: 'Total',
          min: 1
        },
        start_time: {
          type: 'number',
          title: 'Start Time (Unix timestamp)',
          min: 0
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        eta: { type: 'number', title: 'ETA (Unix timestamp)' },
        remaining_seconds: { type: 'number' },
        percentage: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  mathEvaluator: {
    id: 'mathEvaluator',
    name: 'Math Expression Evaluator',
    category: 'Math Tools',
    icon: 'Calculator',
    description: 'Evaluate mathematical expressions safely',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.evaluate',
    inputSchema: {
      required: ['expression'],
      properties: {
        expression: {
          type: 'string',
          title: 'Expression (e.g., 2 + 2 * 3)',
          minLength: 1
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        result: { type: 'number' },
        expression: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: true
  },

  percentageCalculatorV2: {
    id: 'percentageCalculatorV2',
    name: 'Percentage Calculator',
    category: 'Math Tools',
    icon: 'Percent',
    description: 'Calculate percentage of a value relative to total',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.percentage',
    inputSchema: {
      required: ['value', 'total'],
      properties: {
        value: {
          type: 'number',
          title: 'Value'
        },
        total: {
          type: 'number',
          title: 'Total',
          min: 0.01
        },
        decimal: {
          type: 'number',
          title: 'Decimal Places',
          default: 2,
          min: 0,
          max: 10
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        percentage: { type: 'number' },
        formatted: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: true
  }
};

// ========== Text Processing (文本处理) ==========

export const MISSING_TEXT_TOOLS: Record<string, ToolConfig> = {
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

// ========== Network Tools (网络工具) ==========

export const MISSING_NETWORK_TOOLS: Record<string, ToolConfig> = {
  ipv4Converter: {
    id: 'ipv4Converter',
    name: 'IPv4 Converter',
    category: 'Network Utilities',
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

  macAddressGenerator: {
    id: 'macAddressGenerator',
    name: 'MAC Address Generator',
    category: 'Network Utilities',
    icon: 'Wifi',
    description: 'Generate random MAC addresses with customizable format',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.macGenerate',
    inputSchema: {
      required: [],
      properties: {
        separator: {
          type: 'string',
          title: 'Separator',
          enum: [':', '-', '.', ''],
          default: ':'
        },
        case: {
          type: 'string',
          title: 'Case',
          enum: ['upper', 'lower'],
          default: 'upper'
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        mac: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  }
};

// ========== Export All Missing Tools ==========

export const ALL_MISSING_TOOLS: Record<string, ToolConfig> = {
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
