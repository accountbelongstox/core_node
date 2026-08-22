/** Extended converter tool definitions. */

import type { ToolDefinition } from '@/apps/laravel-manager/types';



/**
 * Extended IT Tools Configuration
 * 92 additional tools to complete the IT Tools suite
 */

export const CONVERTER_TOOLS: Record<string, ToolDefinition> = {
  // ========== URL Encoding/Decoding ==========

  urlEncoder: {
    id: 'urlEncoder',
    name: 'URL Encoder',
    category: 'Converters',
    icon: 'Code',
    description: 'Encode URLs for safe transmission',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.urlEncode',
    inputSchema: {
      required: ['text'],
      properties: {
        text: { type: 'string', minLength: 1 }
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

  urlDecoder: {
    id: 'urlDecoder',
    name: 'URL Decoder',
    category: 'Converters',
    icon: 'Code',
    description: 'Decode URL-encoded strings',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.urlDecode',
    inputSchema: {
      required: ['text'],
      properties: {
        text: { type: 'string', minLength: 1 }
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

  // ========== Case Converters ==========

  caseConverter: {
    id: 'caseConverter',
    name: 'Case Converter',
    category: 'Converters',
    icon: 'Code',
    description: 'Convert text between camelCase, snake_case, kebab-case, etc.',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.convertCase',
    inputSchema: {
      required: ['text'],
      properties: {
        text: { type: 'string', minLength: 1 },
        case: { type: 'string', enum: ['camel', 'pascal', 'snake', 'kebab', 'upper', 'lower'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        camelCase: { type: 'string' },
        PascalCase: { type: 'string' },
        snake_case: { type: 'string' },
        'kebab-case': { type: 'string' },
        SCREAMING_SNAKE_CASE: { type: 'string' },
        lowercase: { type: 'string' },
        UPPERCASE: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  slugGenerator: {
    id: 'slugGenerator',
    name: 'Slug Generator',
    category: 'Converters',
    icon: 'Code',
    description: 'Generate URL-friendly slugs from text',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.slugify',
    inputSchema: {
      required: ['text'],
      properties: {
        text: { type: 'string', minLength: 1 },
        separator: { type: 'string' },
        lowercase: { type: 'boolean' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  // ========== Format Converters ==========

  jsonToYaml: {
    id: 'jsonToYaml',
    name: 'JSON to YAML',
    category: 'Converters',
    icon: 'FileCode',
    description: 'Convert JSON to YAML format',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.jsonToYaml',
    inputSchema: {
      required: ['json'],
      properties: {
        json: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        yaml: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  yamlToJson: {
    id: 'yamlToJson',
    name: 'YAML to JSON',
    category: 'Converters',
    icon: 'FileCode',
    description: 'Convert YAML to JSON format',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.yamlToJson',
    inputSchema: {
      required: ['yaml'],
      properties: {
        yaml: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        json: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  jsonToCsv: {
    id: 'jsonToCsv',
    name: 'JSON to CSV',
    category: 'Converters',
    icon: 'Database',
    description: 'Convert JSON to CSV format',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.jsonToCsv',
    inputSchema: {
      required: ['json'],
      properties: {
        json: { type: 'string', minLength: 1 },
        delimiter: { type: 'string' },
        includeHeaders: { type: 'boolean' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        csv: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  jsonToXml: {
    id: 'jsonToXml',
    name: 'JSON to XML',
    category: 'Converters',
    icon: 'FileCode',
    description: 'Convert JSON to XML format',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.jsonToXml',
    inputSchema: {
      required: ['json'],
      properties: {
        json: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        xml: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  xmlToJson: {
    id: 'xmlToJson',
    name: 'XML to JSON',
    category: 'Converters',
    icon: 'FileCode',
    description: 'Convert XML to JSON format',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.xmlToJson',
    inputSchema: {
      required: ['xml'],
      properties: {
        xml: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        json: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  jsonToToml: {
    id: 'jsonToToml',
    name: 'JSON to TOML',
    category: 'Converters',
    icon: 'FileCode',
    description: 'Convert JSON to TOML format',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.jsonToToml',
    inputSchema: {
      required: ['json'],
      properties: {
        json: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        toml: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  tomlToJson: {
    id: 'tomlToJson',
    name: 'TOML to JSON',
    category: 'Converters',
    icon: 'FileCode',
    description: 'Convert TOML to JSON format',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.tomlToJson',
    inputSchema: {
      required: ['toml'],
      properties: {
        toml: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        json: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  tomlToYaml: {
    id: 'tomlToYaml',
    name: 'TOML to YAML',
    category: 'Converters',
    icon: 'FileCode',
    description: 'Convert TOML to YAML format',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.tomlToYaml',
    inputSchema: {
      required: ['toml'],
      properties: {
        toml: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        yaml: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  yamlToToml: {
    id: 'yamlToToml',
    name: 'YAML to TOML',
    category: 'Converters',
    icon: 'FileCode',
    description: 'Convert YAML to TOML format',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.yamlToToml',
    inputSchema: {
      required: ['yaml'],
      properties: {
        yaml: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        toml: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  // ========== Number & Base Converters ==========

  baseConverter: {
    id: 'baseConverter',
    name: 'Number Base Converter',
    category: 'Converters',
    icon: 'Calculator',
    description: 'Convert numbers between binary, octal, decimal, and hexadecimal',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.convertBase',
    inputSchema: {
      required: ['number', 'from', 'to'],
      properties: {
        number: { type: 'string', minLength: 1 },
        from: { type: 'number', enum: [2, 8, 10, 16] },
        to: { type: 'number', enum: [2, 8, 10, 16] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        binary: { type: 'string' },
        octal: { type: 'string' },
        decimal: { type: 'string' },
        hexadecimal: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  romanToArabic: {
    id: 'romanToArabic',
    name: 'Roman to Arabic Numerals',
    category: 'Converters',
    icon: 'Calculator',
    description: 'Convert Roman numerals to Arabic numbers',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.romanToArabic',
    inputSchema: {
      required: ['roman'],
      properties: {
        roman: { type: 'string', minLength: 1, pattern: '^[IVXLCDM]+$' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        arabic: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  // ========== Text Converters ==========

  textToBinary: {
    id: 'textToBinary',
    name: 'Text to Binary',
    category: 'Converters',
    icon: 'Code',
    description: 'Convert text to binary representation',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.textToBinary',
    inputSchema: {
      required: ['text'],
      properties: {
        text: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        binary: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  textToUnicode: {
    id: 'textToUnicode',
    name: 'Text to Unicode',
    category: 'Converters',
    icon: 'Code',
    description: 'Convert text to Unicode code points',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.textToUnicode',
    inputSchema: {
      required: ['text'],
      properties: {
        text: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        unicode: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  textToNato: {
    id: 'textToNato',
    name: 'Text to NATO Phonetic',
    category: 'Converters',
    icon: 'Code',
    description: 'Convert text to NATO phonetic alphabet',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.textToNato',
    inputSchema: {
      required: ['text'],
      properties: {
        text: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        nato: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  listConverter: {
    id: 'listConverter',
    name: 'List Separator Converter',
    category: 'Converters',
    icon: 'List',
    description: 'Convert list separators (comma, newline, tab, etc.)',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.convertList',
    inputSchema: {
      required: ['list'],
      properties: {
        list: { type: 'string', minLength: 1 },
        from: { type: 'string', enum: ['comma', 'semicolon', 'pipe', 'space', 'tab', 'newline'] },
        to: { type: 'string', enum: ['comma', 'semicolon', 'pipe', 'space', 'tab', 'newline'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        converted: { type: 'string' },
        itemCount: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  // ========== Temperature & DateTime ==========

  // NOTE: `temperatureConverter` is defined canonically in tools.config.missing.ts
  // (richer schema with from/to + titles + defaults). The duplicate that lived
  // here was removed during the registry dedupe.

  dateTimeConverter: {
    id: 'dateTimeConverter',
    name: 'DateTime Converter',
    category: 'Converters',
    icon: 'Clock',
    description: 'Convert between datetime formats (ISO8601, Unix timestamp, etc.)',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.convertDateTime',
    inputSchema: {
      required: ['datetime'],
      properties: {
        datetime: { type: 'string', minLength: 1 },
        from: { type: 'string' },
        to: { type: 'string' },
        timezone: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        iso8601: { type: 'string' },
        unix: { type: 'number' },
        rfc2822: { type: 'string' },
        mysql: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  // ========== File Converters ==========

  base64FileEncoder: {
    id: 'base64FileEncoder',
    name: 'Base64 File Encoder',
    category: 'Converters',
    icon: 'FileCode',
    description: 'Encode files to Base64',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.base64FileEncode',
    inputSchema: {
      required: ['fileData'],
      properties: {
        fileData: { type: 'string' },
        fileName: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        encoded: { type: 'string' },
        dataUri: { type: 'string' },
        size: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  base64FileDecoder: {
    id: 'base64FileDecoder',
    name: 'Base64 File Decoder',
    category: 'Converters',
    icon: 'FileCode',
    description: 'Decode Base64 to files',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.base64FileDecode',
    inputSchema: {
      required: ['encoded'],
      properties: {
        encoded: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        fileData: { type: 'string' },
        mimeType: { type: 'string' },
        size: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  }
};


