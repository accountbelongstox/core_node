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
const logger = require('#@logger');
const TranslationProvider = require('../../libs/TranslationProvider');
const deepseekLauncher = require('#@ncore/utils/deepseek_launcher/index.js');

class DeepSeekTranslationProvider extends TranslationProvider {
  constructor(name, config) {
    super(name, config);

    this.deepseekTranslator = null;
    this.isInitialized = false;
    this.launcher = deepseekLauncher.getInstance();
    this.languageTable = {
      language: {
        zh: 'Chinese',
        en: 'English',
        ja: 'Japanese',
        ko: 'Korean',
        fr: 'French',
        de: 'German',
        es: 'Spanish',
        ru: 'Russian',
        ar: 'Arabic',
        pt: 'Portuguese',
        it: 'Italian',
        nl: 'Dutch',
        pl: 'Polish',
        tr: 'Turkish',
        vi: 'Vietnamese',
        th: 'Thai',
        id: 'Indonesian',
        hi: 'Hindi'
      }
    };
  }

  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      const launcherStatus = this.launcher.getStatus();

      if (!launcherStatus.isInstalled) {
        logger.error('DeepSeek-VL is not installed!');
        this.launcher.showInstallationPrompt();
        return false;
      }

      if (!launcherStatus.isValid) {
        logger.error('DeepSeek-VL installation is invalid or corrupted!');
        this.launcher.showInstallationPrompt();
        return false;
      }

      logger.info('DeepSeek-VL installation detected and valid');
      logger.info(`Installation directory: ${launcherStatus.installDirectory}`);
      logger.info(`File count: ${launcherStatus.fileCount}`);

      const DeepSeekTranslator = require('#@ncore/utils/stream_translator/libs/DeepSeekTranslator.js');

      const config = this.config;
      const providerConfig = config.deepseek || {};

      const launcherConfig = this.launcher.getConfig();

      const modelDir = providerConfig.modelDir ||
                       process.env.DEEPSEEK_MODEL_DIR ||
                       launcherConfig.modelDir;

      const modelPath = providerConfig.modelPath ||
                        process.env.DEEPSEEK_MODEL_PATH ||
                        launcherConfig.modelPath;

      const pythonCommand = providerConfig.pythonCommand ||
                            process.env.PYTHON_COMMAND ||
                            launcherConfig.pythonCommand;

      const fullConfig = {
        modelPath: modelPath,
        modelDir: modelDir,
        pythonCommand: pythonCommand,
        timeout: providerConfig.timeout || 30000
      };

      const validation = this.launcher.validateConfiguration(fullConfig);
      if (!validation.valid) {
        logger.error('DeepSeek configuration validation failed:');
        validation.errors.forEach(error => logger.error(`  - ${error}`));
        return false;
      }

      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => logger.warn(`  - ${warning}`));
      }

      this.deepseekTranslator = new DeepSeekTranslator(fullConfig);

      logger.info('Starting DeepSeek model initialization...');
      logger.info(`Model directory: ${modelDir}`);
      logger.info(`Model path: ${modelPath}`);
      logger.info(`Python command: ${pythonCommand}`);

      await this.deepseekTranslator.start();

      this.isInitialized = true;
      logger.info('DeepSeek translation provider initialized successfully');

      return true;
    } catch (error) {
      logger.error(`Failed to initialize DeepSeek provider: ${error.message}`);

      if (error.message.includes('not installed')) {
        this.launcher.showInstallationPrompt();
      } else {
        logger.warn('DeepSeek translation will not be available');
        logger.info('Troubleshooting:');
        logger.info('1. Check if DeepSeek-VL is installed correctly');
        logger.info('2. Verify Python 3.8+ is installed');
        logger.info('3. Check model directory permissions');
      }

      return false;
    }
  }

  async translate(translationOption) {
    if (!this.isInitialized || !this.deepseekTranslator) {
      throw new Error('DeepSeek provider not initialized. Please run initialization first.');
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

    const targetLangName = this.languageTable.language[targetLanguage] || targetLanguage;

    try {
      const translatedText = await this.deepseekTranslator.translate(text, {
        targetLanguage: targetLangName
      });

      result = {
        text: translatedText,
        from: sourceLanguage,
        to: targetLanguage,
        provider: 'deepseek',
        model: this.deepseekTranslator.modelPath
      };

      return result;
    } catch (error) {
      logger.error(`DeepSeek translation error: ${error.message}`);
      throw error;
    }
  }

  async getStatus() {
    if (!this.deepseekTranslator) {
      return {
        initialized: false,
        ready: false,
        message: 'Not initialized'
      };
    }

    const status = this.deepseekTranslator.getStatus();

    return {
      initialized: this.isInitialized,
      ready: status.isReady,
      hasProcess: status.hasProcess,
      pendingRequests: status.pendingRequests,
      modelPath: status.modelPath,
      message: status.isReady ? 'Ready' : 'Not ready'
    };
  }

  async shutdown() {
    if (this.deepseekTranslator) {
      logger.info('Shutting down DeepSeek translator...');
      this.deepseekTranslator.stop();
      this.isInitialized = false;
      this.deepseekTranslator = null;
    }
  }
}

module.exports = DeepSeekTranslationProvider;
