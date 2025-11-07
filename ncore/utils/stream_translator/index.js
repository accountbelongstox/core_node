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

const StreamTranslatorManager = require('./libs/StreamTranslatorManager.js');
const SentenceBuffer = require('./libs/SentenceBuffer.js');
const CodeDetector = require('./libs/CodeDetector.js');
const TranslatorAPI = require('./libs/TranslatorAPI.js');
const ConfigHelper = require('./libs/ConfigHelper.js');
const TriggerWordsDetector = require('./libs/TriggerWordsDetector.js');
const ModelInitializer = require('./libs/ModelInitializer.js');
const CommandExecutor = require('./libs/CommandExecutor.js');
const DeepSeekTranslator = require('./libs/DeepSeekTranslator.js');

let managerInstance = null;

function getInstance() {
    if (!managerInstance) {
        managerInstance = new StreamTranslatorManager();
    }
    return managerInstance;
}

function appendData(id, chunk) {
    const manager = getInstance();
    return manager.appendData(id, chunk);
}

function flushSession(id) {
    const manager = getInstance();
    return manager.flushSession(id);
}

function getFullText(id) {
    const manager = getInstance();
    return manager.getFullText(id);
}

function getTranslationMap(id) {
    const manager = getInstance();
    return manager.getTranslationMap(id);
}

function getStreamOutput(id) {
    const manager = getInstance();
    return manager.getStreamOutput(id);
}

function hasUnprocessed(id) {
    const manager = getInstance();
    return manager.hasUnprocessed(id);
}

function getSessionInfo(id) {
    const manager = getInstance();
    return manager.getSessionInfo(id);
}

function getAllSessions() {
    const manager = getInstance();
    return manager.getAllSessions();
}

function clearSession(id) {
    const manager = getInstance();
    return manager.clearSession(id);
}

function clearAllSessions() {
    const manager = getInstance();
    return manager.clearAllSessions();
}

function setTranslationProvider(provider, options = {}) {
    const manager = getInstance();
    return manager.setTranslationProvider(provider, options);
}

async function initDeepSeek(options = {}) {
    const manager = getInstance();
    if (manager.translatorAPI) {
        return await manager.translatorAPI.initDeepSeek();
    }
    return false;
}

function getDeepSeekStatus() {
    const manager = getInstance();
    if (manager.translatorAPI) {
        return manager.translatorAPI.getDeepSeekStatus();
    }
    return { isReady: false, message: 'Translator not initialized' };
}

function onTranslationReady(callback) {
    const manager = getInstance();
    manager.on('translationReady', callback);
}

function checkConfig() {
    return ConfigHelper.checkAzureConfig();
}

function printSetupInstructions() {
    return ConfigHelper.printSetupInstructions();
}

function getSupportedLanguages() {
    return ConfigHelper.getSupportedLanguages();
}

function printSupportedLanguages() {
    return ConfigHelper.printSupportedLanguages();
}

function getConfigSummary() {
    return ConfigHelper.getConfigSummary();
}

function printConfigSummary() {
    return ConfigHelper.printConfigSummary();
}

function setTriggerWords(id, words) {
    const manager = getInstance();
    return manager.setTriggerWords(id, words);
}

function addTriggerWord(id, word) {
    const manager = getInstance();
    return manager.addTriggerWord(id, word);
}

function enableTriggerWords(id) {
    const manager = getInstance();
    return manager.enableTriggerWords(id);
}

function disableTriggerWords(id) {
    const manager = getInstance();
    return manager.disableTriggerWords(id);
}

function getTriggerWordsStatus(id) {
    const manager = getInstance();
    return manager.getTriggerWordsStatus(id);
}

module.exports = {
    getInstance,
    appendData,
    flushSession,
    getFullText,
    getTranslationMap,
    getStreamOutput,
    hasUnprocessed,
    getSessionInfo,
    getAllSessions,
    clearSession,
    clearAllSessions,
    setTranslationProvider,
    onTranslationReady,

    checkConfig,
    printSetupInstructions,
    getSupportedLanguages,
    printSupportedLanguages,
    getConfigSummary,
    printConfigSummary,

    setTriggerWords,
    addTriggerWord,
    enableTriggerWords,
    disableTriggerWords,
    getTriggerWordsStatus,

    initDeepSeek,
    getDeepSeekStatus,

    StreamTranslatorManager,
    SentenceBuffer,
    CodeDetector,
    TranslatorAPI,
    ConfigHelper,
    TriggerWordsDetector,
    ModelInitializer,
    CommandExecutor,
    DeepSeekTranslator
};
