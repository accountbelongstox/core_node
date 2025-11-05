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

const https = require('https');
const config = require('../config/index.js');
const logger = require('./Logger.js');
const DeepSeekTranslator = require('./DeepSeekTranslator.js');

class TranslatorAPI {
    constructor() {
        this.azureConfig = config.azure;
        this.deepseekConfig = config.deepseek || {};
        this.requestQueue = [];
        this.processing = false;
        this.translationCache = new Map();
        this.enableCache = config.enableCache;
        this.deepseekTranslator = null;
        this.defaultProvider = config.defaultProvider || 'azure';
    }

    validateConfig() {
        const endpoint = this.azureConfig.endpoint;
        const apiKey = this.azureConfig.apiKey;

        if (!endpoint) {
            logger.error('Azure Translator endpoint not configured. Set AZURE_TRANSLATOR_ENDPOINT environment variable or config.');
            return false;
        }

        if (!apiKey) {
            logger.error('Azure Translator API key not configured. Set AZURE_TRANSLATOR_KEY environment variable or config.');
            logger.error('Get your key from: https://portal.azure.com -> Translator resource -> Keys and Endpoint');
            return false;
        }

        return true;
    }

    getCacheKey(text, targetLanguage) {
        return targetLanguage + ':' + text;
    }

    async translateAzure(text, targetLanguage = null, retryCount = 0) {
        const target = targetLanguage || this.azureConfig.defaultTargetLanguage;

        if (!this.validateConfig()) {
            return text;
        }

        if (this.enableCache) {
            const cacheKey = this.getCacheKey(text, target);
            if (this.translationCache.has(cacheKey)) {
                return this.translationCache.get(cacheKey);
            }
        }

        const endpoint = this.azureConfig.endpoint;
        const apiKey = this.azureConfig.apiKey;
        const region = this.azureConfig.region;
        const apiVersion = this.azureConfig.apiVersion || '3.0';

        const path = '/translate?api-version=' + apiVersion + '&to=' + target;
        const body = JSON.stringify([{ text: text }]);

        const hostname = endpoint.replace('https://', '').replace('http://', '');

        const options = {
            method: 'POST',
            hostname: hostname,
            path: path,
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey,
                'Ocp-Apim-Subscription-Region': region,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: this.azureConfig.timeout || 10000
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const result = JSON.parse(data);
                            if (result && result.length > 0 && result[0].translations && result[0].translations.length > 0) {
                                const translation = result[0].translations[0].text;

                                if (this.enableCache) {
                                    const cacheKey = this.getCacheKey(text, target);
                                    this.translationCache.set(cacheKey, translation);
                                }

                                resolve(translation);
                            } else {
                                logger.error('Unexpected API response format');
                                resolve(text);
                            }
                        } else if (res.statusCode === 429 && retryCount < this.azureConfig.retryCount) {
                            logger.warn('Rate limit exceeded, retrying in ' + this.azureConfig.retryDelay + 'ms...');
                            setTimeout(() => {
                                this.translateAzure(text, targetLanguage, retryCount + 1).then(resolve);
                            }, this.azureConfig.retryDelay);
                        } else {
                            logger.error('Translation API error: ' + res.statusCode + ' - ' + data);
                            resolve(text);
                        }
                    } catch (error) {
                        logger.error('Error parsing translation response: ' + error.message);
                        resolve(text);
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy();
                logger.error('Translation API request timeout');
                resolve(text);
            });

            req.on('error', (error) => {
                if (retryCount < this.azureConfig.retryCount) {
                    logger.warn('Translation API request error, retrying: ' + error.message);
                    setTimeout(() => {
                        this.translateAzure(text, targetLanguage, retryCount + 1).then(resolve);
                    }, this.azureConfig.retryDelay);
                } else {
                    logger.error('Translation API request error: ' + error.message);
                    resolve(text);
                }
            });

            req.write(body);
            req.end();
        });
    }

    async detectLanguage(text) {
        if (!this.validateConfig()) {
            return null;
        }

        const endpoint = this.azureConfig.endpoint;
        const apiKey = this.azureConfig.apiKey;
        const region = this.azureConfig.region;
        const apiVersion = this.azureConfig.apiVersion || '3.0';

        const path = '/detect?api-version=' + apiVersion;
        const body = JSON.stringify([{ text: text }]);

        const hostname = endpoint.replace('https://', '').replace('http://', '');

        const options = {
            method: 'POST',
            hostname: hostname,
            path: path,
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey,
                'Ocp-Apim-Subscription-Region': region,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: this.azureConfig.timeout || 10000
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const result = JSON.parse(data);
                            if (result && result.length > 0 && result[0].language) {
                                resolve(result[0].language);
                            } else {
                                resolve(null);
                            }
                        } else {
                            logger.error('Language detection error: ' + res.statusCode);
                            resolve(null);
                        }
                    } catch (error) {
                        logger.error('Error parsing language detection response: ' + error.message);
                        resolve(null);
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy();
                logger.error('Language detection request timeout');
                resolve(null);
            });

            req.on('error', (error) => {
                logger.error('Language detection request error: ' + error.message);
                resolve(null);
            });

            req.write(body);
            req.end();
        });
    }

    async initDeepSeek() {
        if (this.deepseekTranslator) {
            return true;
        }

        logger.info('Initializing DeepSeek translator');

        try {
            this.deepseekTranslator = new DeepSeekTranslator({
                modelPath: this.deepseekConfig.modelPath || 'deepseek-ai/deepseek-vl-1.3b-chat',
                modelDir: this.deepseekConfig.modelDir || null,
                pythonCommand: this.deepseekConfig.pythonCommand || 'python',
                timeout: this.deepseekConfig.timeout || 30000
            });

            await this.deepseekTranslator.start();
            logger.info('DeepSeek translator initialized successfully');
            return true;
        } catch (error) {
            logger.error('Failed to initialize DeepSeek: ' + error.message);
            this.deepseekTranslator = null;
            return false;
        }
    }

    async translateDeepSeek(text, targetLanguage = null) {
        const target = targetLanguage || 'Chinese';

        if (this.enableCache) {
            const cacheKey = this.getCacheKey(text, target + '_deepseek');
            if (this.translationCache.has(cacheKey)) {
                return this.translationCache.get(cacheKey);
            }
        }

        if (!this.deepseekTranslator) {
            const initialized = await this.initDeepSeek();
            if (!initialized) {
                logger.error('DeepSeek not available, returning original text');
                return text;
            }
        }

        try {
            const translation = await this.deepseekTranslator.translate(text, {
                targetLanguage: target
            });

            if (this.enableCache) {
                const cacheKey = this.getCacheKey(text, target + '_deepseek');
                this.translationCache.set(cacheKey, translation);
            }

            return translation;
        } catch (error) {
            logger.error('DeepSeek translation error: ' + error.message);
            return text;
        }
    }

    async translate(text, options = {}) {
        const provider = options.provider || this.defaultProvider;
        const targetLanguage = options.targetLanguage || null;

        if (provider === 'azure') {
            return await this.translateAzure(text, targetLanguage);
        } else if (provider === 'deepseek') {
            return await this.translateDeepSeek(text, targetLanguage);
        }

        logger.error('Unsupported translation provider: ' + provider);
        return text;
    }

    async stopDeepSeek() {
        if (this.deepseekTranslator) {
            logger.info('Stopping DeepSeek translator');
            this.deepseekTranslator.stop();
            this.deepseekTranslator = null;
        }
    }

    getDeepSeekStatus() {
        if (this.deepseekTranslator) {
            return this.deepseekTranslator.getStatus();
        }
        return {
            isReady: false,
            hasProcess: false,
            message: 'Not initialized'
        };
    }

    async translateBatch(texts, options = {}) {
        const results = [];
        let i;

        for (i = 0; i < texts.length; i++) {
            const translation = await this.translate(texts[i], options);
            results.push(translation);
        }

        return results;
    }
}

module.exports = TranslatorAPI;
