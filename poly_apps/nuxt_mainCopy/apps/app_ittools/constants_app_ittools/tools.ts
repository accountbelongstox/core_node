// IT Tools Constants - Tool Definitions
// Centralized tool metadata and configuration

export type ToolCategory = 'crypto' | 'converter' | 'web' | 'text' | 'math' | 'network' | 'media';

export interface ToolParam {
  type: 'string' | 'number' | 'boolean' | 'integer' | 'email' | 'url';
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
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params: Record<string, ToolParam>;
  keywords: string[];
  tags?: string[];
  examples?: {
    input: Record<string, any>;
    output: any;
  }[];
  documentation?: string;
}

// Tool definitions by category
export const CRYPTO_TOOLS: Tool[] = [
  {
    id: 'hash_text',
    name: 'Hash Text',
    description: 'Generate MD5, SHA1, SHA256, SHA512 hashes',
    category: 'crypto',
    icon: '<i class="fas fa-hashtag"></i>',
    endpoint: '/api/ittools/crypto/hash',
    method: 'POST',
    params: {
      text: {
        type: 'string',
        required: true,
        placeholder: 'Enter text to hash',
        description: 'Text to generate hash from'
      },
      algorithm: {
        type: 'string',
        required: true,
        enum: ['md5', 'sha1', 'sha256', 'sha512'],
        description: 'Hash algorithm'
      }
    },
    keywords: ['hash', 'md5', 'sha256', 'checksum', 'encryption'],
    tags: ['security', 'cryptography']
  },
  {
    id: 'uuid_generator',
    name: 'UUID Generator',
    description: 'Generate v4 UUIDs',
    category: 'crypto',
    icon: '<i class="fas fa-fingerprint"></i>',
    endpoint: '/api/ittools/crypto/uuid/generate',
    method: 'POST',
    params: {
      count: {
        type: 'integer',
        required: false,
        default: 1,
        min: 1,
        max: 100,
        description: 'Number of UUIDs to generate'
      },
      uppercase: {
        type: 'boolean',
        required: false,
        default: false,
        description: 'Generate uppercase UUIDs'
      }
    },
    keywords: ['uuid', 'guid', 'unique', 'identifier'],
    tags: ['generation', 'unique-id']
  },
  {
    id: 'token_generator',
    name: 'Token Generator',
    description: 'Generate random tokens with custom length and charset',
    category: 'crypto',
    icon: '<i class="fas fa-key"></i>',
    endpoint: '/api/ittools/crypto/token/generate',
    method: 'POST',
    params: {
      length: {
        type: 'integer',
        required: false,
        default: 32,
        min: 1,
        max: 256,
        description: 'Token length'
      },
      charset: {
        type: 'string',
        required: false,
        default: 'alphanumeric',
        enum: ['alphanumeric', 'numeric', 'alphabetic', 'special'],
        description: 'Character set to use'
      }
    },
    keywords: ['token', 'random', 'generate', 'string'],
    tags: ['generation', 'security']
  }
];

export const CONVERTER_TOOLS: Tool[] = [
  {
    id: 'base64_encode',
    name: 'Base64 Encode',
    description: 'Encode text to Base64',
    category: 'converter',
    icon: '<i class="fas fa-code"></i>',
    endpoint: '/api/ittools/converter/base64/encode',
    method: 'POST',
    params: {
      text: {
        type: 'string',
        required: true,
        placeholder: 'Enter text to encode',
        description: 'Text to encode to Base64'
      }
    },
    keywords: ['base64', 'encode', 'encoding', 'conversion'],
    tags: ['encoding', 'conversion']
  },
  {
    id: 'base64_decode',
    name: 'Base64 Decode',
    description: 'Decode Base64 to text',
    category: 'converter',
    icon: '<i class="fas fa-code"></i>',
    endpoint: '/api/ittools/converter/base64/decode',
    method: 'POST',
    params: {
      text: {
        type: 'string',
        required: true,
        placeholder: 'Enter Base64 to decode',
        description: 'Base64 string to decode'
      }
    },
    keywords: ['base64', 'decode', 'decoding', 'conversion'],
    tags: ['decoding', 'conversion']
  },
  {
    id: 'url_encode',
    name: 'URL Encode',
    description: 'Encode text for URL',
    category: 'converter',
    icon: '<i class="fas fa-link"></i>',
    endpoint: '/api/ittools/converter/url/encode',
    method: 'POST',
    params: {
      text: {
        type: 'string',
        required: true,
        placeholder: 'Enter text to URL encode',
        description: 'Text to encode'
      }
    },
    keywords: ['url', 'encode', 'percent-encoding'],
    tags: ['url', 'encoding']
  },
  {
    id: 'url_decode',
    name: 'URL Decode',
    description: 'Decode URL encoded text',
    category: 'converter',
    icon: '<i class="fas fa-link"></i>',
    endpoint: '/api/ittools/converter/url/decode',
    method: 'POST',
    params: {
      text: {
        type: 'string',
        required: true,
        placeholder: 'Enter URL encoded text',
        description: 'URL encoded string'
      }
    },
    keywords: ['url', 'decode', 'percent-decoding'],
    tags: ['url', 'decoding']
  }
];

