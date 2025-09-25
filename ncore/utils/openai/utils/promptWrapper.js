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

const JSON_FORMAT_SUFFIX = 'Please provide the result in pure JSON format without any extra content, so I can directly convert the output into a JSON object.';

/**
 * Wraps a prompt with JSON format requirement
 * @param {string} prompt - The original prompt
 * @returns {string} The wrapped prompt or empty string if input is empty
 */
function wrapPromptWithJsonFormat(prompt) {
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
        return '';
    }
    if(prompt.endsWith(JSON_FORMAT_SUFFIX)) {
        return prompt;
    }
    return `${prompt.trim()} \n ${JSON_FORMAT_SUFFIX}`;
}

module.exports = {
    wrapPromptWithJsonFormat,
    JSON_FORMAT_SUFFIX
}; 