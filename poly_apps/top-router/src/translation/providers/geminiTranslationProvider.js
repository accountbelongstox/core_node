const unifiedGeminiScheduler = require('../unifiedGeminiScheduler')
const logger = require('../../utils/logger')
const config = require('../../../config/config')

class GeminiTranslationProvider {
  constructor() {
    this.model = config.translation?.models?.gemini || 'gemini-1.5-flash'
    this.dedicatedAccountId = config.translation?.dedicatedAccounts?.gemini
  }

  /**
   * Build translation prompt
   * @param {string} text - Text to translate
   * @param {string} sourceLang - Source language
   * @param {string} targetLang - Target language
   * @returns {string} - Translation prompt
   */
  buildPrompt(text, sourceLang, targetLang) {
    const langMap = {
      zh: 'Chinese',
      en: 'English',
      ja: 'Japanese',
      ko: 'Korean'
    }

    const sourceLangName = langMap[sourceLang] || sourceLang
    const targetLangName = langMap[targetLang] || targetLang

    return `You are a professional translator. Translate the following ${sourceLangName} text to ${targetLangName}.

Requirements:
- Keep technical terms accurate
- Maintain the original meaning and tone
- Keep code blocks, URLs, and special formatting unchanged
- Only return the translated text, no explanations

Text to translate:
${text}`
  }

  /**
   * Translate text using Gemini Flash
   * @param {string} text - Text to translate
   * @param {string} sourceLang - Source language
   * @param {string} targetLang - Target language
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - Translated text
   */
  async translate(text, sourceLang, targetLang, options = {}) {
    try {
      const prompt = this.buildPrompt(text, sourceLang, targetLang)

      logger.debug('Gemini translation request', {
        model: this.model,
        textLength: text.length,
        sourceLang,
        targetLang
      })

      // Use unified Gemini scheduler to select account
      const account = await unifiedGeminiScheduler.selectAccount(
        this.model,
        null, // no session hash for translation
        this.dedicatedAccountId ? { accountId: this.dedicatedAccountId } : {}
      )

      if (!account) {
        throw new Error('No Gemini account available for translation')
      }

      logger.info(`Using Gemini account for translation`, {
        accountId: account.id,
        accountName: account.name
      })

      // Get Gemini relay service
      const geminiRelayService = require('../geminiRelayService')

      // Build Gemini request
      const geminiRequest = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: Math.min(text.length * 2, 4096),
          temperature: 0.3 // Lower temperature for more consistent translation
        }
      }

      // Make non-streaming request
      const response = await geminiRelayService.makeRequest(account, geminiRequest, this.model, {
        stream: false
      })

      // Extract translated text from response
      if (
        response &&
        response.candidates &&
        response.candidates.length > 0 &&
        response.candidates[0].content &&
        response.candidates[0].content.parts &&
        response.candidates[0].content.parts.length > 0
      ) {
        const text = response.candidates[0].content.parts[0].text
        if (text) {
          return text.trim()
        }
      }

      throw new Error('Invalid response format from Gemini API')
    } catch (error) {
      logger.error('Gemini translation failed', {
        error: error.message,
        textLength: text.length,
        sourceLang,
        targetLang
      })
      throw error
    }
  }
}

module.exports = GeminiTranslationProvider
