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
const { datetool } = require('#@btools');
const PromptTemplates = require('./prompt_templates.js');

class OpenRouterAPI {
    constructor(options = {}) {
        this.apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;
        this.baseUrl = options.baseUrl || 'https://openrouter.ai/api/v1/chat/completions';
        this.referrer = options.referrer || 'https://ncore-translator.local/';
        this.appName = options.appName || 'NCore AI Translator';
        this.defaultModel = options.defaultModel || 'google/gemini-2.0-flash-exp:free';
        this.timeout = options.timeout || 30000;
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 2000;
        
        this.freeModels = [
            'google/gemini-2.5-pro-exp-03-25:free',
            'google/gemma-3-1b-it:free',
            'google/gemma-3-4b-it:free',
            'google/gemma-3-12b-it:free',
            'google/gemma-3-27b-it:free',
            'google/gemini-2.0-flash-lite-preview-02-05:free',
            'google/gemini-2.0-pro-exp-02-05:free',
            'google/gemini-2.0-flash-thinking-exp:free',
            'google/gemini-2.0-flash-thinking-exp-1219:free',
            'google/gemini-2.0-flash-exp:free',
            'google/learnlm-1.5-pro-experimental:free',
            'google/gemini-flash-1.5-8b-exp',
            'google/gemma-2-9b-it:free',
            'deepseek/deepseek-chat-v3-0324:free',
            'deepseek/deepseek-r1-zero:free',
            'deepseek/deepseek-r1-distill-llama-70b:free',
            'deepseek/deepseek-r1:free',
            'deepseek/deepseek-chat:free',
            'meta-llama/llama-3.3-70b-instruct:free',
            'meta-llama/llama-3.2-3b-instruct:free',
            'meta-llama/llama-3.2-1b-instruct:free',
            'meta-llama/llama-3.2-11b-vision-instruct:free',
            'meta-llama/llama-3.1-8b-instruct:free',
            'meta-llama/llama-3-8b-instruct:free',
            'qwen/qwen2.5-vl-3b-instruct:free',
            'qwen/qwen2.5-vl-32b-instruct:free',
            'qwen/qwq-32b:free',
            'qwen/qwen2.5-vl-72b-instruct:free',
            'deepseek/deepseek-r1-distill-qwen-32b:free',
            'deepseek/deepseek-r1-distill-qwen-14b:free',
            'qwen/qwq-32b-preview:free',
            'qwen/qwen-2.5-coder-32b-instruct:free',
            'qwen/qwen-2.5-72b-instruct:free',
            'qwen/qwen-2.5-vl-7b-instruct:free',
            'qwen/qwen-2-7b-instruct:free',
            'allenai/molmo-7b-d:free',
            'bytedance-research/ui-tars-72b:free',
            'featherless/qwerky-72b:free',
            'mistralai/mistral-small-3.1-24b-instruct:free',
            'open-r1/olympiccoder-7b:free',
            'open-r1/olympiccoder-32b:free',
            'rekaai/reka-flash-3:free',
            'moonshotai/moonlight-16b-a3b-instruct:free',
            'nousresearch/deephermes-3-llama-3-8b-preview:free',
            'cognitivecomputations/dolphin3.0-r1-mistral-24b:free',
            'cognitivecomputations/dolphin3.0-mistral-24b:free',
            'mistralai/mistral-small-24b-instruct-2501:free',
            'sophosympatheia/rogue-rose-103b-v0.2:free',
            'nvidia/llama-3.1-nemotron-70b-instruct:free',
            'mistralai/mistral-nemo:free',
            'mistralai/mistral-7b-instruct:free',
            'microsoft/phi-3-mini-128k-instruct:free',
            'microsoft/phi-3-medium-128k-instruct:free',
            'openchat/openchat-7b:free',
            'undi95/toppy-m-7b:free',
            'huggingfaceh4/zephyr-7b-beta:free',
            'gryphe/mythomax-l2-13b:free'
        ];
        
        if (!this.apiKey) {
            logger.warn('[OpenRouter API] No API key provided. Set OPENROUTER_API_KEY environment variable.');
        }
    }

