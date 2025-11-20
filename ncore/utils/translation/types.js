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
