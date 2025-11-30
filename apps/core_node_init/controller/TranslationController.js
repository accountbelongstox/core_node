// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const logger = require('#@logger');
const translationService = require('#@ncore/utils/translation/index.js');

class TranslationController {
    constructor() {
        this.name = 'TranslationController';
        this.version = '1.0.0';
        this.initialized = false;
        this.translationService = translationService;
    }

    async initialize() {
        if (this.initialized) {
            logger.warn('TranslationController already initialized');
            return this;
        }

        try {
            logger.info('Initializing TranslationController...');

            const config = this.translationService.getConfig();
            logger.info(`Translation service config loaded with ${Object.keys(config.providers || {}).length} providers`);

            this.initialized = true;
            logger.info('TranslationController initialized successfully');
            return this;
        } catch (error) {
            logger.error(`Failed to initialize TranslationController: ${error.message}`);
            throw error;
        }
    }

    registerWebSocketRoutes(wsRpcServer) {
        if (!wsRpcServer) {
            logger.warn('WebSocket RPC server not available for translation routes');
            return;
        }

        logger.info('Registering translation WebSocket routes...');

        wsRpcServer.route('translation.translate', async (params) => {
            return await this.handleTranslate(params);
        });

        wsRpcServer.route('translation.detect', async (params) => {
            return await this.handleDetectLanguage(params);
        });

        wsRpcServer.route('translation.providers', async () => {
            return await this.handleGetProviders();
        });

        wsRpcServer.route('translation.config', async () => {
            return await this.handleGetConfig();
        });

        wsRpcServer.route('translation.cache.clear', async () => {
            return await this.handleClearCache();
        });

        wsRpcServer.route('translation.deepseek.init', async () => {
            return await this.handleInitDeepSeek();
        });

        wsRpcServer.route('translation.deepseek.status', async () => {
            return await this.handleDeepSeekStatus();
        });

        logger.info('Translation WebSocket routes registered successfully');
    }

    async handleTranslate(params) {
        try {
            const startTime = Date.now();
            const text = params.text;
            const sourceLang = params.sourceLang || 'auto';
            const targetLang = params.targetLang;
            const provider = params.provider;

            if (!text) {
                return {
                    success: false,
                    error: 'Text is required',
                    code: 'MISSING_TEXT'
                };
            }

            if (!targetLang) {
                return {
                    success: false,
                    error: 'Target language is required',
                    code: 'MISSING_TARGET_LANG'
                };
            }

            const translationOption = {
                text: text,
                from: sourceLang,
                to: targetLang
            };

            const result = await this.translationService.translate(translationOption, provider);

            return {
                success: true,
                data: {
                    originalText: text,
                    translatedText: result.text || result,
                    sourceLang: result.from || sourceLang,
                    targetLang: targetLang,
                    provider: provider || 'default',
                    detectedLanguage: result.from,
                    pronunciation: result.pronunciation
                },
                executionTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`Translation error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                code: 'TRANSLATION_ERROR',
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleDetectLanguage(params) {
        try {
            const text = params.text;

            if (!text) {
                return {
                    success: false,
                    error: 'Text is required',
                    code: 'MISSING_TEXT'
                };
            }

            const translationOption = {
                text: text,
                from: 'auto',
                to: 'en'
            };

            const result = await this.translationService.translate(translationOption);

            return {
                success: true,
                data: {
                    detectedLanguage: result.from,
                    text: text,
                    confidence: result.confidence || null
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`Language detection error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                code: 'DETECTION_ERROR',
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleGetProviders() {
        try {
            const config = this.translationService.getConfig();

            return {
                success: true,
                data: {
                    providers: config.providers || {},
                    defaultProvider: config.defaultProvider || 'google',
                    availableLanguages: config.languages || {}
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`Get providers error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                code: 'GET_PROVIDERS_ERROR',
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleGetConfig() {
        try {
            const config = this.translationService.getConfig();

            return {
                success: true,
                data: config,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`Get config error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                code: 'GET_CONFIG_ERROR',
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleClearCache() {
        try {
            this.translationService.clearCache();

            return {
                success: true,
                message: 'Translation cache cleared successfully',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`Clear cache error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                code: 'CLEAR_CACHE_ERROR',
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleInitDeepSeek() {
        try {
            logger.info('Initializing DeepSeek translation provider...');

            const DeepSeekProvider = require('#@ncore/utils/translation/providers/deepseek/index.js');
            const config = this.translationService.getConfig();

            const deepseekProvider = new DeepSeekProvider('deepseek', config);
            const initialized = await deepseekProvider.initialize();

            if (initialized) {
                return {
                    success: true,
                    message: 'DeepSeek translation provider initialized successfully',
                    modelPath: config.deepseek?.modelPath || 'deepseek-ai/deepseek-vl-1.3b-chat',
                    modelDir: config.deepseek?.modelDir || 'D:\\programing\\DeepSeek-VL',
                    timestamp: new Date().toISOString()
                };
            } else {
                return {
                    success: false,
                    error: 'Failed to initialize DeepSeek provider',
                    code: 'DEEPSEEK_INIT_FAILED',
                    message: 'Please run: node ncore/utils/stream_translator/init_deepseek.js',
                    timestamp: new Date().toISOString()
                };
            }
        } catch (error) {
            logger.error(`DeepSeek initialization error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                code: 'DEEPSEEK_INIT_ERROR',
                message: 'Failed to initialize DeepSeek. Make sure the model is installed.',
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleDeepSeekStatus() {
        try {
            const DeepSeekProvider = require('#@ncore/utils/translation/providers/deepseek/index.js');
            const config = this.translationService.getConfig();

            const deepseekProvider = new DeepSeekProvider('deepseek', config);
            const status = await deepseekProvider.getStatus();

            return {
                success: true,
                data: {
                    ...status,
                    modelDir: config.deepseek?.modelDir || 'D:\\programing\\DeepSeek-VL',
                    modelPath: config.deepseek?.modelPath || 'deepseek-ai/deepseek-vl-1.3b-chat'
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`Get DeepSeek status error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                code: 'DEEPSEEK_STATUS_ERROR',
                timestamp: new Date().toISOString()
            };
        }
    }

    getStatus() {
        return {
            initialized: this.initialized,
            name: this.name,
            version: this.version,
            hasTranslationService: !!this.translationService,
            timestamp: new Date().toISOString()
        };
    }

    async shutdown() {
        try {
            logger.info('Shutting down TranslationController...');

            if (this.translationService && this.translationService.stopHttpService) {
                this.translationService.stopHttpService();
            }

            this.initialized = false;
            logger.info('TranslationController shutdown completed');
        } catch (error) {
            logger.error(`Error during TranslationController shutdown: ${error.message}`);
        }
    }

    static async create() {
        const controller = new TranslationController();
        await controller.initialize();
        return controller;
    }
}

module.exports = TranslationController;
