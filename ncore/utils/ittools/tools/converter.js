// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const logger = require('#@logger');

class ConverterTools {
    constructor() {
        this.tools = [
            {
                id: 'base64_encode',
                name: 'Base64 Encode',
                description: 'Encode text to Base64',
                category: 'converter',
                icon: 'code',
                endpoint: '/converter/base64/encode',
                method: 'POST',
                keywords: ['base64', 'encode', 'encoding', 'conversion']
            },
            {
                id: 'base64_decode',
                name: 'Base64 Decode',
                description: 'Decode Base64 to text',
                category: 'converter',
                icon: 'code',
                endpoint: '/converter/base64/decode',
                method: 'POST',
                keywords: ['base64', 'decode', 'decoding', 'conversion']
            },
            {
                id: 'url_encode',
                name: 'URL Encode',
                description: 'Encode text for URL',
                category: 'converter',
                icon: 'link',
                endpoint: '/converter/url/encode',
                method: 'POST',
                keywords: ['url', 'encode', 'percent-encoding']
            },
            {
                id: 'url_decode',
                name: 'URL Decode',
                description: 'Decode URL encoded text',
                category: 'converter',
                icon: 'link',
                endpoint: '/converter/url/decode',
                method: 'POST',
                keywords: ['url', 'decode', 'percent-decoding']
            }
        ];
    }

    getToolList() {
        return this.tools;
    }

    async execute(toolId, params) {
        switch (toolId) {
            case 'base64_encode':
                return this.base64Encode(params.text);
            case 'base64_decode':
                return this.base64Decode(params.text);
            case 'url_encode':
                return this.urlEncode(params.text);
            case 'url_decode':
                return this.urlDecode(params.text);
            default:
                throw new Error(`Unknown converter tool: ${toolId}`);
        }
    }

    base64Encode(text) {
        if (!text && text !== '') {
            throw new Error('Text is required');
        }

        try {
            const buffer = Buffer.from(text, 'utf-8');
            const encoded = buffer.toString('base64');

            return {
                encoded: encoded,
                originalLength: text.length,
                encodedLength: encoded.length
            };
        } catch (error) {
            logger.error(`Base64 encode error: ${error.message}`);
            throw new Error(`Failed to encode Base64: ${error.message}`);
        }
    }

    base64Decode(text) {
        if (!text) {
            throw new Error('Text is required');
        }

        try {
            const buffer = Buffer.from(text, 'base64');
            const decoded = buffer.toString('utf-8');

            return {
                decoded: decoded,
                originalLength: text.length,
                decodedLength: decoded.length
            };
        } catch (error) {
            logger.error(`Base64 decode error: ${error.message}`);
            throw new Error(`Failed to decode Base64: ${error.message}`);
        }
    }

    urlEncode(text) {
        if (!text && text !== '') {
            throw new Error('Text is required');
        }

        try {
            const encoded = encodeURIComponent(text);

            return {
                encoded: encoded,
                originalLength: text.length,
                encodedLength: encoded.length
            };
        } catch (error) {
            logger.error(`URL encode error: ${error.message}`);
            throw new Error(`Failed to encode URL: ${error.message}`);
        }
    }

    urlDecode(text) {
        if (!text) {
            throw new Error('Text is required');
        }

        try {
            const decoded = decodeURIComponent(text);

            return {
                decoded: decoded,
                originalLength: text.length,
                decodedLength: decoded.length
            };
        } catch (error) {
            logger.error(`URL decode error: ${error.message}`);
            throw new Error(`Failed to decode URL: ${error.message}`);
        }
    }
}

module.exports = ConverterTools;
