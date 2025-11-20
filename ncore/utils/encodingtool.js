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

'use strict';

const logger = require('#@logger');

/**
 * Encoding detection and conversion utilities
 */
class EncodingTool {
    constructor() {
        this.supportedEncodings = [
            'utf8', 'utf16le', 'utf16be', 'gbk', 'gb2312', 'big5', 
            'shift_jis', 'euc-jp', 'iso-8859-1', 'windows-1252'
        ];
    }

    /**
     * Detect encoding from buffer content
     * @param {Buffer} content - Buffer to detect encoding from
     * @returns {string} Detected encoding
     */
    detectEncoding(content) {
        if (!Buffer.isBuffer(content)) {
            logger.warn('Content is not a Buffer, returning utf8');
            return 'utf8';
        }

        // Check for BOM (Byte Order Mark)
        if (content.length >= 3 && content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
            return 'utf8';
        }
        
        if (content.length >= 2 && content[0] === 0xFF && content[1] === 0xFE) {
            return 'utf16le';
        }
        
        if (content.length >= 2 && content[0] === 0xFE && content[1] === 0xFF) {
            return 'utf16be';
        }
        
        // Try UTF-8 first
        try {
            const testString = content.toString('utf8');
            if (this.isValidUtf8(testString)) {
                return 'utf8';
            }
        } catch (error) {
            // UTF-8 decode failed
        }
        
        // Try other common encodings
        for (const enc of this.supportedEncodings) {
            try {
                const iconv = require('iconv-lite');
                if (iconv.encodingExists(enc)) {
                    const decoded = iconv.decode(content, enc);
                    if (this.isValidUtf8(decoded)) {
                        return enc;
                    }
                }
            } catch (error) {
                // Try next encoding
            }
        }
        
        return 'utf8'; // Default fallback
    }

    /**
     * Check if string is valid UTF-8
     * @param {string} str - String to validate
     * @returns {boolean} True if valid UTF-8
     */
    isValidUtf8(str) {
        try {
            return str === decodeURIComponent(escape(str));
        } catch (error) {
            return false;
        }
    }

    /**
     * Convert buffer to UTF-8 string
     * @param {Buffer} content - Buffer to convert
     * @param {string} [encoding] - Source encoding (auto-detect if not provided)
     * @returns {string} UTF-8 string
     */
    convertToUtf8(content, encoding = null) {
        if (!Buffer.isBuffer(content)) {
            return content.toString('utf8');
        }

        const detectedEncoding = encoding || this.detectEncoding(content);
        const iconv = require('iconv-lite');
        
        try {
            if (iconv.encodingExists(detectedEncoding)) {
                return iconv.decode(content, detectedEncoding);
            } else {
                return content.toString('utf8');
            }
        } catch (error) {
            logger.warn(`Failed to convert from ${detectedEncoding}, using utf8: ${error.message}`);
            return content.toString('utf8');
        }
    }

    /**
     * Get list of supported encodings
     * @returns {string[]} Array of supported encoding names
     */
    getSupportedEncodings() {
        return [...this.supportedEncodings];
    }

    /**
     * Check if encoding is supported
     * @param {string} encoding - Encoding name to check
     * @returns {boolean} True if supported
     */
    isEncodingSupported(encoding) {
        try {
            const iconv = require('iconv-lite');
            return iconv.encodingExists(encoding);
        } catch (error) {
            return false;
        }
    }
}

module.exports = new EncodingTool(); 