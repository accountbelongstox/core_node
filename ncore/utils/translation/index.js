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

const translationService = require('./libs/translation_service');
const types = require('./types');
const httpService = require('./http_service');
const { loadConfig } = require('./config/config_loader');

async function translate(translationOption, providerName) {
  return await translationService.translate(translationOption, providerName);
}

function getTranslator(providerName) {
  return translationService.getTranslator(providerName);
}

function clearCache() {
  translationService.clearCache();
}

function startHttpService(port) {
  return httpService.startHttpService(port);
}

function stopHttpService() {
  httpService.stopHttpService();
}

function getConfig() {
  return loadConfig();
}

module.exports = {
  translate,
  getTranslator,
  clearCache,
  startHttpService,
  stopHttpService,
  getConfig,
  types,
};
