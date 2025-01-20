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