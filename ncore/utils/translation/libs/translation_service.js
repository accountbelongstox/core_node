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

const logger = require('#@logger');
const { loadConfig } = require('../config/config_loader');
const BaiduTranslationProvider = require('../providers/baidu');
const MoonshotTranslationProvider = require('../providers/moonshot');
const YoudaoTranslationProvider = require('../providers/youdao');

const PROVIDER_MAP = {
  baidu: BaiduTranslationProvider,
  moonshot: MoonshotTranslationProvider,
  youdao: YoudaoTranslationProvider,
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
