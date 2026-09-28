/**
 * Translation option for translate request
 * @typedef {Object} TranslationOption
 * @property {string} text - The text to be translated.
 * @property {string} targetLanguage - The target language name or code (e.g., 'Chinese' or 'zh').
 * @property {string} [sourceLanguage] - The source language name or code (optional).
 */
const TranslationOption = {
  text: "string",
  targetLanguage: "string",
  sourceLanguage: "string",
};

/**
 * Unified translation response data
 * @typedef {Object} UnifiedTranslationResponse
 * @property {string} text - The translated text.
 * @property {string} sourceLanguage - The source language code.
 * @property {string} targetLanguage - The target language code.
 */
const UnifiedTranslationResponse = {
  text: "string",
  sourceLanguage: "string",
  targetLanguage: "string",
};

/**
 * Translation error details
 * @typedef {Object} TranslationError
 * @property {string} message - Error message description.
 * @property {number} [code] - Optional error code.
 * @property {string} [text] - Original text before translation.
 * @property {string} [sourceLanguage] - Source language code.
 * @property {string} [targetLanguage] - Target language code.
 */
const TranslationError = {
  message: "string",
  code: "number",
  text: "string",
  sourceLanguage: "string",
  targetLanguage: "string",
};

/**
 * Complete translation response
 * @typedef {Object} TranslationResponse
 * @property {boolean} success - Indicates whether the translation request was successful.
 * @property {string} platform - The platform used for translation.
 * @property {UnifiedTranslationResponse} [data] - Translation details if successful.
 * @property {TranslationError} [error] - Error details if failed.
 */
const TranslationResponse = {
  success: "boolean",
  platform: "string",
  data: "UnifiedTranslationResponse",
  error: "TranslationError",
};

module.exports = {
  TranslationOption,
  UnifiedTranslationResponse,
  TranslationResponse,
  TranslationError,
};
