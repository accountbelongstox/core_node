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

const crypto = require('crypto');
const path = require('path');
const ini = require('ini');
const axios = require('axios');
const freader = require('#@freader');
const logger = require('#@logger');
const TranslationProvider = require('../../libs/TranslationProvider');
const utils = require('../../libs/utils');

function truncate(q) {
  const len = q.length;
  if (len <= 20) return q;
  return q.substring(0, 10) + len + q.substring(len - 10, len);
}

class YoudaoTranslationProvider extends TranslationProvider {
  constructor(name, config) {
    super(name, config);
    const languageContent = freader.readFileSync(path.join(__dirname, 'language.ini'), 'utf-8');
    this.languageTable = ini.parse(languageContent);
  }

  async translate(translationOption) {
    let sourceLanguage, targetLanguage, appKey, key, query, salt, curtime, str1, hash, sign, data, response, result;

    sourceLanguage = translationOption.sourceLanguage || 'auto';
    const config = this.config;
    const providerConfig = config.youdao || config[config.defaultProvider];
    const qps = providerConfig.QPS || 5;
    const waitTime = 1000 / qps;

    await utils.sleep(waitTime);

    if (sourceLanguage !== 'auto') {
      sourceLanguage = utils.convertToPlatformLanguageCode(
        sourceLanguage,
        this.languageTable,
        config.language
      );

      if (!sourceLanguage) {
        return {
          success: false,
          platform: 'youdao',
          error: {
            message: 'Unsupported source language',
            text: translationOption.text,
            sourceLanguage: translationOption.sourceLanguage,
            targetLanguage: translationOption.targetLanguage,
          },
        };
      }
    }

    targetLanguage = utils.convertToPlatformLanguageCode(
      translationOption.targetLanguage,
      this.languageTable,
      config.language
    );

    if (!targetLanguage) {
      return {
        success: false,
        platform: 'youdao',
        error: {
          message: 'Unsupported target language',
          text: translationOption.text,
          sourceLanguage: translationOption.sourceLanguage,
          targetLanguage: translationOption.targetLanguage,
        },
      };
    }

    appKey = providerConfig.APP_ID;
    key = providerConfig.APP_SECRET;
    query = translationOption.text;
    salt = new Date().getTime();
    curtime = Math.round(new Date().getTime() / 1000);
    str1 = appKey + truncate(query) + salt + curtime + key;
    hash = crypto.createHash('sha256');
    hash.update(str1);
    sign = hash.digest('hex');

    data = {
      q: query,
      from: sourceLanguage,
      to: targetLanguage,
      appKey: appKey,
      salt: salt,
      sign: sign,
      signType: 'v3',
      curtime: curtime,
    };

    const API_URL = 'https://openapi.youdao.com/api';

    try {
      response = await axios.post(API_URL, data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (response.data.errorCode === '0') {
        result = {
          success: true,
          platform: 'youdao',
          data: {
            text: response.data.translation[0],
            sourceLanguage: response.data.l?.split('2')[0] || sourceLanguage,
            targetLanguage: response.data.l?.split('2')[1] || targetLanguage,
          },
        };
      } else {
        result = {
          success: false,
          platform: 'youdao',
          error: {
            message: `Youdao error code: ${response.data.errorCode}`,
            code: response.data.errorCode,
            text: translationOption.text,
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
          },
        };
      }
    } catch (error) {
      logger.error('Youdao translation error:', error.message);
      result = {
        success: false,
        platform: 'youdao',
        error: {
          message: error.message,
          code: error.response?.status,
          text: translationOption.text,
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage,
        },
      };
    }

    return result;
  }
}

module.exports = YoudaoTranslationProvider;
