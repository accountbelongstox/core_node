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

const fs = require('fs');
const path = require('path');

const defaultConfig = {
    defaultProvider: process.env.TRANSLATOR_PROVIDER || 'azure',
    azure: {
        endpoint: process.env.AZURE_TRANSLATOR_ENDPOINT || 'api.cognitive.microsofttranslator.com',
        apiKey: process.env.AZURE_TRANSLATOR_KEY || '',
        region: process.env.AZURE_TRANSLATOR_REGION || 'global',
        subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || '',
        resourceGroup: process.env.AZURE_RESOURCE_GROUP || '',
        defaultTargetLanguage: 'zh-Hans',
        apiVersion: '3.0',
        timeout: 10000,
        retryCount: 3,
        retryDelay: 1000
    },
    deepseek: {
        enabled: process.env.DEEPSEEK_ENABLED === 'true' || false,
        modelPath: process.env.DEEPSEEK_MODEL_PATH || 'deepseek-ai/deepseek-vl-1.3b-chat',
        modelDir: process.env.DEEPSEEK_MODEL_DIR || null,
        pythonCommand: process.env.PYTHON_COMMAND || 'python',
        timeout: 30000,
        autoInit: false
    },
    triggerWords: [],
    enableTriggerWords: false,
    triggerWordsMatchMode: 'any',
    supportedLanguages: {
        'zh-Hans': 'Simplified Chinese',
        'zh-Hant': 'Traditional Chinese',
        'en': 'English',
        'ja': 'Japanese',
        'ko': 'Korean',
        'fr': 'French',
        'de': 'German',
        'es': 'Spanish',
        'ru': 'Russian',
        'ar': 'Arabic',
        'pt': 'Portuguese',
        'it': 'Italian'
    },
    codeMarkers: ['code', 'python', 'javascript', 'java', 'cpp', 'c++', 'ruby', 'go', 'rust', 'typescript', 'bash', 'shell', 'sql', 'html', 'css', 'php', 'c#', 'swift', 'kotlin', 'dart'],
    commentPatterns: {
        singleLine: ['#', '//', '--', ';', '%'],
        multiLineStart: ['/*', '"""', "'''", '<!--', '{-', '(*'],
        multiLineEnd: ['*/', '"""', "'''", '-->', '-}', '*)']
    },
    codeBlockMarkers: {
        start: ['```', '~~~', '<code>', '<pre>'],
        end: ['```', '~~~', '</code>', '</pre>']
    },
    bufferTimeout: 5000,
    maxCacheSize: 10000,
    batchSize: 25,
    enableCache: true,
    enableLanguageDetection: true,
    triggerWordsExamples: [
        '翻译',
        '请翻译',
        '帮我翻译',
        'translate',
        'translation needed'
    ]
};

function loadExternalConfig() {
    let externalConfig = {};
    const configPaths = [
        path.join(process.cwd(), 'stream_translator.config.json'),
        path.join(process.cwd(), 'config', 'stream_translator.json'),
        path.join(__dirname, '..', 'config.json')
    ];
    let i;

    for (i = 0; i < configPaths.length; i++) {
        const configPath = configPaths[i];
        try {
            if (fs.existsSync(configPath)) {
                const content = fs.readFileSync(configPath, 'utf-8');
                externalConfig = JSON.parse(content);
                break;
            }
        } catch (error) {
        }
    }

    return externalConfig;
}

const externalConfig = loadExternalConfig();

const config = {
    ...defaultConfig,
    ...externalConfig
};

if (externalConfig.azure) {
    config.azure = {
        ...defaultConfig.azure,
        ...externalConfig.azure
    };
}

module.exports = config;
