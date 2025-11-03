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

const crypto = require('crypto');
const logger = require('#@logger');

class CryptoTools {
    constructor() {
        this.tools = [
            {
                id: 'hash_text',
                name: 'Hash Text',
                description: 'Generate MD5, SHA1, SHA256, SHA512 hashes',
                category: 'crypto',
                icon: 'hashtag',
                endpoint: '/crypto/hash',
                method: 'POST',
                keywords: ['hash', 'md5', 'sha256', 'checksum', 'encryption']
            },
            {
                id: 'uuid_generator',
                name: 'UUID Generator',
                description: 'Generate v4 UUIDs',
                category: 'crypto',
                icon: 'fingerprint',
                endpoint: '/crypto/uuid/generate',
                method: 'POST',
                keywords: ['uuid', 'guid', 'unique', 'identifier']
            },
            {
                id: 'token_generator',
                name: 'Token Generator',
                description: 'Generate random tokens with custom length and charset',
                category: 'crypto',
                icon: 'key',
                endpoint: '/crypto/token/generate',
                method: 'POST',
                keywords: ['token', 'random', 'generate', 'string']
            }
        ];
    }

    getToolList() {
        return this.tools;
    }

    async execute(toolId, params) {
        switch (toolId) {
            case 'hash_text':
                return this.hashText(params.text, params.algorithm);
            case 'uuid_generator':
                return this.generateUUID(params.count, params.uppercase);
            case 'token_generator':
                return this.generateToken(params.length, params.charset);
            default:
                throw new Error(`Unknown crypto tool: ${toolId}`);
        }
    }

    hashText(text, algorithm) {
        const validAlgorithms = ['md5', 'sha1', 'sha256', 'sha512'];

        if (!text) {
            throw new Error('Text is required');
        }

        if (!algorithm || !validAlgorithms.includes(algorithm.toLowerCase())) {
            throw new Error(`Invalid algorithm. Must be one of: ${validAlgorithms.join(', ')}`);
        }

        try {
            const hash = crypto.createHash(algorithm.toLowerCase());
            hash.update(text);
            const result = hash.digest('hex');

            return {
                hash: result,
                algorithm: algorithm.toLowerCase(),
                length: result.length
            };
        } catch (error) {
            logger.error(`Hash generation error: ${error.message}`);
            throw new Error(`Failed to generate hash: ${error.message}`);
        }
    }

    generateUUID(count = 1, uppercase = false) {
        const uuidCount = parseInt(count) || 1;
        const uuids = [];

        if (uuidCount < 1 || uuidCount > 100) {
            throw new Error('Count must be between 1 and 100');
        }

        try {
            for (let i = 0; i < uuidCount; i++) {
                let uuid = crypto.randomUUID();
                if (uppercase) {
                    uuid = uuid.toUpperCase();
                }
                uuids.push(uuid);
            }

            return {
                uuids: uuids,
                count: uuids.length
            };
        } catch (error) {
            logger.error(`UUID generation error: ${error.message}`);
            throw new Error(`Failed to generate UUID: ${error.message}`);
        }
    }

    generateToken(length = 32, charset = 'alphanumeric') {
        const tokenLength = parseInt(length) || 32;

        if (tokenLength < 1 || tokenLength > 256) {
            throw new Error('Token length must be between 1 and 256');
        }

        const charsets = {
            alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
            numeric: '0123456789',
            alphabetic: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
            special: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
        };

        const selectedCharset = charsets[charset] || charsets.alphanumeric;
        const charsetLength = selectedCharset.length;
        let token = '';

        try {
            const randomBytes = crypto.randomBytes(tokenLength);

            for (let i = 0; i < tokenLength; i++) {
                const randomIndex = randomBytes[i] % charsetLength;
                token += selectedCharset[randomIndex];
            }

            return {
                token: token,
                length: token.length,
                charset: charset
            };
        } catch (error) {
            logger.error(`Token generation error: ${error.message}`);
            throw new Error(`Failed to generate token: ${error.message}`);
        }
    }
}

module.exports = CryptoTools;
