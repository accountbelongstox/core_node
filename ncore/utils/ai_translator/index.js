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