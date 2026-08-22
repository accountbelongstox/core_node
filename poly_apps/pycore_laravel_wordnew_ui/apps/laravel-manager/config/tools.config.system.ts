/** Server and voice-subtitle tool definitions. */

import type { ToolDefinition } from '@/apps/laravel-manager/types';



/**
 * Server Manager Tools Configuration
 */
export const SERVER_MANAGER_TOOLS: Record<string, ToolDefinition> = {
  systemInfo: {
    id: 'systemInfo',
    name: 'System Information',
    category: 'Server Manager',
    icon: 'Server',
    description: 'View system information, processes, and services',
    apiModule: 'serverManagerV1',
    apiMethod: 'serverManagerV1.getSystemInfo',
    inputSchema: {
      required: [],
      properties: {}
    },
    outputSchema: {
      type: 'object',
      properties: {
        cpu: { type: 'object' },
        memory: { type: 'object' },
        disk: { type: 'object' },
        uptime: { type: 'number' }
      }
    },
    history: false,
    favorites: true,
    cache: true
  },

  fileManager: {
    id: 'fileManager',
    name: 'File Manager',
    category: 'Server Manager',
    icon: 'HardDrive',
    description: 'Browse and manage server files',
    apiModule: 'serverManagerV1',
    apiMethod: 'serverManagerV1.browseFiles',
    inputSchema: {
      required: [],
      properties: {
        path: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        files: { type: 'array' },
        path: { type: 'string' }
      }
    },
    history: true,
    favorites: true,
    cache: false
  },

  nginxManager: {
    id: 'nginxManager',
    name: 'Nginx Manager',
    category: 'Server Manager',
    icon: 'Network',
    description: 'Manage Nginx sites and configurations',
    apiModule: 'serverManagerV1',
    apiMethod: 'serverManagerV1.listNginxSites',
    inputSchema: {
      required: [],
      properties: {}
    },
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          enabled: { type: 'boolean' },
          config: { type: 'string' }
        }
      }
    },
    history: false,
    favorites: true,
    cache: true
  },

  sslManager: {
    id: 'sslManager',
    name: 'SSL Certificate Manager',
    category: 'Server Manager',
    icon: 'Lock',
    description: 'Manage SSL certificates with Let\'s Encrypt',
    apiModule: 'serverManagerV1',
    apiMethod: 'serverManagerV1.listCertificates',
    inputSchema: {
      required: [],
      properties: {}
    },
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          domain: { type: 'string' },
          expires_at: { type: 'string' },
          status: { type: 'string' }
        }
      }
    },
    history: false,
    favorites: true,
    cache: true
  },

  codeExecutor: {
    id: 'codeExecutor',
    name: 'Code Executor',
    category: 'Server Manager',
    icon: 'Terminal',
    description: 'Execute server-side scripts and commands',
    apiModule: 'serverManagerV1',
    apiMethod: 'serverManagerV1.listScripts',
    inputSchema: {
      required: [],
      properties: {
        script: { type: 'string' },
        args: { type: 'object' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        output: { type: 'string' },
        exit_code: { type: 'number' }
      }
    },
    history: true,
    favorites: false,
    cache: false
  }
};

/**
 * Voice Subtitle Queue Tools Configuration
 */
export const VOICE_SUBTITLE_TOOLS: Record<string, ToolDefinition> = {
  vsQueue: {
    id: 'vsQueue',
    name: 'Voice Subtitle Queue',
    category: 'Media Tools',
    icon: 'List',
    description: 'Manage voice subtitle queue items',
    apiModule: 'mcpV1',
    apiMethod: 'mcpV1.vsGetQueue',
    inputSchema: {
      required: [],
      properties: {
        page: { type: 'number' },
        limit: { type: 'number' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: { type: 'array' },
        total: { type: 'number' },
        current_index: { type: 'number' }
      }
    },
    history: false,
    favorites: true,
    cache: false
  },

  vsAddText: {
    id: 'vsAddText',
    name: 'Add Text to Queue',
    category: 'Media Tools',
    icon: 'FileText',
    description: 'Add text to voice subtitle queue',
    apiModule: 'mcpV1',
    apiMethod: 'mcpV1.vsAddText',
    inputSchema: {
      required: ['text'],
      properties: {
        text: { type: 'string', minLength: 1 },
        language: { type: 'string' },
        group: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        message: { type: 'string' }
      }
    },
    history: true,
    favorites: false,
    cache: false
  },

  vsPlayer: {
    id: 'vsPlayer',
    name: 'Voice Subtitle Player',
    category: 'Media Tools',
    icon: 'Play',
    description: 'Play, pause, and navigate voice subtitle queue',
    apiModule: 'mcpV1',
    apiMethod: 'mcpV1.vsGetCurrent',
    inputSchema: {
      required: [],
      properties: {}
    },
    outputSchema: {
      type: 'object',
      properties: {
        item: { type: 'object' },
        index: { type: 'number' },
        total: { type: 'number' }
      }
    },
    history: false,
    favorites: true,
    cache: false
  }
};


