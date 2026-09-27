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

function startHttpService(port, host) {
  return httpService.startHttpService(port, host);
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
