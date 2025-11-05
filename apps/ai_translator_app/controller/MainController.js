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

const logger = require('#@logger');
const aiTranslator = require('#@ncore/utils/ai_translator/index.js');
const webInterface = require('#@ncore/utils/ai_translator/web/index.js');

class MainController {
    constructor(config) {
        this.config = config;
        this.isRunning = false;
        this.translationManager = null;
        this.webServer = null;
    }

    async start() {
        try {
            logger.info('[AI Translator App] Starting application...');

            await this.validateConfiguration();

            const apiKey = this.config.openRouterConfig.getApiKey();
            process.env.OPENROUTER_API_KEY = apiKey;

            const translationOptions = {
                watchExtensions: this.config.watchConfig.watchExtensions,
                watchDepth: this.config.watchConfig.watchDepth,
                skipFolders: this.config.watchConfig.skipFolders,
                skipFiles: this.config.watchConfig.skipFiles,
                skipExtensions: this.config.watchConfig.skipExtensions,
                targetLanguage: this.config.translationConfig.targetLanguage,
                sourceLanguage: this.config.translationConfig.sourceLanguage || 'auto',
                preserveFormatting: this.config.translationConfig.preserveFormatting,
                preserveCodeBlocks: this.config.translationConfig.preserveCodeBlocks,
                preserveTechnicalTerms: this.config.translationConfig.preserveTechnicalTerms,
                translationStyle: this.config.translationConfig.translationStyle,
                openRouterApiKey: apiKey,
                openRouterModel: this.config.openRouterConfig.defaultModel,
                openRouterTimeout: this.config.openRouterConfig.timeout,
                openRouterMaxRetries: this.config.openRouterConfig.maxRetries
            };

            const watchPaths = [this.config.watchConfig.watchPath];
            this.translationManager = await aiTranslator.startTranslation(watchPaths, translationOptions);

            if (this.config.webConfig.enabled) {
                this.webServer = await webInterface.startWebInterface(this.translationManager, this.config);
                logger.info(`[AI Translator App] Web interface: http://${this.config.webConfig.host}:${this.config.webConfig.port}`);
            }

            this.isRunning = true;

            logger.info('[AI Translator App] Application started successfully');
            logger.info(`[AI Translator App] Monitoring: ${this.config.watchConfig.watchPath}`);
            logger.info(`[AI Translator App] Extensions: ${this.config.watchConfig.watchExtensions.join(', ')}`);

            this.setupGracefulShutdown();

        } catch (error) {
            logger.error(`[AI Translator App] Failed to start: ${error.message}`);
            throw error;
        }
    }

    async validateConfiguration() {
        const errors = [];
        const apiKey = this.config.openRouterConfig.getApiKey();

        if (!apiKey) {
            errors.push('OpenRouter API key is required');
        }

        const { freader } = require('#@btools');
        if (!freader.isExists(this.config.watchConfig.watchPath)) {
            errors.push(`Watch path does not exist: ${this.config.watchConfig.watchPath}`);
        }

        if (this.config.webConfig.enabled) {
            if (!this.config.webConfig.port || this.config.webConfig.port < 1 || this.config.webConfig.port > 65535) {
                errors.push('Invalid web server port');
            }
        }

        if (errors.length > 0) {
            throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
        }

        logger.info('[AI Translator App] Configuration validated');
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            logger.info(`[AI Translator App] Received ${signal}, shutting down...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGQUIT', () => shutdown('SIGQUIT'));
    }

    async stop() {
        if (!this.isRunning) {
            logger.warn('[AI Translator App] Application is not running');
            return;
        }

        try {
            logger.info('[AI Translator App] Stopping application...');

            if (this.webServer) {
                await webInterface.stopWebInterface();
                this.webServer = null;
            }

            if (this.translationManager) {
                await aiTranslator.stopTranslation();
                this.translationManager = null;
            }

            this.isRunning = false;
            logger.info('[AI Translator App] Application stopped');

        } catch (error) {
            logger.error(`[AI Translator App] Error during shutdown: ${error.message}`);
            throw error;
        }
    }

    async getStatus() {
        if (!this.isRunning) {
            return { status: 'stopped' };
        }

        const translationStatus = this.translationManager ?
            await aiTranslator.getStatus() : null;

        const webStatus = this.webServer ?
            await webInterface.getWebStatus() : null;

        return {
            status: 'running',
            uptime: process.uptime(),
            translationService: translationStatus,
            webInterface: webStatus,
            configuration: {
                watchPath: this.config.watchConfig.watchPath,
                watchExtensions: this.config.watchConfig.watchExtensions,
                targetLanguage: this.config.translationConfig.targetLanguage,
                webEnabled: this.config.webConfig.enabled
            }
        };
    }

    async restart() {
        logger.info('[AI Translator App] Restarting application...');
        await this.stop();
        await this.start();
        logger.info('[AI Translator App] Application restarted');
    }
}

module.exports = MainController;
