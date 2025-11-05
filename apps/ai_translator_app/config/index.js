// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const path = require('path');

module.exports = {
    // Application basic settings
    appName: 'AI Translator App',
    appVersion: '1.0.0',
    
    // Watch directory configuration
    watchConfig: {
        watchPath: 'D:\\programing\\core_node_archive',
        watchExtensions: ['.txt', '.md'],
        watchDepth: 10,
        skipFolders: ['node_modules', '.git', '.cache', '.tmp', 'backup'],
        skipFiles: [],
        skipExtensions: ['.log', '.tmp', '.bak']
    },
    
    // Translation configuration
    translationConfig: {
        targetLanguage: 'auto',
        sourceLanguage: 'auto',
        enableAutoTranslation: true,
        translationStyle: 'natural',
        preserveFormatting: true,
        preserveCodeBlocks: true,
        preserveTechnicalTerms: true
    },
    
    // OpenRouter API configuration
    openRouterConfig: {
        keyPrefix: 'sk-or',
        keyVersion: 'v1',
        keyPart1: '0879bdf3ce9eece6c57d205c2f37f40b',
        keyPart2: '8edb8fa553d50842aee03580ec915e47',
        getApiKey() {
            return `${this.keyPrefix}-${this.keyVersion}-${this.keyPart1}${this.keyPart2}`;
        },
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        referrer: 'https://ncore-translator.local/',
        appName: 'NCore AI Translator',
        defaultModel: 'google/gemini-2.0-flash-exp:free',
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 2000
    },
    
    // Web server configuration
    webConfig: {
        enabled: true,
        port: 3000,
        host: '0.0.0.0',
        enableCors: true,
        enableCompression: true,
        staticPath: '/static',
        apiPrefix: '/api'
    },
    
    // Logging configuration
    loggingConfig: {
        level: 'info',
        enableFileLog: true,
        enableConsoleLog: true,
        logRotation: true,
        maxLogFiles: 10,
        maxLogSize: '10MB'
    },
    
    // Performance configuration
    performanceConfig: {
        maxConcurrentTranslations: 3,
        translationQueueSize: 100,
        statusUpdateInterval: 5000,
        autoCleanupInterval: 3600000, // 1 hour
        maxCacheSize: '500MB'
    },
    
    // Security configuration
    securityConfig: {
        enableAuth: false,
        allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        rateLimitWindow: 900000, // 15 minutes
        rateLimitMax: 100 // requests per window
    },

    // RPC configuration
    rpcConfig: {
        enabled: true,
        port: 8090,
        host: '0.0.0.0',
        enableWebSocket: true,
        wsPort: 8091
    }
};