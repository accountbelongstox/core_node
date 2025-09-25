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
const TranslationController = require('../controller/translation_controller.js');

class ApiRoutes {
    constructor(translationManager, config) {
        this.translationManager = translationManager;
        this.config = config;
        this.controller = new TranslationController(translationManager, config);
        this.router = require('express').Router();
        this.setupRoutes();
    }

    setupRoutes() {
        // Translation service status
        this.router.get('/status', async (req, res) => {
            try {
                const status = await this.controller.getServiceStatus();
                res.json({
                    success: true,
                    data: status
                });
            } catch (error) {
                logger.error(`[API Routes] Status error: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Start translation service
        this.router.post('/start', async (req, res) => {
            try {
                const result = await this.controller.startTranslation();
                res.json({
                    success: true,
                    message: 'Translation service started',
                    data: result
                });
            } catch (error) {
                logger.error(`[API Routes] Start error: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Stop translation service
        this.router.post('/stop', async (req, res) => {
            try {
                await this.controller.stopTranslation();
                res.json({
                    success: true,
                    message: 'Translation service stopped'
                });
            } catch (error) {
                logger.error(`[API Routes] Stop error: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Restart translation service
        this.router.post('/restart', async (req, res) => {
            try {
                await this.controller.restartTranslation();
                res.json({
                    success: true,
                    message: 'Translation service restarted'
                });
            } catch (error) {
                logger.error(`[API Routes] Restart error: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Translate text manually
        this.router.post('/translate', async (req, res) => {
            try {
                const { text, sourceLanguage, targetLanguage, options } = req.body;
                
                if (!text) {
                    return res.status(400).json({
                        success: false,
                        error: 'Text is required'
                    });
                }

                const result = await this.controller.translateText(text, {
                    sourceLanguage,
                    targetLanguage,
                    ...options
                });

                res.json({
                    success: true,
                    data: {
                        originalText: text,
                        translatedText: result,
                        sourceLanguage: sourceLanguage || 'auto',
                        targetLanguage: targetLanguage || 'auto'
                    }
                });
            } catch (error) {
                logger.error(`[API Routes] Translate error: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Translate batch of texts
        this.router.post('/translate/batch', async (req, res) => {
            try {
                const { texts, sourceLanguage, targetLanguage, options } = req.body;
                
                if (!Array.isArray(texts) || texts.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Texts array is required'
                    });
                }

                const results = await this.controller.translateBatch(texts, {
                    sourceLanguage,
                    targetLanguage,
                    ...options
                });

                res.json({
                    success: true,
                    data: {
                        originalTexts: texts,
                        translatedTexts: results,
                        sourceLanguage: sourceLanguage || 'auto',
                        targetLanguage: targetLanguage || 'auto'
                    }
                });
            } catch (error) {
                logger.error(`[API Routes] Batch translate error: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get translation statistics
        this.router.get('/statistics', async (req, res) => {
            try {
                const statistics = await this.controller.getStatistics();
                res.json({
                    success: true,
                    data: statistics
                });
            } catch (error) {
                logger.error(`[API Routes] Statistics error: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get translation history
        this.router.get('/history', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 100;
                const history = await this.controller.getTranslationHistory(limit);
                res.json({
                    success: true,
                    data: history
                });
            } catch (error) {
                logger.error(`[API Routes] History error: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Clear statistics
        this.router.post('/statistics/clear', async (req, res) => {
            try {
                await this.controller.clearStatistics();
                res.json({
                    success: true,
                    message: 'Statistics cleared'
                });
            } catch (error) {
                logger.error(`[API Routes] Clear statistics error: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Update configuration
        this.router.post('/config', async (req, res) => {
            try {
                const newConfig = req.body;
                await this.controller.updateConfiguration(newConfig);
                res.json({
                    success: true,
                    message: 'Configuration updated'
                });
            } catch (error) {
                logger.error(`[API Routes] Config update error: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get current configuration
        this.router.get('/config', async (req, res) => {
            try {
                const config = await this.controller.getConfiguration();
                res.json({
                    success: true,
                    data: config
                });
            } catch (error) {
                logger.error(`[API Routes] Get config error: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Test API connection
        this.router.get('/test', async (req, res) => {
            try {
                const testResult = await this.controller.testConnection();
                res.json({
                    success: true,
                    data: testResult
                });
            } catch (error) {
                logger.error(`[API Routes] Test error: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ApiRoutes;