    async translate(text, options = {}) {
        const {
            sourceLanguage = 'auto',
            targetLanguage = 'auto',
            model = this.defaultModel,
            temperature = 0.3,
            maxTokens = 2000,
            context = '',
            documentType = 'general',
            preserveFormatting = true,
            preserveCodeBlocks = true,
            preserveTechnicalTerms = true,
            translationStyle = 'natural'
        } = options;

        const finalTargetLang = this.resolveTargetLanguage(text, sourceLanguage, targetLanguage);
        const finalSourceLang = sourceLanguage === 'auto' ? this.detectLanguage(text) : sourceLanguage;

        if (finalSourceLang === finalTargetLang) {
            logger.debug('[OpenRouter API] Source and target languages are the same, returning original text');
            return text;
        }

        // Validate inputs
        const validation = PromptTemplates.validatePromptInputs(text, finalSourceLang, finalTargetLang);
        if (!validation.valid) {
            throw new Error(`Invalid translation inputs: ${validation.errors.join(', ')}`);
        }

        // Build prompts using template system
        const { systemPrompt, userPrompt } = PromptTemplates.buildTranslationPrompt(
            text, 
            finalSourceLang, 
            finalTargetLang, 
            {
                preserveFormatting,
                preserveCodeBlocks,
                preserveTechnicalTerms,
                translationStyle,
                context
            }
        );
        
        let lastError;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                logger.debug(`[OpenRouter API] Translation attempt ${attempt}/${this.maxRetries}`);
                
                const response = await this.makeRequest({
                    model,
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: userPrompt
                        }
                    ],
                    temperature,
                    max_tokens: maxTokens
                });

                const translatedText = PromptTemplates.extractTranslationFromResponse(response, 'single');
                
                if (translatedText && translatedText.trim()) {
                    logger.debug('[OpenRouter API] Translation successful');
                    return translatedText.trim();
                }
                
                throw new Error('Empty translation received');

            } catch (error) {
                lastError = error;
                logger.warn(`[OpenRouter API] Attempt ${attempt} failed: ${error.message}`);
                
                if (attempt < this.maxRetries) {
                    const delay = this.retryDelay * attempt;
                    logger.debug(`[OpenRouter API] Retrying in ${delay}ms...`);
                    await datetool.sleep(delay);
                }
            }
        }

        throw new Error(`Translation failed after ${this.maxRetries} attempts: ${lastError.message}`);
    }

    async makeRequest(payload) {
        if (!this.apiKey) {
            throw new Error('OpenRouter API key is required');
        }

        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': this.referrer,
            'X-Title': this.appName,
            'Content-Type': 'application/json'
        };

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.timeout)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from OpenRouter API');
        }

        return data.choices[0].message.content;
    }

    async translateBatch(texts, options = {}) {
        if (!Array.isArray(texts) || texts.length === 0) {
            throw new Error('Texts must be a non-empty array');
        }

        const {
            sourceLanguage = 'auto',
            targetLanguage = 'auto',
            model = this.defaultModel,
            temperature = 0.3,
            maxTokens = 4000,
            preserveFormatting = true,
            preserveCodeBlocks = true,
            preserveTechnicalTerms = true,
            translationStyle = 'natural'
        } = options;

        const finalTargetLang = this.resolveTargetLanguage(texts[0], sourceLanguage, targetLanguage);
        const finalSourceLang = sourceLanguage === 'auto' ? this.detectLanguage(texts[0]) : sourceLanguage;

        if (finalSourceLang === finalTargetLang) {
            logger.debug('[OpenRouter API] Source and target languages are the same, returning original texts');
            return texts;
        }

        // Build batch prompts using template system
        const { systemPrompt, userPrompt } = PromptTemplates.buildBatchTranslationPrompt(
            texts, 
            finalSourceLang, 
            finalTargetLang, 
            {
                preserveFormatting,
                preserveCodeBlocks,
                preserveTechnicalTerms,
                translationStyle
            }
        );

        let lastError;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                logger.debug(`[OpenRouter API] Batch translation attempt ${attempt}/${this.maxRetries}`);
                
                const response = await this.makeRequest({
                    model,
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: userPrompt
                        }
                    ],
                    temperature,
                    max_tokens: maxTokens
                });

                const translatedTexts = PromptTemplates.extractTranslationFromResponse(response, 'batch');
                
                if (translatedTexts.length === texts.length) {
                    logger.debug('[OpenRouter API] Batch translation successful');
                    return translatedTexts;
                }
                
                throw new Error(`Expected ${texts.length} translations, received ${translatedTexts.length}`);

            } catch (error) {
                lastError = error;
                logger.warn(`[OpenRouter API] Batch attempt ${attempt} failed: ${error.message}`);
                
                if (attempt < this.maxRetries) {
                    const delay = this.retryDelay * attempt;
                    logger.debug(`[OpenRouter API] Retrying in ${delay}ms...`);
                    await datetool.sleep(delay);
                }
            }
        }

        // Fallback to individual translations
        logger.warn('[OpenRouter API] Batch translation failed, falling back to individual translations');
        return await this.translateIndividually(texts, options);
    }

    async translateIndividually(texts, options) {
        const results = [];
        for (let i = 0; i < texts.length; i++) {
            try {
                const result = await this.translate(texts[i], options);
                results.push(result);
                
                // Small delay between individual requests
                if (i < texts.length - 1) {
                    await datetool.sleep(500);
                }
            } catch (error) {
                logger.error(`[OpenRouter API] Individual translation ${i} failed: ${error.message}`);
                results.push(texts[i]); // Return original text on failure
            }
        }
        return results;
    }

    detectLanguage(text) {
        if (!text) return 'en';

        const chinesePattern = /[\u4e00-\u9fff]/;
        if (chinesePattern.test(text)) {
            return 'zh';
        }

        const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/;
        if (japanesePattern.test(text)) {
            return 'ja';
        }

        const koreanPattern = /[\uac00-\ud7af]/;
        if (koreanPattern.test(text)) {
            return 'ko';
        }

        const russianPattern = /[\u0400-\u04ff]/;
        if (russianPattern.test(text)) {
            return 'ru';
        }

        return 'en';
    }

    resolveTargetLanguage(text, sourceLanguage, targetLanguage) {
        if (targetLanguage !== 'auto') {
            return targetLanguage;
        }

        const detectedLanguage = sourceLanguage === 'auto' ? this.detectLanguage(text) : sourceLanguage;
        return detectedLanguage === 'zh' ? 'en' : 'zh';
    }

    getLanguageName(code) {
        const languageNames = {
            'zh': 'Chinese',
            'en': 'English',
            'ja': 'Japanese',
            'ko': 'Korean',
            'fr': 'French',
            'de': 'German',
            'es': 'Spanish',
            'ru': 'Russian',
            'pt': 'Portuguese',
            'it': 'Italian',
            'ar': 'Arabic',
            'hi': 'Hindi'
        };

        return languageNames[code] || code;
    }

    getFreeModels() {
        return [...this.freeModels];
    }

    isModelFree(model) {
        return this.freeModels.includes(model);
    }

    setModel(model) {
        this.defaultModel = model;
        logger.info(`[OpenRouter API] Default model set to: ${model}`);
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
        logger.info('[OpenRouter API] API key updated');
    }

    validateConfiguration() {
        const issues = [];

        if (!this.apiKey) {
            issues.push('API key is missing');
        }

        if (!this.baseUrl) {
            issues.push('Base URL is missing');
        }

        if (!this.defaultModel) {
            issues.push('Default model is missing');
        }

        if (this.timeout < 5000) {
            issues.push('Timeout is too low (minimum 5000ms recommended)');
        }

        return {
            valid: issues.length === 0,
            issues: issues
        };
    }

    async testConnection() {
        try {
            const testText = 'Hello, world!';
            const result = await this.translate(testText, {
                sourceLanguage: 'en',
                targetLanguage: 'zh'
            });

            return {
                success: true,
                testText: testText,
                translatedText: result
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    getStats() {
        return {
            apiKey: this.apiKey ? '[SET]' : '[NOT SET]',
            baseUrl: this.baseUrl,
            defaultModel: this.defaultModel,
            timeout: this.timeout,
            maxRetries: this.maxRetries,
            retryDelay: this.retryDelay,
            freeModelsCount: this.freeModels.length
        };
    }
}

module.exports = OpenRouterAPI;