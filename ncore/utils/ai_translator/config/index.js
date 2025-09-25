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
const { DATA_DIR } = require('#@global_dir');

const defaultConfig = {
    // Database and storage paths
    databaseDir: path.join(DATA_DIR, 'ai_translator_db'),
    tempDir: path.join(DATA_DIR, 'ai_translator_temp'),
    
    // File watching settings
    watchSettings: {
        supportedExtensions: ['.md', '.txt', '.str', '.rst', '.adoc'],
        scanInterval: 30000, // 30 seconds
        watchDepth: 10, // Maximum directory depth to watch
        excludePatterns: ['node_modules', '.git', '.cache', '.tmp', '.vscode', '.idea', 'dist', 'build'],
        skipExtensions: ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.php', '.rb', '.go', '.rs', '.kt', '.swift']
    },
    
    // Translation settings
    translationSettings: {
        maxRetries: 3,
        retryDelay: 2000,
        requestTimeout: 30000,
        maxConcurrent: 3,
        defaultTargetLanguage: 'auto' // auto, zh, en, etc.
    },
    
    // Paragraph splitting settings
    paragraphSettings: {
        maxLength: 2000,
        minLength: 50,
        preserveCodeBlocks: true,
        preserveHeaders: true,
        preserveLists: true,
        tokenLimit: 1500
    },
    
    // Cache settings
    cacheSettings: {
        enableCache: true,
        cacheExpireDays: 30,
        autoCleanup: true,
        cleanupInterval: 24 * 60 * 60 * 1000 // 24 hours
    },
    
    // Backup settings
    backupSettings: {
        enableBackup: true,
        backupRetentionDays: 30,
        autoExport: false,
        exportFormat: 'markdown' // markdown, html, txt
    },
    
    // Processing settings
    processingSettings: {
        cycleInterval: 5000, // 5 seconds between processing cycles
        enableProgressTracking: true,
        enableResumeOnRestart: true,
        maxFileSize: 10 * 1024 * 1024 // 10MB max file size
    },
    
    // Language detection settings
    languageSettings: {
        autoDetect: true,
        defaultSourceLanguage: 'auto',
        supportedLanguages: ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru']
    },

    // OpenRouter API settings
    openRouterConfig: {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        referrer: 'https://ncore-translator.local/',
        appName: 'NCore AI Translator',
        defaultModel: 'google/gemini-2.0-flash-exp:free',
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 2000
    },

    // Translation prompt settings
    promptSettings: {
        preserveFormatting: true,
        preserveCodeBlocks: true,
        preserveTechnicalTerms: true,
        translationStyle: 'natural',
        useXMLFormat: true,
        batchSize: 5 // Maximum texts per batch translation
    },
    
    // Logging settings
    loggingSettings: {
        enableDebugLogs: false,
        logLevel: 'info', // debug, info, warn, error
        logTranslationProgress: true,
        logFileOperations: false
    }
};

// Environment-specific overrides
const getEnvironmentConfig = () => {
    const env = process.env.NODE_ENV || 'development';
    
    switch (env) {
        case 'production':
            return {
                loggingSettings: {
                    enableDebugLogs: false,
                    logLevel: 'warn',
                    logTranslationProgress: false,
                    logFileOperations: false
                },
                processingSettings: {
                    cycleInterval: 10000, // Slower in production
                    maxFileSize: 50 * 1024 * 1024 // 50MB in production
                }
            };
            
        case 'development':
            return {
                loggingSettings: {
                    enableDebugLogs: true,
                    logLevel: 'debug',
                    logTranslationProgress: true,
                    logFileOperations: true
                },
                processingSettings: {
                    cycleInterval: 3000, // Faster in development
                    maxFileSize: 5 * 1024 * 1024 // 5MB in development
                }
            };
            
        default:
            return {};
    }
};

// Merge default config with environment-specific config
const mergeConfig = (defaultConfig, envConfig) => {
    const merged = { ...defaultConfig };
    
    for (const [key, value] of Object.entries(envConfig)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            merged[key] = { ...merged[key], ...value };
        } else {
            merged[key] = value;
        }
    }
    
    return merged;
};

const envConfig = getEnvironmentConfig();
const finalConfig = mergeConfig(defaultConfig, envConfig);

// Configuration validation
const validateConfig = (config) => {
    const errors = [];
    
    if (!config.databaseDir || typeof config.databaseDir !== 'string') {
        errors.push('databaseDir must be a valid string path');
    }
    
    if (!config.tempDir || typeof config.tempDir !== 'string') {
        errors.push('tempDir must be a valid string path');
    }
    
    if (!Array.isArray(config.watchSettings.supportedExtensions)) {
        errors.push('watchSettings.supportedExtensions must be an array');
    }
    
    if (config.translationSettings.maxConcurrent < 1 || config.translationSettings.maxConcurrent > 10) {
        errors.push('translationSettings.maxConcurrent must be between 1 and 10');
    }
    
    if (config.paragraphSettings.maxLength < 100) {
        errors.push('paragraphSettings.maxLength must be at least 100');
    }
    
    if (errors.length > 0) {
        throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
    
    return true;
};

// Validate the final configuration
validateConfig(finalConfig);

module.exports = finalConfig;