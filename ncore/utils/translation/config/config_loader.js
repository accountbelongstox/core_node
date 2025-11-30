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

const ini = require('ini');
const path = require('path');
const freader = require('#@freader');
const logger = require('#@logger');
const secretManager = require('#@secret_manager');

let cachedConfig, secretPassword;

cachedConfig = null;
secretPassword = process.env.SECRET_PASSWORD || null;

function resolveSecretValues(config) {
  let key, section, subKey, value, secretKeyName, secretValue;

  for (key in config) {
    if (typeof config[key] === 'string') {
      if (config[key].startsWith('SECRET:')) {
        secretKeyName = config[key].substring(7).trim();
        secretValue = secretManager.getSecretKey(secretKeyName, secretPassword);
        if (secretValue) {
          config[key] = secretValue;
          logger.info(`Loaded secret key: ${secretKeyName}`);
        } else {
          logger.warn(`Failed to load secret key: ${secretKeyName}`);
        }
      }
    } else if (typeof config[key] === 'object' && config[key] !== null) {
      section = config[key];
      for (subKey in section) {
        value = section[subKey];
        if (typeof value === 'string' && value.startsWith('SECRET:')) {
          secretKeyName = value.substring(7).trim();
          secretValue = secretManager.getSecretKey(secretKeyName, secretPassword);
          if (secretValue) {
            section[subKey] = secretValue;
            logger.info(`Loaded secret key: ${secretKeyName} for ${key}.${subKey}`);
          } else {
            logger.warn(`Failed to load secret key: ${secretKeyName} for ${key}.${subKey}`);
          }
        }
      }
    }
  }

  return config;
}

function loadConfig(password) {
  let defaultContent, envContent, defaultConfig, envConfig, mergedConfig;

  if (cachedConfig && !password) {
    return cachedConfig;
  }

  if (password) {
    secretPassword = password;
  }

  defaultContent = freader.readText(path.join(__dirname, 'default.ini'));
  defaultConfig = ini.parse(defaultContent);

  if (!['dev', 'prod', 'development', 'production'].includes(defaultConfig.environment)) {
    logger.error('Invalid environment: ' + defaultConfig.environment);
    defaultConfig.environment = 'prod';
  }

  if (defaultConfig.environment === 'development') {
    defaultConfig.environment = 'dev';
  }

  if (defaultConfig.environment === 'production') {
    defaultConfig.environment = 'prod';
  }

  const envFile = `${defaultConfig.environment}.ini`;
  envContent = freader.readText(path.join(__dirname, envFile));
  envConfig = ini.parse(envContent);
  mergedConfig = { ...defaultConfig, ...envConfig };

  mergedConfig = resolveSecretValues(mergedConfig);

  if (!password) {
    cachedConfig = mergedConfig;
  }

  return mergedConfig;
}

function clearCache() {
  cachedConfig = null;
}

module.exports = {
  loadConfig,
  clearCache,
};
