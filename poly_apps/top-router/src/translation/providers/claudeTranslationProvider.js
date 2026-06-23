const unifiedClaudeScheduler = require('../unifiedClaudeScheduler')
const logger = require('../../utils/logger')
const config = require('../../../config/config')

class ClaudeTranslationProvider {
  constructor() {
    this.model = config.translation?.models?.claude || 'claude-3-5-haiku-20241022'
    this.dedicatedAccountId = config.translation?.dedicatedAccounts?.claude
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

    return `Translate this ${sourceLangName} text to ${targetLangName}.

Requirements:
- Preserve technical accuracy for programming terms
- Maintain original meaning and tone
- Keep code blocks, URLs, and formatting unchanged
- Output only the translated text, no explanations

${text}`
  }

  /**
   * Translate text using Claude Haiku
   * @param {string} text - Text to translate
   * @param {string} sourceLang - Source language
   * @param {string} targetLang - Target language
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - Translated text
   */
  async translate(text, sourceLang, targetLang, options = {}) {
    try {
      const prompt = this.buildPrompt(text, sourceLang, targetLang)

      // Build request for Claude API
      const claudeRequest = {
        model: this.model,
        max_tokens: Math.min(text.length * 2, 4096), // Estimate translated length
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }

      logger.debug('Claude translation request', {
        model: this.model,
        textLength: text.length,
        sourceLang,
        targetLang
      })

      // Use unified Claude scheduler to select account and make request
      const account = await unifiedClaudeScheduler.selectAccount(
        this.model,
        null, // no session hash for translation
        this.dedicatedAccountId ? { accountId: this.dedicatedAccountId } : {}
      )

      if (!account) {
        throw new Error('No Claude account available for translation')
      }

      logger.info(`Using Claude account for translation`, {
        accountId: account.id,
        accountName: account.name,
        accountType: account.type
      })

      // Get the relay service for this account type
      let relayService
      if (account.type === 'claude-official') {
        relayService = require('../claudeRelayService')
      } else if (account.type === 'claude-console') {
        relayService = require('../claudeConsoleRelayService')
      } else if (account.type === 'bedrock') {
        relayService = require('../bedrockRelayService')
      } else if (account.type === 'ccr') {
        relayService = require('../ccrRelayService')
      } else {
        throw new Error(`Unsupported account type for translation: ${account.type}`)
      }

      // Make non-streaming request
      const response = await relayService.makeRequest(account, claudeRequest, {
        stream: false
      })

      // Extract translated text from response
      if (response && response.content && Array.isArray(response.content)) {
        const textContent = response.content.find((block) => block.type === 'text')
        if (textContent && textContent.text) {
          return textContent.text.trim()
        }
      }

      throw new Error('Invalid response format from Claude API')
    } catch (error) {
      logger.error('Claude translation failed', {
        error: error.message,
        textLength: text.length,
        sourceLang,
        targetLang
      })
      throw error
    }
  }
}

module.exports = ClaudeTranslationProvider
