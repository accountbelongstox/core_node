/** AI and vocabulary tool definitions. */

import type { ToolDefinition } from '@/apps/laravel-manager/types';



/**
 * AI Tools Configuration
 */
export const AI_TOOLS: Record<string, ToolDefinition> = {
  translation: {
    id: 'translation',
    name: 'AI Translation',
    category: 'AI Tools',
    icon: 'Languages',
    description: 'Translate text between languages using AI',
    apiModule: 'appQyV1',
    apiMethod: 'appQyV1.translate',
    inputSchema: {
      required: ['text', 'sourceLang', 'targetLang'],
      properties: {
        text: { type: 'string', minLength: 1 },
        sourceLang: { type: 'string' },
        targetLang: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        translated_text: { type: 'string' },
        detected_language: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  tts: {
    id: 'tts',
    name: 'Text-to-Speech',
    category: 'AI Tools',
    icon: 'Volume2',
    description: 'Convert text to natural speech audio',
    apiModule: 'appQyV1',
    apiMethod: 'appQyV1.generateTTS',
    inputSchema: {
      required: ['text', 'language'],
      properties: {
        text: { type: 'string', minLength: 1 },
        language: { type: 'string' },
        voice_type: { type: 'string' },
        speed: { type: 'number', min: 0.5, max: 2.0 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        audio_url: { type: 'string' },
        duration: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  ocr: {
    id: 'ocr',
    name: 'OCR (Image to Text)',
    category: 'AI Tools',
    icon: 'FileImage',
    description: 'Extract text from images using OCR',
    apiModule: 'mcpV1',
    // Was 'mcpV1.uploadScreenshot' — that posts the image to the screenshot
    // store, NOT the OCR engine, so "Extract Text" silently produced no text.
    // ocrRecognize hits the real /mcp/v1/ocr/recognize endpoint.
    apiMethod: 'mcpV1.ocrRecognize',
    inputSchema: {
      required: ['image'],
      properties: {
        image: { type: 'file' },
        engine: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        confidence: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  promptManager: {
    id: 'promptManager',
    name: 'Prompt Manager',
    category: 'AI Tools',
    icon: 'FileText',
    description: 'Manage and organize AI prompts',
    apiModule: 'mcpV1',
    apiMethod: 'mcpV1.getPromptMappings',
    inputSchema: {
      required: [],
      properties: {
        category: { type: 'string' },
        search: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          category: { type: 'string' }
        }
      }
    },
    history: true,
    favorites: true,
    cache: true
  },

  imageGeneration: {
    id: 'imageGeneration',
    name: 'Image Generation',
    category: 'AI Tools',
    icon: 'Image',
    description: 'Generate images from text descriptions',
    apiModule: 'appQyV1',
    apiMethod: 'appQyV1.generateImage',
    // Backend endpoint does not exist yet — shown as coming soon, execute disabled.
    unavailable: true,
    inputSchema: {
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', minLength: 1 },
        style: { type: 'string' },
        size: { type: 'string' },
        quality: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        image_url: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  speechToText: {
    id: 'speechToText',
    name: 'Speech-to-Text',
    category: 'AI Tools',
    icon: 'Mic',
    description: 'Convert speech audio to text',
    apiModule: 'appQyV1',
    apiMethod: 'appQyV1.transcribeAudio',
    // Backend endpoint does not exist yet — shown as coming soon, execute disabled.
    unavailable: true,
    inputSchema: {
      required: ['audio'],
      properties: {
        audio: { type: 'file' },
        language: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        language: { type: 'string' },
        confidence: { type: 'number' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  }
};

/**
 * Vocabulary Learning Tools Configuration
 */
export const VOCABULARY_TOOLS: Record<string, ToolDefinition> = {
  wordLibrary: {
    id: 'wordLibrary',
    name: 'Word Library',
    category: 'Vocabulary',
    icon: 'BookOpen',
    description: 'Browse and manage vocabulary libraries',
    apiModule: 'appQyV1',
    apiMethod: 'appQyV1.getLibraries',
    inputSchema: {
      required: [],
      properties: {
        page: { type: 'number' },
        limit: { type: 'number' },
        search: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        libraries: { type: 'array' },
        total: { type: 'number' }
      }
    },
    history: false,
    favorites: true,
    cache: true
  },

  learningWords: {
    id: 'learningWords',
    name: 'Learning Words',
    category: 'Vocabulary',
    icon: 'Sparkles',
    description: 'View and practice learning words',
    apiModule: 'appQyV1',
    apiMethod: 'appQyV1.getLearningWords',
    inputSchema: {
      required: [],
      properties: {
        library_id: { type: 'string' },
        status: { type: 'string' },
        limit: { type: 'number' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        words: { type: 'array' },
        progress: { type: 'object' }
      }
    },
    history: false,
    favorites: false,
    cache: false
  }
};


