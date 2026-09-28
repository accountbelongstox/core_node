const logger = require('#@logger');
const { loadConfig } = require('../config/config_loader');
const BaiduTranslationProvider = require('../providers/baidu');
const MoonshotTranslationProvider = require('../providers/moonshot');
const YoudaoTranslationProvider = require('../providers/youdao');
const NLLB200TranslationProvider = require('../providers/nllb200');

const PROVIDER_MAP = {
  baidu: BaiduTranslationProvider,
  moonshot: MoonshotTranslationProvider,
  youdao: YoudaoTranslationProvider,
  nllb200: NLLB200TranslationProvider,
};

let cachedConfig, cachedProviders;

cachedConfig = null;
cachedProviders = new Map();

function getConfig() {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

function getTranslator(providerName) {
  let Translator, translator, config;

  config = getConfig();

  if (cachedProviders.has(providerName)) {
    return cachedProviders.get(providerName);
  }

  Translator = PROVIDER_MAP[providerName];

  if (!Translator) {
    logger.error('Unsupported translation provider: ' + providerName);
    return null;
  }

  translator = new Translator(providerName, config);
  cachedProviders.set(providerName, translator);

  return translator;
}

async function translate(translationOption, providerName) {
  let config, provider, result;

  config = getConfig();
  provider = providerName || config.defaultProvider;
  const translator = getTranslator(provider);

  if (!translator) {
    return {
      success: false,
      platform: provider,
      error: {
        message: 'Unsupported translation provider: ' + provider,
      },
    };
  }

  result = await translator.translate(translationOption);
  return result;
}

function clearCache() {
  cachedConfig = null;
  cachedProviders.clear();
}

module.exports = {
  translate,
  getTranslator,
  clearCache,
};
