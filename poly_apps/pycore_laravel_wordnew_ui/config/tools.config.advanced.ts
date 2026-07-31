import { ToolDefinition } from '@/apps/laravel-manager/types';

/**
 * Advanced IT Tools - Final Part (28 configs)
 * Images (7), Calculators (5), PDFs (5), Unified APIs (8), Extra (3)
 */

export const ADVANCED_IMAGE_TOOLS: Record<string, ToolDefinition> = {
  imageRotator: {
    id: 'imageRotator',
    name: 'Image Rotator',
    category: 'Image Tools',
    icon: 'RotateCw',
    description: 'Rotate images by specified angle',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.imageRotate',
    inputSchema: {
      required: ['image', 'angle'],
      properties: {
        image: { type: 'file', accept: 'image/*' },
        angle: { type: 'number', enum: [90, 180, 270] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  imageFlipper: {
    id: 'imageFlipper',
    name: 'Image Flipper',
    category: 'Image Tools',
    icon: 'Flip',
    description: 'Flip images horizontally or vertically',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.imageFlip',
    inputSchema: {
      required: ['image', 'direction'],
      properties: {
        image: { type: 'file', accept: 'image/*' },
        direction: { type: 'string', enum: ['horizontal', 'vertical'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  imageColorExtractor: {
    id: 'imageColorExtractor',
    name: 'Image Color Extractor',
    category: 'Image Tools',
    icon: 'Palette',
    description: 'Extract dominant colors from images',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.imageExtractColors',
    inputSchema: {
      required: ['image'],
      properties: {
        image: { type: 'file', accept: 'image/*' },
        count: { type: 'number', min: 1, max: 20 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        colors: { type: 'array' },
        count: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  imageCropper: {
    id: 'imageCropper',
    name: 'Image Cropper',
    category: 'Image Tools',
    icon: 'Crop',
    description: 'Crop images to specified dimensions',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.imageCrop',
    inputSchema: {
      required: ['image', 'x', 'y', 'width', 'height'],
      properties: {
        image: { type: 'file', accept: 'image/*' },
        x: { type: 'number', min: 0 },
        y: { type: 'number', min: 0 },
        width: { type: 'number', min: 1 },
        height: { type: 'number', min: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  imageConverter: {
    id: 'imageConverter',
    name: 'Image Format Converter',
    category: 'Image Tools',
    icon: 'Image',
    description: 'Convert images between formats (PNG, JPEG, WEBP, etc.)',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.imageConvert',
    inputSchema: {
      required: ['image', 'format'],
      properties: {
        image: { type: 'file', accept: 'image/*' },
        format: { type: 'string', enum: ['png', 'jpeg', 'webp', 'gif', 'bmp'] },
        quality: { type: 'number', min: 1, max: 100 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string' },
        format: { type: 'string' },
        size: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  imageResizer: {
    id: 'imageResizer',
    name: 'Image Resizer',
    category: 'Image Tools',
    icon: 'Maximize',
    description: 'Resize images to specified dimensions',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.imageResize',
    inputSchema: {
      required: ['image'],
      properties: {
        image: { type: 'file', accept: 'image/*' },
        width: { type: 'number', min: 1 },
        height: { type: 'number', min: 1 },
        maintainAspectRatio: { type: 'boolean' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  imageCompressor: {
    id: 'imageCompressor',
    name: 'Image Compressor',
    category: 'Image Tools',
    icon: 'Minimize',
    description: 'Compress images to reduce file size',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.imageCompress',
    inputSchema: {
      required: ['image'],
      properties: {
        image: { type: 'file', accept: 'image/*' },
        quality: { type: 'number', min: 1, max: 100 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string' },
        originalSize: { type: 'number' },
        compressedSize: { type: 'number' },
        savings: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  }
};

export const ADVANCED_CALCULATOR_TOOLS: Record<string, ToolDefinition> = {
  ageCalculator: {
    id: 'ageCalculator',
    name: 'Age Calculator',
    category: 'Math & Calculators',
    icon: 'Calendar',
    description: 'Calculate age from birthdate',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.calculateAge',
    inputSchema: {
      required: ['birthDate'],
      properties: {
        birthDate: { type: 'string', format: 'date' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        years: { type: 'number' },
        months: { type: 'number' },
        days: { type: 'number' },
        totalDays: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  bmiCalculator: {
    id: 'bmiCalculator',
    name: 'BMI Calculator',
    category: 'Math & Calculators',
    icon: 'Activity',
    description: 'Calculate Body Mass Index',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.calculateBMI',
    inputSchema: {
      required: ['weight', 'height'],
      properties: {
        weight: { type: 'number', min: 1 },
        height: { type: 'number', min: 1 },
        unit: { type: 'string', enum: ['metric', 'imperial'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        bmi: { type: 'number' },
        category: { type: 'string' },
        healthyRange: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  loanEmiCalculator: {
    id: 'loanEmiCalculator',
    name: 'Loan EMI Calculator',
    category: 'Math & Calculators',
    icon: 'DollarSign',
    description: 'Calculate loan EMI (Equated Monthly Installment)',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.calculateLoanEMI',
    inputSchema: {
      required: ['principal', 'rate', 'tenure'],
      properties: {
        principal: { type: 'number', min: 1 },
        rate: { type: 'number', min: 0.1, max: 100 },
        tenure: { type: 'number', min: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        emi: { type: 'number' },
        totalInterest: { type: 'number' },
        totalAmount: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  gstCalculator: {
    id: 'gstCalculator',
    name: 'GST Calculator',
    category: 'Math & Calculators',
    icon: 'Receipt',
    description: 'Calculate GST/VAT tax amount',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.calculateGST',
    inputSchema: {
      required: ['amount', 'rate'],
      properties: {
        amount: { type: 'number', min: 0 },
        rate: { type: 'number', min: 0, max: 100 },
        type: { type: 'string', enum: ['inclusive', 'exclusive'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        originalAmount: { type: 'number' },
        gstAmount: { type: 'number' },
        totalAmount: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  numberToWords: {
    id: 'numberToWords',
    name: 'Number to Words Converter',
    category: 'Math & Calculators',
    icon: 'Type',
    description: 'Convert numbers to written words',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.numberToWords',
    inputSchema: {
      required: ['number'],
      properties: {
        number: { type: 'number' },
        language: { type: 'string', enum: ['en', 'es', 'fr', 'de'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        words: { type: 'string' },
        number: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  }
};

export const PDF_TOOLS: Record<string, ToolDefinition> = {
  pdfSplitter: {
    id: 'pdfSplitter',
    name: 'PDF Splitter',
    category: 'PDF Tools',
    icon: 'FileMinus',
    description: 'Split PDF into multiple files by page range',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.pdfSplit',
    inputSchema: {
      required: ['pdf', 'pages'],
      properties: {
        pdf: { type: 'file', accept: 'application/pdf' },
        pages: { type: 'string', minLength: 1, pattern: '^[0-9,-]+$' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        files: { type: 'array' },
        count: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  pdfMerger: {
    id: 'pdfMerger',
    name: 'PDF Merger',
    category: 'PDF Tools',
    icon: 'FilePlus',
    description: 'Merge multiple PDF files into one',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.pdfMerge',
    inputSchema: {
      required: ['pdfs'],
      properties: {
        pdfs: { type: 'array', minItems: 2 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        pdfUrl: { type: 'string' },
        pageCount: { type: 'number' },
        size: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  pdfCompressor: {
    id: 'pdfCompressor',
    name: 'PDF Compressor',
    category: 'PDF Tools',
    icon: 'FileArchive',
    description: 'Compress PDF to reduce file size',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.pdfCompress',
    inputSchema: {
      required: ['pdf'],
      properties: {
        pdf: { type: 'file', accept: 'application/pdf' },
        quality: { type: 'string', enum: ['low', 'medium', 'high'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        pdfUrl: { type: 'string' },
        originalSize: { type: 'number' },
        compressedSize: { type: 'number' },
        savings: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  pdfRotator: {
    id: 'pdfRotator',
    name: 'PDF Rotator',
    category: 'PDF Tools',
    icon: 'RotateCw',
    description: 'Rotate PDF pages',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.pdfRotate',
    inputSchema: {
      required: ['pdf', 'angle'],
      properties: {
        pdf: { type: 'file', accept: 'application/pdf' },
        angle: { type: 'number', enum: [90, 180, 270] },
        pages: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        pdfUrl: { type: 'string' },
        pageCount: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  pdfProtector: {
    id: 'pdfProtector',
    name: 'PDF Password Protector',
    category: 'PDF Tools',
    icon: 'Shield',
    description: 'Add password protection to PDF files',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.pdfAddPassword',
    inputSchema: {
      required: ['pdf', 'password'],
      properties: {
        pdf: { type: 'file', accept: 'application/pdf' },
        password: { type: 'string', minLength: 4 },
        permissions: { type: 'object' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        pdfUrl: { type: 'string' },
        protected: { type: 'boolean' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  }
};

export const UNIFIED_API_TOOLS: Record<string, ToolDefinition> = {
  textEncoder: {
    id: 'textEncoder',
    name: 'Text Encoder (Unified)',
    category: 'Converters',
    icon: 'Code',
    description: 'Encode text using various methods (Base64, URL, etc.)',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.encode',
    inputSchema: {
      required: ['type', 'input'],
      properties: {
        type: { type: 'string', enum: ['base64', 'url', 'html'] },
        input: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        output: { type: 'string' },
        type: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  textDecoder: {
    id: 'textDecoder',
    name: 'Text Decoder (Unified)',
    category: 'Converters',
    icon: 'Code',
    description: 'Decode text from various formats',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.decode',
    inputSchema: {
      required: ['type', 'input'],
      properties: {
        type: { type: 'string', enum: ['base64', 'url', 'html'] },
        input: { type: 'string', minLength: 1 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        output: { type: 'string' },
        type: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  hashGeneratorUnified: {
    id: 'hashGeneratorUnified',
    name: 'Hash Generator (Unified)',
    category: 'Crypto & Security',
    icon: 'Hash',
    description: 'Generate hashes using unified API',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.hash',
    inputSchema: {
      required: ['algorithm', 'input'],
      properties: {
        algorithm: { type: 'string', enum: ['md5', 'sha1', 'sha256', 'sha512'] },
        input: { type: 'string', minLength: 1 }
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

  hmacGeneratorUnified: {
    id: 'hmacGeneratorUnified',
    name: 'HMAC Generator (Unified)',
    category: 'Crypto & Security',
    icon: 'Hash',
    description: 'Generate HMAC using unified API',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.hmac',
    inputSchema: {
      required: ['algorithm', 'input', 'key'],
      properties: {
        algorithm: { type: 'string', enum: ['sha256', 'sha512'] },
        input: { type: 'string', minLength: 1 },
        key: { type: 'string', minLength: 1 }
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

  uuidGeneratorUnified: {
    id: 'uuidGeneratorUnified',
    name: 'UUID Generator (Unified)',
    category: 'Crypto & Security',
    icon: 'Key',
    description: 'Generate UUIDs using unified API',
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

  tokenGeneratorUnified: {
    id: 'tokenGeneratorUnified',
    name: 'Token Generator (Unified)',
    category: 'Crypto & Security',
    icon: 'Key',
    description: 'Generate random tokens using unified API',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.generateToken',
    inputSchema: {
      required: [],
      properties: {
        length: { type: 'number', min: 16, max: 256 }
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

  caseConverterUnified: {
    id: 'caseConverterUnified',
    name: 'Case Converter (Unified)',
    category: 'Converters',
    icon: 'Type',
    description: 'Convert text case using unified API',
    apiModule: 'itToolsV1',
    apiMethod: 'itToolsV1.convertCase',
    inputSchema: {
      required: ['text', 'case'],
      properties: {
        text: { type: 'string', minLength: 1 },
        case: { type: 'string', enum: ['camel', 'pascal', 'snake', 'kebab', 'upper', 'lower'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        converted: { type: 'string' },
        case: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  slugifyUnified: {
    id: 'slugifyUnified',
    name: 'Slugify (Unified)',
    category: 'Converters',
    icon: 'Link',
    description: 'Generate URL slugs using unified API',
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
  }
};

// Export all advanced tools
export const ALL_ADVANCED_IT_TOOLS = {
  ...ADVANCED_IMAGE_TOOLS,
  ...ADVANCED_CALCULATOR_TOOLS,
  ...PDF_TOOLS,
  ...UNIFIED_API_TOOLS
};

