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
