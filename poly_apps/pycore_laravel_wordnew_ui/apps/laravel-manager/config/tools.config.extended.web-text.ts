/** Extended web and text tool definitions. */

import type { ToolDefinition } from '@/apps/laravel-manager/types';



export const WEB_DEVELOPMENT_TOOLS: Record<string, ToolDefinition> = {
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

export const TEXT_PROCESSING_TOOLS: Record<string, ToolDefinition> = {
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