export const WEB_TOOLS: Tool[] = [
  {
    id: 'json_prettify',
    name: 'JSON Prettify',
    description: 'Format and prettify JSON',
    category: 'web',
    icon: '<i class="fas fa-align-left"></i>',
    endpoint: '/api/ittools/web/json/prettify',
    method: 'POST',
    params: {
      json: {
        type: 'string',
        required: true,
        placeholder: 'Enter JSON to format',
        description: 'JSON string to format'
      },
      indent: {
        type: 'integer',
        required: false,
        default: 2,
        min: 1,
        max: 8,
        description: 'Indentation spaces'
      }
    },
    keywords: ['json', 'format', 'prettify', 'indent'],
    tags: ['json', 'formatting']
  },
  {
    id: 'json_minify',
    name: 'JSON Minify',
    description: 'Minify JSON by removing whitespace',
    category: 'web',
    icon: '<i class="fas fa-compress"></i>',
    endpoint: '/api/ittools/web/json/minify',
    method: 'POST',
    params: {
      json: {
        type: 'string',
        required: true,
        placeholder: 'Enter JSON to minify',
        description: 'JSON string to minify'
      }
    },
    keywords: ['json', 'minify', 'compress', 'reduce'],
    tags: ['json', 'compression']
  }
];

export const TEXT_TOOLS: Tool[] = [
  {
    id: 'text_statistics',
    name: 'Text Statistics',
    description: 'Analyze text for word count, character count, etc.',
    category: 'text',
    icon: '<i class="fas fa-chart-bar"></i>',
    endpoint: '/api/ittools/text/statistics',
    method: 'POST',
    params: {
      text: {
        type: 'string',
        required: true,
        placeholder: 'Enter text to analyze',
        description: 'Text to analyze'
      }
    },
    keywords: ['statistics', 'count', 'analysis', 'text'],
    tags: ['analysis', 'text']
  },
  {
    id: 'regex_test',
    name: 'Regex Tester',
    description: 'Test regular expressions',
    category: 'text',
    icon: '<i class="fas fa-sliders-h"></i>',
    endpoint: '/api/ittools/text/regex/test',
    method: 'POST',
    params: {
      pattern: {
        type: 'string',
        required: true,
        placeholder: 'Enter regex pattern',
        description: 'Regular expression pattern'
      },
      text: {
        type: 'string',
        required: true,
        placeholder: 'Enter text to test',
        description: 'Text to test against'
      },
      flags: {
        type: 'string',
        required: false,
        default: 'g',
        description: 'Regex flags (g, i, m, s, u, y)'
      }
    },
    keywords: ['regex', 'pattern', 'regular-expression', 'match'],
    tags: ['regex', 'pattern-matching']
  }
];

export const MATH_TOOLS: Tool[] = [
  {
    id: 'expression_evaluate',
    name: 'Expression Evaluator',
    description: 'Evaluate mathematical expressions',
    category: 'math',
    icon: '<i class="fas fa-calculator"></i>',
    endpoint: '/api/ittools/math/evaluate',
    method: 'POST',
    params: {
      expression: {
        type: 'string',
        required: true,
        placeholder: 'e.g., 2 + 2 * 5',
        description: 'Mathematical expression to evaluate'
      }
    },
    keywords: ['math', 'calculator', 'evaluate', 'expression'],
    tags: ['math', 'calculation']
  }
];

export const NETWORK_TOOLS: Tool[] = [
  {
    id: 'ipv4_convert',
    name: 'IPv4 Converter',
    description: 'Convert IPv4 address formats',
    category: 'network',
    icon: '<i class="fas fa-network-wired"></i>',
    endpoint: '/api/ittools/network/ipv4/convert',
    method: 'POST',
    params: {
      ip: {
        type: 'string',
        required: true,
        placeholder: 'e.g., 192.168.1.1',
        description: 'IPv4 address'
      },
      format: {
        type: 'string',
        required: true,
        enum: ['decimal', 'binary', 'hex'],
        description: 'Output format'
      }
    },
    keywords: ['ipv4', 'ip', 'network', 'address'],
    tags: ['networking', 'conversion']
  }
];

// Export all tools combined
export const ALL_TOOLS: Tool[] = [
  ...CRYPTO_TOOLS,
  ...CONVERTER_TOOLS,
  ...WEB_TOOLS,
  ...TEXT_TOOLS,
  ...MATH_TOOLS,
  ...NETWORK_TOOLS
];

// Tool lookup helpers
export const getToolById = (id: string): Tool | undefined => {
  return ALL_TOOLS.find(tool => tool.id === id);
};

export const getToolsByCategory = (category: ToolCategory): Tool[] => {
  return ALL_TOOLS.filter(tool => tool.category === category);
};

export const searchTools = (query: string): Tool[] => {
  const lowerQuery = query.toLowerCase();
  return ALL_TOOLS.filter(tool =>
    tool.name.toLowerCase().includes(lowerQuery) ||
    tool.description.toLowerCase().includes(lowerQuery) ||
    tool.keywords.some(k => k.toLowerCase().includes(lowerQuery))
  );
};
