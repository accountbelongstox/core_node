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

class TranslationController {
    constructor(translationManager, config) {
        this.translationManager = translationManager;
        this.config = config;
    }

    async getServiceStatus() {
        try {
            const status = await this.translationManager.getStatus();
            return {
                timestamp: new Date().toISOString(),
                ...status
            };
        } catch (error) {
            logger.error(`[Translation Controller] Error getting service status: ${error.message}`);
            throw error;
        }
    }

    async startTranslation() {
        try {
            await this.translationManager.startTranslation();
            return {
                message: 'Translation service started successfully',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`[Translation Controller] Error starting translation: ${error.message}`);
            throw error;
        }
    }

    async stopTranslation() {
        try {
            await this.translationManager.stopTranslation();
            return {
                message: 'Translation service stopped successfully',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`[Translation Controller] Error stopping translation: ${error.message}`);
            throw error;
        }
    }

    async restartTranslation() {
        try {
            await this.translationManager.restart();
            return {
                message: 'Translation service restarted successfully',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`[Translation Controller] Error restarting translation: ${error.message}`);
            throw error;
        }
    }

    async translateText(text, options = {}) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Text parameter is required and must be a string');
            }

            const result = await this.translationManager.translateText(text, options);
            
            return {
                originalText: text,
                translatedText: result,
                options: options,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`[Translation Controller] Error translating text: ${error.message}`);
            throw error;
        }
    }

    async translateBatch(texts, options = {}) {
        try {
            if (!Array.isArray(texts) || texts.length === 0) {
                throw new Error('Texts parameter must be a non-empty array');
            }

            const results = await this.translationManager.translateBatch(texts, options);
            
            return {
                originalTexts: texts,
                translatedTexts: results,
                options: options,
                count: texts.length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`[Translation Controller] Error translating batch: ${error.message}`);
            throw error;
        }
    }

    async getStatistics() {
        try {
            const status = await this.translationManager.getStatus();
            const history = await this.translationManager.getTranslationHistory();
            
            return {
                current: status.statistics || {},
                history: history,
                performance: {
                    averageProcessingTime: this.calculateAverageProcessingTime(status.statistics),
                    successRate: this.calculateSuccessRate(status.statistics),
                    throughput: this.calculateThroughput(status)
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`[Translation Controller] Error getting statistics: ${error.message}`);
            throw error;
        }
    }

    async getTranslationHistory(limit = 100) {
        try {
            const history = await this.translationManager.getTranslationHistory(limit);
            return {
                history: history,
                limit: limit,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`[Translation Controller] Error getting translation history: ${error.message}`);
            throw error;
        }
    }

    async clearStatistics() {
        try {
            await this.translationManager.clearStatistics();
            return {
                message: 'Statistics cleared successfully',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`[Translation Controller] Error clearing statistics: ${error.message}`);
            throw error;
        }
    }

    async updateConfiguration(newConfig) {
        try {
            if (!newConfig || typeof newConfig !== 'object') {
                throw new Error('Configuration must be a valid object');
            }

            await this.translationManager.updateConfiguration(newConfig);
            this.config = { ...this.config, ...newConfig };
            
            return {
                message: 'Configuration updated successfully',
                updatedConfig: this.config,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`[Translation Controller] Error updating configuration: ${error.message}`);
            throw error;
        }
    }

    async getConfiguration() {
        try {
            return {
                configuration: this.config,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`[Translation Controller] Error getting configuration: ${error.message}`);
            throw error;
        }
    }

    async testConnection() {
        try {
            // Test OpenRouter API connection by making a simple request
            const testText = "Hello";
            const testResult = await this.translationManager.translateText(testText, {
                targetLanguage: 'zh'
            });

            return {
                status: 'success',
                message: 'API connection test successful',
                testTranslation: {
                    input: testText,
                    output: testResult
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`[Translation Controller] API connection test failed: ${error.message}`);
            return {
                status: 'failed',
                message: 'API connection test failed',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    calculateAverageProcessingTime(statistics) {
        if (!statistics || statistics.translationsCompleted === 0) {
            return 0;
        }
        // This would require tracking processing times - simplified calculation
        return Math.round(statistics.totalCharactersTranslated / statistics.translationsCompleted * 0.01);
    }

    calculateSuccessRate(statistics) {
        if (!statistics || (statistics.translationsCompleted + statistics.errorsEncountered) === 0) {
            return 100;
        }
        const total = statistics.translationsCompleted + statistics.errorsEncountered;
        return Math.round((statistics.translationsCompleted / total) * 100);
    }

    calculateThroughput(status) {
        if (!status || !status.startTime || !status.statistics) {
            return 0;
        }
        const uptimeHours = status.uptime / (1000 * 60 * 60);
        if (uptimeHours === 0) return 0;
        return Math.round(status.statistics.translationsCompleted / uptimeHours);
    }
}

module.exports = TranslationController;