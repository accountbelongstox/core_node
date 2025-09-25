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

const path = require('path');
const fs = require('fs').promises;
const logger = require('#@logger');
const { writeJson, exists } = require('#@/ncore/basic/libs/fwriter.js');
const { generateMd5, wordToFileName } = require('#@/ncore/foundation/utilities/strtool.js');
const { TRANSLATE_TMP_DIR, TRANSLATE_DIR } = require('../../../provider/index');


/**
 * Generate and save translation file from parseTranslationRecord result
 * @param {Object} transRecord - Result from parseTranslationRecord
 * @returns {Object} Result with success flag and file path
 */
function generateTranslationFile(transRecord) {
    try {
        if (!transRecord || !transRecord.content) {
            return { success: false, error: 'Invalid translation record' };
        }

        // Generate filename
        const baseFileName = wordToFileName(transRecord.content);
        const md5 = generateMd5(transRecord.content)
        const fileName = `${baseFileName}_pv_bing_${md5}.json`;
        const filePath = path.join(TRANSLATE_TMP_DIR, fileName);

        // Check if file exists
        if (exists(filePath)) {
            return {
                success: true,
                exists: true,
                filePath,
                message: 'Translation file already exists'
            };
        }

        // Write JSON file
        const writeResult = writeJson(filePath, transRecord, {
            createDir: true,
            pretty: true,
            forceEmpty: false
        });

        if (writeResult) {
            const { fpath, size } = writeResult;
            logger.info(`Created translation file: ${fileName}`);
            return {
                success: true,
                exists: false,
                filePath: fpath,
                message: 'Translation file created successfully'
            };
        } else {
            return {
                success: false,
                error: 'Failed to write translation file'
            };
        }
    } catch (error) {
        logger.error('Error generating translation file:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Encode string to ensure proper Unicode representation
 * @param {string} str - String to encode
 * @returns {string} Encoded string
 */
function encodeToUnicode(str) {
    return str.replace(/[^\u0000-\u007F]/g, char => {
        const hex = char.charCodeAt(0).toString(16).padStart(4, '0');
        return `\\u${hex}`;
    });
}

/**
 * Process content within h2 tags and handle special characters
 * @param {*} input - Input to process
 * @returns {*} Processed input
 */
function processH2Content(input) {
    // Handle null/undefined
    if (input == null) {
        return input;
    }

    // Handle arrays
    if (Array.isArray(input)) {
        return input.map(item => processH2Content(item));
    }

    // Handle objects
    if (typeof input === 'object') {
        const result = {};
        for (const key in input) {
            if (Object.prototype.hasOwnProperty.call(input, key)) {
                result[key] = processH2Content(input[key]);
            }
        }
        return result;
    }

    // Handle strings
    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed.startsWith('<h2')) {
            // Find the first closing bracket
            const firstCloseBracketIndex = trimmed.indexOf('>');
            if (firstCloseBracketIndex === -1) {
                return encodeToUnicode(trimmed); // No closing bracket found, encode and return
            }

            // Check for </h2> at the end
            if (!trimmed.endsWith('</h2>')) {
                return encodeToUnicode(trimmed); // Not a complete h2 tag, encode and return
            }

            // Extract content between first '>' and '</h2>'
            const content = trimmed.substring(firstCloseBracketIndex + 1, trimmed.length - 5);
            if (!content.trim()) {
                return encodeToUnicode(trimmed); // Empty content, encode and return
            }

            return encodeToUnicode(content);
        }
        // For non-h2 strings, still encode to ensure consistency
        return encodeToUnicode(trimmed);
    }

    // Return other types as is
    return input;
}

module.exports = {
    generateTranslationFile,
    processH2Content,
    encodeToUnicode
}; 