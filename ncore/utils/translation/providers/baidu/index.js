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

class BaiduTranslationProvider extends TranslationProvider {
  constructor(name, config) {
    super(name, config);
    const languageContent = freader.readFileSync(path.join(__dirname, 'language.ini'), 'utf-8');
    this.languageTable = ini.parse(languageContent);
  }

  async translate(translationOption) {
    let sourceLanguage, targetLanguage, appId, key, query, salt, str1, sign, data, response, result;

    sourceLanguage = translationOption.sourceLanguage || 'auto';
    const config = this.config;
    const providerConfig = config.baidu || config[config.defaultProvider];
    const qps = providerConfig.QPS || 10;
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
          platform: 'baidu',
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
        platform: 'baidu',
        error: {
          message: 'Unsupported target language',
          text: translationOption.text,
          sourceLanguage: translationOption.sourceLanguage,
          targetLanguage: translationOption.targetLanguage,
        },
      };
    }

    appId = providerConfig.APP_ID;
    key = providerConfig.SECRET;
    query = translationOption.text;
    salt = new Date().getTime();
    str1 = `${appId}${query}${salt}${key}`;
    sign = crypto.createHash('md5').update(str1).digest('hex');

    data = {
      q: query,
      appid: appId,
      salt: salt,
      from: sourceLanguage,
      to: targetLanguage,
      sign: sign,
    };

    const API_URL = 'https://fanyi-api.baidu.com/api/trans/vip/translate';

    try {
      response = await axios.post(API_URL, data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (response.data.trans_result) {
        result = {
          success: true,
          platform: 'baidu',
          data: {
            text: response.data.trans_result[0].dst,
            sourceLanguage: response.data.from,
            targetLanguage: response.data.to,
          },
        };
      } else {
        result = {
          success: false,
          platform: 'baidu',
          error: {
            message: response.data.error_msg || 'Translation failed',
            code: response.data.error_code,
            text: translationOption.text,
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
          },
        };
      }
    } catch (error) {
      logger.error('Baidu translation error:', error.message);
      result = {
        success: false,
        platform: 'baidu',
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

module.exports = BaiduTranslationProvider;
