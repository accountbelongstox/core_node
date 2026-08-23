/** Extended math and network tool definitions. */

import type { ToolDefinition } from '@/apps/laravel-manager/types';



export const MATH_TOOLS: Record<string, ToolDefinition> = {
  mathEvaluator: {
    id: 'mathEvaluator',
    name: 'Math Expression Evaluator',
    category: 'Math & Calculators',
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
    category: 'Math & Calculators',
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
    category: 'Math & Calculators',
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
    category: 'Math & Calculators',
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

export const NETWORK_TOOLS: Record<string, ToolDefinition> = {
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


