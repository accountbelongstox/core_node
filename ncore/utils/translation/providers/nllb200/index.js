const path = require('path');
const logger = require('#@logger');
const TranslationProvider = require('../../libs/TranslationProvider');
const { getInstance: getPythonBridge } = require('#@python_bridge');

class NLLB200TranslationProvider extends TranslationProvider {
  constructor(name, config) {
    super(name, config);

    this.isInitialized = false;
    this.modelName = 'facebook/nllb-200-distilled-600M';
    this.translatorScriptPath = null;
    this.languageTable = {
      language: {
        zh: 'zho_Hans',
        'zh-CN': 'zho_Hans',
        'zh-TW': 'zho_Hant',
        en: 'eng_Latn',
        ja: 'jpn_Jpan',
        ko: 'kor_Hang',
        fr: 'fra_Latn',
        de: 'deu_Latn',
        es: 'spa_Latn',
        ru: 'rus_Cyrl',
        ar: 'ara_Arab',
        pt: 'por_Latn',
        it: 'ita_Latn',
        nl: 'nld_Latn',
        pl: 'pol_Latn',
        tr: 'tur_Latn',
        vi: 'vie_Latn',
        th: 'tha_Thai',
        hi: 'hin_Deva',
        uk: 'ukr_Cyrl',
        sv: 'swe_Latn'
      }
    };
  }

  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      const coreNodeRoot = path.resolve(__dirname, '../../../../..');
      this.translatorScriptPath = path.join(
        coreNodeRoot,
        'scripts',
        'pytools',
        'aitools',
        'nllb200_translator.py'
      );

      const fs = require('fs');
      if (!fs.existsSync(this.translatorScriptPath)) {
        logger.error(`NLLB-200 translator script not found: ${this.translatorScriptPath}`);
        logger.error('Please run Step98_InstallNLLB200.ps1 to install NLLB-200');
        return false;
      }

      const pythonBridge = getPythonBridge();
      const pythonAvailable = await pythonBridge.checkPythonAvailable();
      if (!pythonAvailable) {
        logger.error('Python is not available');
        logger.error('NLLB-200 requires Python 3.8+ with transformers');
        return false;
      }

      logger.info('NLLB-200 translation provider initialized');
      logger.info(`Model: ${this.modelName}`);
      logger.info(`Script: ${this.translatorScriptPath}`);

      const modelAvailable = await pythonBridge.checkModelAvailable(this.modelName);
      if (modelAvailable) {
        logger.info('NLLB-200 model is cached locally');
      } else {
        logger.warn('NLLB-200 model not cached, first translation will download model');
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      logger.error(`Failed to initialize NLLB-200 provider: ${error.message}`);
      return false;
    }
  }

  async translate(translationOption) {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('NLLB-200 provider initialization failed');
      }
    }

    let sourceLanguage, targetLanguage, text, result;

    sourceLanguage = translationOption.sourceLanguage || translationOption.from || 'auto';
    targetLanguage = translationOption.targetLanguage || translationOption.to;
    text = translationOption.text;

    if (!text) {
      throw new Error('Text is required for translation');
    }

    if (!targetLanguage) {
      throw new Error('Target language is required');
    }

    try {
      logger.info(`Translating with NLLB-200: ${sourceLanguage} -> ${targetLanguage}`);

      const pythonBridge = getPythonBridge();
      const pythonResult = await pythonBridge.callWithModel(this.translatorScriptPath, {
        text: text,
        source_lang: sourceLanguage,
        target_lang: targetLanguage,
        model_name: this.modelName
      }, {
        timeout: 120000,
        onProgress: (progress) => {
          logger.info(`Model loading/translation progress: ${progress}%`);
        }
      });

      const translationResult = JSON.parse(pythonResult.stdout);

      if (!translationResult.success) {
        throw new Error(translationResult.error || 'Translation failed');
      }

      result = {
        text: translationResult.translation,
        from: translationResult.source_lang,
        to: translationResult.target_lang,
        provider: 'nllb200',
        model: translationResult.model
      };

      return result;
    } catch (error) {
      logger.error(`NLLB-200 translation error: ${error.message}`);
      throw error;
    }
  }

  async batchTranslate(translationOptions, options = {}) {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('NLLB-200 provider initialization failed');
      }
    }

    logger.info(`Batch translating ${translationOptions.length} items with NLLB-200`);

    const batchParams = translationOptions.map(option => ({
      text: option.text,
      source_lang: option.sourceLanguage || option.from || 'auto',
      target_lang: option.targetLanguage || option.to,
      model_name: this.modelName
    }));

    try {
      const pythonBridge = getPythonBridge();
      const results = await pythonBridge.batchCall(
        this.translatorScriptPath,
        batchParams,
        {
          batchSize: options.batchSize || 3,
          timeout: options.timeout || 120000
        }
      );

      return results.map(pythonResult => {
        const translationResult = JSON.parse(pythonResult.stdout);

        if (!translationResult.success) {
          return {
            success: false,
            error: translationResult.error || 'Translation failed'
          };
        }

        return {
          success: true,
          text: translationResult.translation,
          from: translationResult.source_lang,
          to: translationResult.target_lang,
          provider: 'nllb200',
          model: translationResult.model
        };
      });
    } catch (error) {
      logger.error(`NLLB-200 batch translation error: ${error.message}`);
      throw error;
    }
  }

  async getStatus() {
    return {
      initialized: this.isInitialized,
      ready: this.isInitialized,
      model: this.modelName,
      scriptPath: this.translatorScriptPath,
      message: this.isInitialized ? 'Ready' : 'Not initialized'
    };
  }

  async getModelInfo() {
    if (!this.isInitialized) {
      throw new Error('NLLB-200 provider not initialized');
    }

    try {
      const pythonBridge = getPythonBridge();
      const modelInfo = await pythonBridge.getModelInfo(this.modelName);
      return modelInfo;
    } catch (error) {
      logger.error(`Failed to get model info: ${error.message}`);
      throw error;
    }
  }

  async clearCache() {
    try {
      const pythonBridge = getPythonBridge();
      const result = await pythonBridge.clearModelCache(this.modelName);
      logger.info(result.message || 'Cache cleared');
      return result;
    } catch (error) {
      logger.error(`Failed to clear cache: ${error.message}`);
      throw error;
    }
  }

  async shutdown() {
    logger.info('NLLB-200 provider shutdown');
    this.isInitialized = false;
  }
}

module.exports = NLLB200TranslationProvider;
