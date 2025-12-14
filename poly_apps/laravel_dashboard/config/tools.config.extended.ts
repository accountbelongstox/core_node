import { ToolConfig } from '../core/types';

/**
 * Extended IT Tools Configuration
 * 92 additional tools to complete the IT Tools suite
 */

export const CONVERTER_TOOLS: Record<string, ToolConfig> = {
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

  temperatureConverter: {
    id: 'temperatureConverter',
    name: 'Temperature Converter',
    category: 'Converters',
    icon: 'Wrench',
    description: 'Convert between Celsius, Fahrenheit, and Kelvin',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.convertTemperature',
    inputSchema: {
      required: ['value', 'from'],
      properties: {
        value: { type: 'number' },
        from: { type: 'string', enum: ['celsius', 'fahrenheit', 'kelvin'] },
        to: { type: 'string', enum: ['celsius', 'fahrenheit', 'kelvin'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        celsius: { type: 'number' },
        fahrenheit: { type: 'number' },
        kelvin: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

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

export const WEB_DEVELOPMENT_TOOLS: Record<string, ToolConfig> = {
  jsonDiff: {
    id: 'jsonDiff',
    name: 'JSON Diff',
    category: 'Web Development',
    icon: 'FileCode',
    description: 'Compare two JSON objects and show differences',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.jsonDiff',
    inputSchema: {
      required: ['json1', 'json2'],
      properties: {
        json1: { type: 'string', minLength: 1 },
        json2: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        differences: { type: 'array' },
        hasDifferences: { type: 'boolean' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  jwtParser: {
    id: 'jwtParser',
    name: 'JWT Parser',
    category: 'Web Development',
    icon: 'Key',
    description: 'Parse and decode JSON Web Tokens',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.jwtParse',
    inputSchema: {
      required: ['token'],
      properties: {
        token: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        header: { type: 'object' },
        payload: { type: 'object' },
        signature: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  htmlEncoder: {
    id: 'htmlEncoder',
    name: 'HTML Entity Encoder',
    category: 'Web Development',
    icon: 'Code',
    description: 'Encode HTML entities',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.htmlEncode',
    inputSchema: {
      required: ['html'],
      properties: {
        html: { type: 'string', minLength: 1 }
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

  htmlDecoder: {
    id: 'htmlDecoder',
    name: 'HTML Entity Decoder',
    category: 'Web Development',
    icon: 'Code',
    description: 'Decode HTML entities',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.htmlDecode',
    inputSchema: {
      required: ['encoded'],
      properties: {
        encoded: { type: 'string', minLength: 1 }
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

  markdownToHtml: {
    id: 'markdownToHtml',
    name: 'Markdown to HTML',
    category: 'Web Development',
    icon: 'FileCode',
    description: 'Convert Markdown to HTML',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.markdownToHtml',
    inputSchema: {
      required: ['markdown'],
      properties: {
        markdown: { type: 'string', minLength: 1 },
        sanitize: { type: 'boolean' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        html: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  sqlFormatter: {
    id: 'sqlFormatter',
    name: 'SQL Formatter',
    category: 'Web Development',
    icon: 'Database',
    description: 'Format and beautify SQL queries',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.sqlFormat',
    inputSchema: {
      required: ['sql'],
      properties: {
        sql: { type: 'string', minLength: 1 },
        indent: { type: 'string' },
        uppercase: { type: 'boolean' }
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

  yamlFormatter: {
    id: 'yamlFormatter',
    name: 'YAML Formatter',
    category: 'Web Development',
    icon: 'FileCode',
    description: 'Format and beautify YAML',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.yamlFormat',
    inputSchema: {
      required: ['yaml'],
      properties: {
        yaml: { type: 'string', minLength: 1 },
        indent: { type: 'number', enum: [2, 4] }
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

  xmlFormatter: {
    id: 'xmlFormatter',
    name: 'XML Formatter',
    category: 'Web Development',
    icon: 'FileCode',
    description: 'Format and beautify XML',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.xmlFormat',
    inputSchema: {
      required: ['xml'],
      properties: {
        xml: { type: 'string', minLength: 1 },
        indent: { type: 'number', enum: [2, 4] }
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

  httpStatusLookup: {
    id: 'httpStatusLookup',
    name: 'HTTP Status Code Lookup',
    category: 'Web Development',
    icon: 'Globe',
    description: 'Look up HTTP status code meanings',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.httpStatus',
    inputSchema: {
      required: ['code'],
      properties: {
        code: { type: 'number', min: 100, max: 599 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        code: { type: 'number' },
        message: { type: 'string' },
        category: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: true
  },

  mimeTypeLookup: {
    id: 'mimeTypeLookup',
    name: 'MIME Type Lookup',
    category: 'Web Development',
    icon: 'FileCode',
    description: 'Look up MIME types by file extension',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.getMimeTypes',
    inputSchema: {
      required: [],
      properties: {
        search: { type: 'string' },
        extension: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        mimeTypes: { type: 'array' },
        count: { type: 'number' }
      }
    },
    history: false,
    favorites: true,
    cache: true
  },

  metaTagGenerator: {
    id: 'metaTagGenerator',
    name: 'Meta Tag Generator',
    category: 'Web Development',
    icon: 'Code',
    description: 'Generate HTML meta tags for SEO',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.generateMetaTags',
    inputSchema: {
      required: ['title', 'description'],
      properties: {
        title: { type: 'string', minLength: 1 },
        description: { type: 'string', minLength: 1 },
        image: { type: 'string' },
        url: { type: 'string' },
        type: { type: 'string', enum: ['website', 'article', 'product'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        tags: { type: 'object' },
        allTags: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  svgOptimizer: {
    id: 'svgOptimizer',
    name: 'SVG Optimizer',
    category: 'Web Development',
    icon: 'Image',
    description: 'Optimize and minify SVG files',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.svgOptimize',
    inputSchema: {
      required: ['svg'],
      properties: {
        svg: { type: 'string', minLength: 1 },
        precision: { type: 'number', min: 1, max: 5 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        optimized: { type: 'string' },
        originalSize: { type: 'number' },
        optimizedSize: { type: 'number' },
        savings: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  wifiQrCode: {
    id: 'wifiQrCode',
    name: 'WiFi QR Code Generator',
    category: 'Web Development',
    icon: 'Wifi',
    description: 'Generate QR codes for WiFi network sharing',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.generateWifiQrCode',
    inputSchema: {
      required: ['ssid'],
      properties: {
        ssid: { type: 'string', minLength: 1 },
        password: { type: 'string' },
        encryption: { type: 'string', enum: ['WPA', 'WEP', 'nopass'] },
        hidden: { type: 'boolean' },
        size: { type: 'number', min: 100, max: 1000 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        qrCodeUrl: { type: 'string' },
        wifiString: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  }
};

export const TEXT_PROCESSING_TOOLS: Record<string, ToolConfig> = {
  urlParser: {
    id: 'urlParser',
    name: 'URL Parser',
    category: 'Text Processing',
    icon: 'Globe',
    description: 'Parse and analyze URLs',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.urlParse',
    inputSchema: {
      required: ['url'],
      properties: {
        url: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        protocol: { type: 'string' },
        host: { type: 'string' },
        pathname: { type: 'string' },
        search: { type: 'string' },
        hash: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  loremIpsumGenerator: {
    id: 'loremIpsumGenerator',
    name: 'Lorem Ipsum Generator',
    category: 'Text Processing',
    icon: 'FileText',
    description: 'Generate Lorem Ipsum placeholder text',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.loremIpsum',
    inputSchema: {
      required: [],
      properties: {
        count: { type: 'number', min: 1, max: 100 },
        unit: { type: 'string', enum: ['words', 'sentences', 'paragraphs'] },
        startWithLorem: { type: 'boolean' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  emailNormalizer: {
    id: 'emailNormalizer',
    name: 'Email Normalizer',
    category: 'Text Processing',
    icon: 'Mail',
    description: 'Normalize and validate email addresses',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.emailNormalize',
    inputSchema: {
      required: ['email'],
      properties: {
        email: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        normalized: { type: 'string' },
        valid: { type: 'boolean' },
        localPart: { type: 'string' },
        domain: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  numeronymGenerator: {
    id: 'numeronymGenerator',
    name: 'Numeronym Generator',
    category: 'Text Processing',
    icon: 'Hash',
    description: 'Generate numeronyms (e.g., i18n, a11y)',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.numeronym',
    inputSchema: {
      required: ['text'],
      properties: {
        text: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        numeronym: { type: 'string' },
        original: { type: 'string' },
        length: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  textDiff: {
    id: 'textDiff',
    name: 'Text Diff',
    category: 'Text Processing',
    icon: 'FileText',
    description: 'Compare two texts and show differences',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.textDiff',
    inputSchema: {
      required: ['text1', 'text2'],
      properties: {
        text1: { type: 'string', minLength: 1 },
        text2: { type: 'string', minLength: 1 },
        ignoreWhitespace: { type: 'boolean' },
        ignoreCase: { type: 'boolean' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        diff: { type: 'array' },
        hasDifferences: { type: 'boolean' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  asciiArtGenerator: {
    id: 'asciiArtGenerator',
    name: 'ASCII Art Generator',
    category: 'Text Processing',
    icon: 'Type',
    description: 'Generate ASCII art from text',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.asciiArt',
    inputSchema: {
      required: ['text'],
      properties: {
        text: { type: 'string', minLength: 1 },
        font: { type: 'string', enum: ['standard', 'banner', 'block'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        art: { type: 'string' },
        font: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  crontabParser: {
    id: 'crontabParser',
    name: 'Crontab Parser',
    category: 'Text Processing',
    icon: 'Clock',
    description: 'Parse and explain crontab expressions',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.parseCrontab',
    inputSchema: {
      required: ['crontab'],
      properties: {
        crontab: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        schedule: { type: 'object' },
        description: { type: 'string' },
        isValid: { type: 'boolean' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  phoneParser: {
    id: 'phoneParser',
    name: 'Phone Number Parser',
    category: 'Text Processing',
    icon: 'Phone',
    description: 'Parse and format phone numbers',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.parsePhone',
    inputSchema: {
      required: ['phone'],
      properties: {
        phone: { type: 'string', minLength: 1 },
        country: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        cleaned: { type: 'string' },
        countryCode: { type: 'string' },
        nationalNumber: { type: 'string' },
        formatted: { type: 'string' },
        isValid: { type: 'boolean' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  ibanValidator: {
    id: 'ibanValidator',
    name: 'IBAN Validator',
    category: 'Text Processing',
    icon: 'CreditCard',
    description: 'Validate International Bank Account Numbers',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.validateIban',
    inputSchema: {
      required: ['iban'],
      properties: {
        iban: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        iban: { type: 'string' },
        countryCode: { type: 'string' },
        checkDigits: { type: 'string' },
        bban: { type: 'string' },
        isValid: { type: 'boolean' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  safelinkEncoder: {
    id: 'safelinkEncoder',
    name: 'Safelink Encoder',
    category: 'Text Processing',
    icon: 'Link',
    description: 'Encode/decode URLs for safe linking',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.encodeSafelink',
    inputSchema: {
      required: ['url', 'action'],
      properties: {
        url: { type: 'string', minLength: 1 },
        action: { type: 'string', enum: ['encode', 'decode'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        original: { type: 'string' },
        result: { type: 'string' },
        action: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  emojiPicker: {
    id: 'emojiPicker',
    name: 'Emoji Picker',
    category: 'Text Processing',
    icon: 'Smile',
    description: 'Search and browse emojis',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.emojiPicker',
    inputSchema: {
      required: [],
      properties: {
        search: { type: 'string' },
        category: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        emojis: { type: 'array' },
        count: { type: 'number' }
      }
    },
    history: false,
    favorites: true,
    cache: true
  },

  gitMemoGenerator: {
    id: 'gitMemoGenerator',
    name: 'Git Commit Message Generator',
    category: 'Text Processing',
    icon: 'GitBranch',
    description: 'Generate conventional commit messages',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.generateGitMemo',
    inputSchema: {
      required: ['type', 'subject'],
      properties: {
        type: { type: 'string', enum: ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore'] },
        scope: { type: 'string' },
        subject: { type: 'string', minLength: 1 },
        body: { type: 'string' },
        breaking: { type: 'boolean' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        header: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  textObfuscator: {
    id: 'textObfuscator',
    name: 'Text Obfuscator',
    category: 'Text Processing',
    icon: 'Eye',
    description: 'Obfuscate text using various methods',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.obfuscate',
    inputSchema: {
      required: ['text'],
      properties: {
        text: { type: 'string', minLength: 1 },
        method: { type: 'string', enum: ['unicode', 'hex', 'rot13', 'base64', 'reverse'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        original: { type: 'string' },
        obfuscated: { type: 'string' },
        method: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  }
};

export const MATH_TOOLS: Record<string, ToolConfig> = {
  mathEvaluator: {
    id: 'mathEvaluator',
    name: 'Math Expression Evaluator',
    category: 'Math & Calculation',
    icon: 'Calculator',
    description: 'Evaluate mathematical expressions',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.mathEvaluate',
    inputSchema: {
      required: ['expression'],
      properties: {
        expression: { type: 'string', minLength: 1 },
        precision: { type: 'number', min: 0, max: 20 }
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
    cache: false
  },

  percentageCalculator: {
    id: 'percentageCalculator',
    name: 'Percentage Calculator',
    category: 'Math & Calculation',
    icon: 'Calculator',
    description: 'Calculate percentages, percentage change, etc.',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.calculatePercentage',
    inputSchema: {
      required: ['operation', 'value1', 'value2'],
      properties: {
        operation: { type: 'string', enum: ['percent_of', 'percentage_change', 'what_percent'] },
        value1: { type: 'number' },
        value2: { type: 'number' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        result: { type: 'number' },
        formula: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  etaCalculator: {
    id: 'etaCalculator',
    name: 'ETA Calculator',
    category: 'Math & Calculation',
    icon: 'Clock',
    description: 'Calculate estimated time of arrival/completion',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.calculateEta',
    inputSchema: {
      required: ['totalItems', 'completedItems', 'elapsedTime'],
      properties: {
        totalItems: { type: 'number', min: 1 },
        completedItems: { type: 'number', min: 0 },
        elapsedTime: { type: 'number', min: 0 },
        unit: { type: 'string', enum: ['seconds', 'minutes', 'hours'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        eta: { type: 'number' },
        remainingTime: { type: 'number' },
        estimatedCompletion: { type: 'string' },
        itemsPerSecond: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  benchmarkTool: {
    id: 'benchmarkTool',
    name: 'Performance Benchmark',
    category: 'Math & Calculation',
    icon: 'Zap',
    description: 'Benchmark operation performance',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.benchmark',
    inputSchema: {
      required: ['operation'],
      properties: {
        operation: { type: 'string', enum: ['string_concat', 'array_push', 'math_calc', 'json_encode', 'hash'] },
        iterations: { type: 'number', min: 1, max: 1000000 },
        data: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string' },
        iterations: { type: 'number' },
        executionTimeMs: { type: 'number' },
        memoryUsed: { type: 'number' },
        opsPerSecond: { type: 'number' }
      }
    },
    history: true,
    favorites: false,
    cache: false
  }
};

export const NETWORK_TOOLS: Record<string, ToolConfig> = {
  ipv4RangeExpander: {
    id: 'ipv4RangeExpander',
    name: 'IPv4 Range Expander',
    category: 'Network Tools',
    icon: 'Network',
    description: 'Expand IPv4 ranges to list of IPs',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.ipv4Expand',
    inputSchema: {
      required: ['range'],
      properties: {
        range: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        ips: { type: 'array' },
        count: { type: 'number' },
        truncated: { type: 'boolean' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  ipv6UlaGenerator: {
    id: 'ipv6UlaGenerator',
    name: 'IPv6 ULA Generator',
    category: 'Network Tools',
    icon: 'Network',
    description: 'Generate IPv6 Unique Local Addresses',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.ipv6GenerateUla',
    inputSchema: {
      required: [],
      properties: {
        count: { type: 'number', min: 1, max: 50 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        addresses: { type: 'array' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  macGenerator: {
    id: 'macGenerator',
    name: 'MAC Address Generator',
    category: 'Network Tools',
    icon: 'Network',
    description: 'Generate random MAC addresses',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.generateMacAddress',
    inputSchema: {
      required: [],
      properties: {
        count: { type: 'number', min: 1, max: 50 },
        separator: { type: 'string', enum: [':', '-'] },
        uppercase: { type: 'boolean' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        addresses: { type: 'array' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  macLookup: {
    id: 'macLookup',
    name: 'MAC Address Vendor Lookup',
    category: 'Network Tools',
    icon: 'Search',
    description: 'Look up MAC address vendor/manufacturer',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.macLookup',
    inputSchema: {
      required: ['mac'],
      properties: {
        mac: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        mac: { type: 'string' },
        vendor: { type: 'string' },
        prefix: { type: 'string' },
        found: { type: 'boolean' }
      }
    },
    history: true,
    favorites: true,
    cache: true
  },

  userAgentParser: {
    id: 'userAgentParser',
    name: 'User Agent Parser',
    category: 'Network Tools',
    icon: 'Monitor',
    description: 'Parse and analyze User-Agent strings',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.parseUserAgent',
    inputSchema: {
      required: ['userAgent'],
      properties: {
        userAgent: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        browser: { type: 'string' },
        browserVersion: { type: 'string' },
        os: { type: 'string' },
        device: { type: 'string' },
        isMobile: { type: 'boolean' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  chmodCalculator: {
    id: 'chmodCalculator',
    name: 'Chmod Calculator',
    category: 'Network Tools',
    icon: 'Lock',
    description: 'Convert between octal and symbolic chmod permissions',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.chmod',
    inputSchema: {
      required: ['permissions'],
      properties: {
        permissions: { type: 'string', pattern: '^[0-7]{3}$' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        octal: { type: 'string' },
        symbolic: { type: 'string' },
        owner: { type: 'string' },
        group: { type: 'string' },
        others: { type: 'string' },
        description: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  randomPortGenerator: {
    id: 'randomPortGenerator',
    name: 'Random Port Generator',
    category: 'Network Tools',
    icon: 'Hash',
    description: 'Generate random port numbers',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.randomPort',
    inputSchema: {
      required: [],
      properties: {
        count: { type: 'number', min: 1, max: 50 },
        min: { type: 'number', min: 1024, max: 65535 },
        max: { type: 'number', min: 1024, max: 65535 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        ports: { type: 'array' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  }
};

// Export all extended tools
export const ALL_EXTENDED_IT_TOOLS = {
  ...CONVERTER_TOOLS,
  ...WEB_DEVELOPMENT_TOOLS,
  ...TEXT_PROCESSING_TOOLS,
  ...MATH_TOOLS,
  ...NETWORK_TOOLS
};

