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

const AITranslatorMain = require('./main.js');
const FileWatcher = require('./libs/file_watcher.js');
const TranslationManager = require('./libs/translation_manager.js');
const CacheManager = require('./libs/cache_manager.js');
const ParagraphSplitter = require('./libs/paragraph_splitter.js');
const AITranslator = require('./libs/ai_translator.js');

// Create singleton instance
let translatorInstance = null;

function getInstance() {
    if (!translatorInstance) {
        translatorInstance = new AITranslatorMain();
    }
    return translatorInstance;
}

// Main API functions with complete parameter support
async function startTranslation(watchPaths = [], options = {}) {
    const translator = getInstance();
    return await translator.startTranslation(watchPaths, options);
}

// Simplified API for backward compatibility
async function startTranslationSimple(watchPaths = [], targetLanguage = 'auto') {
    return await startTranslation(watchPaths, { targetLanguage });
}

async function stopTranslation() {
    if (translatorInstance) {
        await translatorInstance.stop();
        translatorInstance = null;
    }
}

async function getStatus() {
    if (translatorInstance) {
        return await translatorInstance.getStatus();
    }
    return { isRunning: false, processLock: false };
}

// Utility functions for direct translation
async function translateText(text, targetLanguage = 'auto') {
    return await AITranslator.translate(text, targetLanguage);
}

async function translateBatch(texts, targetLanguage = 'auto') {
    return await AITranslator.translateBatch(texts, targetLanguage);
}

function splitParagraphs(content, options = {}) {
    return ParagraphSplitter.split(content, options);
}

module.exports = {
    // Main translation service with complete parameter support
    startTranslation,
    startTranslationSimple, // Backward compatibility
    stopTranslation,
    getStatus,
    getInstance,
    
    // Direct translation utilities
    translateText,
    translateBatch,
    splitParagraphs,
    
    // Component classes for advanced usage
    AITranslatorMain,
    FileWatcher,
    TranslationManager,
    CacheManager,
    ParagraphSplitter,
    AITranslator
};