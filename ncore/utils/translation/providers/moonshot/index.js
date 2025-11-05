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

const path = require('path');
const ini = require('ini');
const axios = require('axios');
const freader = require('#@freader');
const logger = require('#@logger');
const TranslationProvider = require('../../libs/TranslationProvider');
const utils = require('../../libs/utils');

class MoonshotTranslationProvider extends TranslationProvider {
  constructor(name, config) {
    super(name, config);
    const languageContent = freader.readText(path.join(__dirname, 'language.ini'));
    this.languageTable = ini.parse(languageContent);
  }

  async translate(translationOption) {
    let targetLanguageKey, token, model, question, requestBody, response, aiMessage, result;

    const config = this.config;
    const providerConfig = config.moonshot || config[config.defaultProvider];
    const qps = providerConfig.QPS || 1;
    const waitTime = 1000 / qps;

    await utils.sleep(waitTime);

    targetLanguageKey = utils.findKeyInObject(config.language, translationOption.targetLanguage);

    if (!targetLanguageKey) {
      return {
        success: false,
        platform: 'moonshot',
        error: {
          message: 'Unsupported target language',
          text: translationOption.text,
          sourceLanguage: translationOption.sourceLanguage,
          targetLanguage: translationOption.targetLanguage,
        },
      };
    }

    token = providerConfig.Token;
    model = providerConfig.model || 'moonshot-v1-8k';
    question = `Translate the following content to ${targetLanguageKey}, only provide the translation without the original text:
------
${translationOption.text}
------
`;

    requestBody = {
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a multilingual expert and language specialist, capable of accurately understanding and expressing multiple languages, including but not limited to English, Chinese, Spanish, Arabic, and other major world languages. You now work as a simultaneous interpreter.',
        },
        { role: 'user', content: question },
      ],
      temperature: 0.3,
    };

    const moonshotApiUrl = 'https://api.moonshot.cn/v1/chat/completions';

    try {
      response = await axios.post(moonshotApiUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      aiMessage = response.data.choices?.[0]?.message?.content;

      if (aiMessage) {
        aiMessage = aiMessage.replace(/------------/g, '').trim();

        result = {
          success: true,
          platform: 'moonshot',
          data: {
            text: aiMessage,
            sourceLanguage: translationOption.sourceLanguage || 'auto',
            targetLanguage: translationOption.targetLanguage,
            usage: response.data.usage,
          },
        };
      } else {
        result = {
          success: false,
          platform: 'moonshot',
          error: {
            message: 'Moonshot translation failed',
            text: translationOption.text,
            sourceLanguage: translationOption.sourceLanguage,
            targetLanguage: translationOption.targetLanguage,
          },
        };
      }
    } catch (error) {
      logger.error('Moonshot translation error:', error.message);
      result = {
        success: false,
        platform: 'moonshot',
        error: {
          message: error.response?.data?.error?.message || error.message,
          code: error.response?.status,
          text: translationOption.text,
          sourceLanguage: translationOption.sourceLanguage,
          targetLanguage: translationOption.targetLanguage,
        },
      };
    }

    return result;
  }
}

module.exports = MoonshotTranslationProvider;
