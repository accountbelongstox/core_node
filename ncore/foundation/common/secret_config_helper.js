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

const secretManager = require('./secret_manager');
const logger = require('./logger');

let defaultPassword;

defaultPassword = process.env.SECRET_PASSWORD || null;

function setDefaultPassword(password) {
  defaultPassword = password;
}

function getSecretOrEnv(keyName, envVarName, defaultValue) {
  let secretValue, envValue;

  defaultValue = defaultValue || null;

  if (process.env[envVarName]) {
    return process.env[envVarName];
  }

  if (secretManager.hasSecretKey(keyName)) {
    secretValue = secretManager.getSecretKey(keyName, defaultPassword);
    if (secretValue) {
      return secretValue;
    }
  }

  envValue = process.env[envVarName];
  if (envValue) {
    return envValue;
  }

  return defaultValue;
}

function loadConfigWithSecrets(configTemplate, password) {
  let key, value, keyName, secretValue, result;

  result = {};
  password = password || defaultPassword;

  for (key in configTemplate) {
    value = configTemplate[key];

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = loadConfigWithSecrets(value, password);
    } else if (typeof value === 'string' && value.startsWith('SECRET:')) {
      keyName = value.substring(7).trim();
      secretValue = secretManager.getSecretKey(keyName, password);

      if (secretValue) {
        result[key] = secretValue;
      } else {
        logger.warn(`Failed to load secret key: ${keyName}, using default value`);
        result[key] = null;
      }
    } else if (typeof value === 'string' && value.startsWith('ENV:')) {
      const envVar = value.substring(4).trim();
      result[key] = process.env[envVar] || null;
    } else if (typeof value === 'string' && value.startsWith('SECRET_OR_ENV:')) {
      const parts = value.substring(14).trim().split('|');
      const secretKey = parts[0];
      const envVar = parts[1] || secretKey;
      result[key] = getSecretOrEnv(secretKey, envVar);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function createSecureConfig(configObject, secretMappings, password) {
  let key, mapping, secretKey, envVar, result;

  result = { ...configObject };
  password = password || defaultPassword;

  for (key in secretMappings) {
    mapping = secretMappings[key];

    if (typeof mapping === 'string') {
      secretKey = mapping;
      envVar = mapping;
    } else if (typeof mapping === 'object') {
      secretKey = mapping.secretKey;
      envVar = mapping.envVar || secretKey;
    } else {
      continue;
    }

    result[key] = getSecretOrEnv(secretKey, envVar, result[key]);
  }

  return result;
}

module.exports = {
  setDefaultPassword,
  getSecretOrEnv,
  loadConfigWithSecrets,
  createSecureConfig,
};
