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

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

let secretIgnoreDir, isLoaded;

isLoaded = false;
secretIgnoreDir = null;

function getSecretIgnoreDir() {
  if (secretIgnoreDir) {
    return secretIgnoreDir;
  }

  const coreNodeDir = path.resolve(__dirname, '../../..');
  secretIgnoreDir = path.join(coreNodeDir, '.secret_keys', '.secret_ignore');

  return secretIgnoreDir;
}

function loadSecretsToEnv() {
  let dir, files, loadedCount, file, filePath, keyName, secretValue;

  if (isLoaded) {
    logger.info('Secrets already loaded to environment');
    return loadedCount;
  }

  dir = getSecretIgnoreDir();

  if (!fs.existsSync(dir)) {
    logger.warn('Secret ignore directory not found: ' + dir);
    return 0;
  }

  try {
    files = fs.readdirSync(dir);
  } catch (error) {
    logger.error('Failed to read secret directory: ' + error.message);
    return 0;
  }

  loadedCount = 0;

  for (let i = 0; i < files.length; i++) {
    file = files[i];

    if (file.startsWith('.')) {
      continue;
    }

    filePath = path.join(dir, file);

    try {
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        continue;
      }

      keyName = file;
      secretValue = fs.readFileSync(filePath, 'utf8').trim();

      if (secretValue) {
        process.env[keyName] = secretValue;
        loadedCount++;
        logger.info('Loaded secret to env: ' + keyName);
      }
    } catch (error) {
      logger.warn('Failed to load secret ' + file + ': ' + error.message);
    }
  }

  isLoaded = true;
  logger.info('Successfully loaded ' + loadedCount + ' secrets to environment');

  return loadedCount;
}

function unloadSecretsFromEnv() {
  let dir, files, unloadedCount, file, keyName;

  if (!isLoaded) {
    return 0;
  }

  dir = getSecretIgnoreDir();

  if (!fs.existsSync(dir)) {
    return 0;
  }

  try {
    files = fs.readdirSync(dir);
  } catch (error) {
    return 0;
  }

  unloadedCount = 0;

  for (let i = 0; i < files.length; i++) {
    file = files[i];

    if (file.startsWith('.')) {
      continue;
    }

    keyName = file;

    if (process.env[keyName]) {
      delete process.env[keyName];
      unloadedCount++;
    }
  }

  isLoaded = false;
  logger.info('Unloaded ' + unloadedCount + ' secrets from environment');

  return unloadedCount;
}

module.exports = {
  loadSecretsToEnv,
  unloadSecretsFromEnv,
  getSecretIgnoreDir,
};
