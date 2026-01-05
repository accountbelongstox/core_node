/**
 * Language Detection Utility
 *
 * Lightweight language detection using regex patterns.
 * Optimized for Chinese/English detection with zero dependencies.
 */

/**
 * Detect language of text
 * @param {string} text - Text to detect
 * @returns {string} - Language code ('zh', 'en', etc.)
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return 'en' // Default to English for empty/invalid text
  }

  // Remove whitespace for accurate ratio calculation
  const trimmedText = text.trim()

  // Chinese character regex (includes CJK Unified Ideographs)
  const chineseRegex = /[\u4e00-\u9fa5]/g
  const chineseMatches = trimmedText.match(chineseRegex) || []
  const chineseCount = chineseMatches.length

  // Calculate ratio of Chinese characters
  const totalLength = trimmedText.length
  const chineseRatio = totalLength > 0 ? chineseCount / totalLength : 0

  // If Chinese characters occupy more than 30%, classify as Chinese
  if (chineseRatio > 0.3) {
    return 'zh'
  }

  // Japanese Hiragana/Katakana detection (optional, for future expansion)
  const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/g
  const japaneseMatches = trimmedText.match(japaneseRegex) || []
  if (japaneseMatches.length / totalLength > 0.3) {
    return 'ja'
  }

  // Korean Hangul detection (optional, for future expansion)
  const koreanRegex = /[\uac00-\ud7af]/g
  const koreanMatches = trimmedText.match(koreanRegex) || []
  if (koreanMatches.length / totalLength > 0.3) {
    return 'ko'
  }

  // Default to English
  return 'en'
}

/**
 * Check if text needs translation
 * @param {string} text - Text to check
 * @param {string} targetLang - Target language (default: 'en')
 * @returns {boolean} - True if translation needed
 */
function needsTranslation(text, targetLang = 'en') {
  const detectedLang = detectLanguage(text)
  return detectedLang !== targetLang
}

/**
 * Get language statistics for text
 * @param {string} text - Text to analyze
 * @returns {Object} - Language statistics
 */
function getLanguageStats(text) {
  if (!text || typeof text !== 'string') {
    return {
      total: 0,
      chinese: 0,
      japanese: 0,
      korean: 0,
      detected: 'en'
    }
  }

  const trimmedText = text.trim()
  const totalLength = trimmedText.length

  const chineseMatches = trimmedText.match(/[\u4e00-\u9fa5]/g) || []
  const japaneseMatches = trimmedText.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []
  const koreanMatches = trimmedText.match(/[\uac00-\ud7af]/g) || []

  return {
    total: totalLength,
    chinese: chineseMatches.length,
    japanese: japaneseMatches.length,
    korean: koreanMatches.length,
    chineseRatio: totalLength > 0 ? chineseMatches.length / totalLength : 0,
    japaneseRatio: totalLength > 0 ? japaneseMatches.length / totalLength : 0,
    koreanRatio: totalLength > 0 ? koreanMatches.length / totalLength : 0,
    detected: detectLanguage(text)
  }
}

module.exports = {
  detectLanguage,
  needsTranslation,
  getLanguageStats
}
