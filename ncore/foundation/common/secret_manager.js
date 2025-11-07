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
const crypto = require('crypto');
const zlib = require('zlib');
const logger = require('./logger');

let secretKeysCache, secretKeysDir, encryptedDir, rawDir, isProduction;

secretKeysCache = new Map();
secretKeysDir = null;
encryptedDir = null;
rawDir = null;
isProduction = process.env.NODE_ENV === 'production' || process.env.IS_PRODUCTION === 'true';

function initializeDirectories() {
  let coreNodeDir;

  if (secretKeysDir) {
    return;
  }

  coreNodeDir = path.resolve(__dirname, '../../..');
  secretKeysDir = path.join(coreNodeDir, '.secret_keys');
  encryptedDir = path.join(secretKeysDir, 'already_encrypted');
  rawDir = path.join(secretKeysDir, '.secret_ignore');

  if (!fs.existsSync(secretKeysDir)) {
    logger.warn('Secret keys directory not found: ' + secretKeysDir);
  }

  if (!fs.existsSync(encryptedDir)) {
    logger.warn('Encrypted directory not found: ' + encryptedDir);
  }
}

function deobfuscateParams(obfuscatedData, paramsKey, paramsIv) {
  let decipher, decrypted;

  decipher = crypto.createDecipheriv('aes-256-cbc', paramsKey, paramsIv);
  decrypted = Buffer.concat([decipher.update(obfuscatedData), decipher.final()]);

  return JSON.parse(decrypted.toString());
}

function deriveKey(password, salt, pepper, params) {
  let pepperedPassword, key1, key2;

  pepperedPassword = Buffer.concat([Buffer.from(password), pepper]);
  key1 = crypto.pbkdf2Sync(pepperedPassword, salt, params.iterations, params.keyLength, 'sha512');
  key2 = crypto.pbkdf2Sync(key1, salt, params.iterations / 2, params.keyLength, 'sha512');

  return key2;
}

function decryptEncryptedFile(encryptedFilePath, password) {
  let encryptedContent, code, ENCRYPTED_DATA, OBFUSCATED_PARAMS, PARAMS_KEY, PARAMS_IV;
  let params, salt, iv, authTag, pepper, key, decipher, decrypted;

  encryptedContent = fs.readFileSync(encryptedFilePath, 'utf8');

  code = encryptedContent
    .replace(/^[\s\S]*?const ENCRYPTED_DATA = /, 'ENCRYPTED_DATA = ')
    .replace(/;[\s\S]*$/, '');

  try {
    eval(code);

    ENCRYPTED_DATA = Buffer.from(ENCRYPTED_DATA, 'base64');
    OBFUSCATED_PARAMS = Buffer.from(OBFUSCATED_PARAMS, 'base64');
    PARAMS_KEY = Buffer.from(PARAMS_KEY, 'base64');
    PARAMS_IV = Buffer.from(PARAMS_IV, 'base64');
  } catch (error) {
    logger.error('Failed to extract encrypted data from file: ' + error.message);
    return null;
  }

  params = deobfuscateParams(OBFUSCATED_PARAMS, PARAMS_KEY, PARAMS_IV);
  salt = Buffer.from(params.salt, 'base64');
  iv = Buffer.from(params.iv, 'base64');
  authTag = Buffer.from(params.authTag, 'base64');
  pepper = Buffer.from(params.pepper, 'base64');

  key = deriveKey(password, salt, pepper, params);

  try {
    decipher = crypto.createDecipheriv(params.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    decrypted = Buffer.concat([decipher.update(ENCRYPTED_DATA), decipher.final()]);
    decrypted = zlib.inflateSync(decrypted);

    return decrypted.toString('utf8');
  } catch (error) {
    logger.error('Failed to decrypt file (wrong password?): ' + error.message);
    return null;
  }
}

function getSecretKey(keyName, password) {
  let encryptedFile, rawFile, content;

  initializeDirectories();

  if (secretKeysCache.has(keyName)) {
    return secretKeysCache.get(keyName);
  }

  encryptedFile = path.join(encryptedDir, keyName + '.js');

  if (!fs.existsSync(encryptedFile)) {
    const encryptedFileUpper = path.join(encryptedDir, keyName + '.JS');
    if (fs.existsSync(encryptedFileUpper)) {
      encryptedFile = encryptedFileUpper;
    } else {
      logger.error('Secret key not found: ' + keyName);
      return null;
    }
  }

  if (!isProduction) {
    rawFile = path.join(rawDir, keyName);

    if (fs.existsSync(rawFile)) {
      try {
        content = fs.readFileSync(rawFile, 'utf8').trim();
        if (content) {
          secretKeysCache.set(keyName, content);
          return content;
        }
      } catch (error) {
        logger.warn('Failed to read cached secret: ' + error.message);
      }
    }
  }

  if (!password) {
    logger.error('Password is required to decrypt secret key: ' + keyName);
    return null;
  }

  content = decryptEncryptedFile(encryptedFile, password);

  if (content) {
    if (!isProduction) {
      secretKeysCache.set(keyName, content);

      try {
        if (!fs.existsSync(rawDir)) {
          fs.mkdirSync(rawDir, { recursive: true });
        }
        fs.writeFileSync(rawFile, content, 'utf8');
      } catch (error) {
        logger.warn('Failed to cache decrypted secret: ' + error.message);
      }
    }

    return content;
  }

  return null;
}

function getAllSecretKeys(password) {
  let encryptedFiles, keys;

  initializeDirectories();
  keys = {};

  if (!fs.existsSync(encryptedDir)) {
    logger.error('Encrypted directory not found: ' + encryptedDir);
    return keys;
  }

  try {
    encryptedFiles = fs.readdirSync(encryptedDir).filter((file) => {
      return file.endsWith('.js') || file.endsWith('.JS');
    });
  } catch (error) {
    logger.error('Failed to read encrypted directory: ' + error.message);
    return keys;
  }

  for (let i = 0; i < encryptedFiles.length; i++) {
    const file = encryptedFiles[i];
    const keyName = file.replace(/\.(js|JS)$/, '');
    const value = getSecretKey(keyName, password);

    if (value) {
      keys[keyName] = value;
    }
  }

  return keys;
}

function clearCache() {
  secretKeysCache.clear();
}

function hasSecretKey(keyName) {
  let encryptedFile;

  initializeDirectories();
  encryptedFile = path.join(encryptedDir, keyName + '.js');

  if (fs.existsSync(encryptedFile)) {
    return true;
  }

  const encryptedFileUpper = path.join(encryptedDir, keyName + '.JS');
  return fs.existsSync(encryptedFileUpper);
}

module.exports = {
  getSecretKey,
  getAllSecretKeys,
  clearCache,
  hasSecretKey,
};
