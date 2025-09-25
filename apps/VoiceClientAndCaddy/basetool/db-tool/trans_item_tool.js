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

function transformDictionaryData(obj) {
    if (!obj || typeof obj !== 'object' || obj === null) return null
    const result = [];
    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('http')) continue;

        result.push({
            url: value.url,
            filename: value.save_filename, // Rename save_filename to filename
            phonetic: value.iterate_name,  // Rename iterate_name to phonetic
            type: key.includes('US') ? 'US' : 'UK' // Add type based on key
        });
    }
    return result;
}

function processImageArray(array) {
    if (!array) return array;
    if(!Array.isArray(array)) {
        array = Array.from(array)
    }
    let newimagearray = []
    for (const item of array) {
        newimagearray.push({
            url: item.url,
            filename: item.save_filename,
            dynamic: item.dynamic_url,
        })
    }
    return newimagearray;
}

function processH2Content(input) {
    if (input == null) {
        return input;
    }
    if (Array.isArray(input)) {
        return input.map(item => processH2Content(item));
    }
    if (typeof input === 'object') {
        const result = {};
        for (const key in input) {
            if (Object.prototype.hasOwnProperty.call(input, key)) {
                result[key] = processH2Content(input[key]);
            }
        }
        return result;
    }
    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed.startsWith('<h2')) {
            const firstCloseBracketIndex = trimmed.indexOf('>');
            if (firstCloseBracketIndex === -1) {
                return encodeToUnicode(trimmed); // No closing bracket found, encode and return
            }
            if (!trimmed.endsWith('</h2>')) {
                return encodeToUnicode(trimmed); // Not a complete h2 tag, encode and return
            }
            const content = trimmed.substring(firstCloseBracketIndex + 1, trimmed.length - 5);
            if (!content.trim()) {
                return encodeToUnicode(trimmed); // Empty content, encode and return
            }

            return encodeToUnicode(content);
        }
        return encodeToUnicode(trimmed);
    }
    return input;
}

function encodeToUnicode(str) {
    return str
}

module.exports = {
    processH2Content,
    transformDictionaryData,
    processImageArray
};