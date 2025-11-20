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
const OpenRouterAPI = require('./openrouter_api.js');
const { datetool } = require('#@btools');

class AITranslator {
    static apiConfig = {
        maxRetries: 3,
        retryDelay: 2000,
        requestTimeout: 30000,
        maxConcurrent: 3
    };

    static requestQueue = [];
    static activeRequests = 0;
    static isProcessing = false;
    static openRouterAPI = null;

    static initialize(options = {}) {
        if (!this.openRouterAPI) {
            this.openRouterAPI = new OpenRouterAPI({
                maxRetries: this.apiConfig.maxRetries,
                retryDelay: this.apiConfig.retryDelay,
                timeout: this.apiConfig.requestTimeout,
                ...options
            });
            logger.info('[AI Translator] OpenRouter API initialized');
        }
    }

    static async translate(text, targetLanguage = 'auto', sourceLanguage = 'auto') {
        if (!text || typeof text !== 'string') {
            logger.warn('[AI Translator] Invalid text provided for translation');
            return text;
        }

        // Initialize OpenRouter API if not already done
        if (!this.openRouterAPI) {
            this.initialize();
        }

        try {
            const translationRequest = {
                text: text.trim(),
                targetLanguage,
                sourceLanguage,
                timestamp: Date.now()
            };

            return await this.queueTranslation(translationRequest);

        } catch (error) {
            logger.error(`[AI Translator] Translation failed: ${error.message}`);
            return text; // Return original text as fallback
        }
    }

    static async queueTranslation(request) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                ...request,
                resolve,
                reject
            });

            this.processQueue();
        });
    }

    static async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.requestQueue.length > 0 && this.activeRequests < this.apiConfig.maxConcurrent) {
            const request = this.requestQueue.shift();
            this.processTranslationRequest(request);
        }

        this.isProcessing = false;
    }

    static async processTranslationRequest(request) {
        this.activeRequests++;

        try {
            const result = await this.performTranslation(request);
            request.resolve(result);

        } catch (error) {
            logger.error(`[AI Translator] Request processing failed: ${error.message}`);
            request.reject(error);
        } finally {
            this.activeRequests--;
            
            // Continue processing queue if there are more requests
            if (this.requestQueue.length > 0 && this.activeRequests < this.apiConfig.maxConcurrent) {
                setTimeout(() => this.processQueue(), 100);
            }
        }
    }

    static async performTranslation(request) {
        const { text, targetLanguage, sourceLanguage } = request;
        
        try {
            const result = await this.openRouterAPI.translate(text, {
                sourceLanguage: sourceLanguage,
                targetLanguage: targetLanguage
            });

            return result;

        } catch (error) {
            logger.error(`[AI Translator] OpenRouter translation failed: ${error.message}`);
            throw error;
        }
    }

    static detectLanguage(content) {
        return this.openRouterAPI ? this.openRouterAPI.detectLanguage(content) : 'en';
    }

    static async translateBatch(texts, targetLanguage = 'auto', sourceLanguage = 'auto') {
        if (!Array.isArray(texts)) {
            return [await this.translate(texts, targetLanguage, sourceLanguage)];
        }

        try {
            logger.info(`[AI Translator] Starting batch translation of ${texts.length} texts`);
            
            const results = await Promise.all(
                texts.map((text, index) => 
                    this.translate(text, targetLanguage, sourceLanguage)
                        .catch(error => {
                            logger.error(`[AI Translator] Batch item ${index} failed: ${error.message}`);
                            return text; // Return original text on failure
                        })
                )
            );

            logger.info(`[AI Translator] Batch translation completed`);
            return results;

        } catch (error) {
            logger.error(`[AI Translator] Batch translation failed: ${error.message}`);
            return texts; // Return original texts as fallback
        }
    }

    static estimateTokens(text) {
        // Rough estimation for different languages
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const otherChars = text.length - chineseChars;
        
        // Chinese: ~1.5 chars per token, English: ~4 chars per token
        return Math.ceil(chineseChars / 1.5 + otherChars / 4);
    }

    static async getQueueStatus() {
        return {
            queueLength: this.requestQueue.length,
            activeRequests: this.activeRequests,
            isProcessing: this.isProcessing,
            maxConcurrent: this.apiConfig.maxConcurrent
        };
    }

    static updateConfig(newConfig) {
        this.apiConfig = { ...this.apiConfig, ...newConfig };
        logger.info('[AI Translator] Configuration updated');
    }

    static clearQueue() {
        const clearedCount = this.requestQueue.length;
        
        // Reject all pending requests
        this.requestQueue.forEach(request => {
            request.reject(new Error('Translation queue cleared'));
        });
        
        this.requestQueue = [];
        logger.info(`[AI Translator] Cleared ${clearedCount} pending requests`);
        return clearedCount;
    }
}

module.exports = AITranslator;