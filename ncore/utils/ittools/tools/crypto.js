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
                description: 'Generate MD5, SHA1, SHA256, SHA512 hashes and more',
                category: 'crypto',
                icon: 'hashtag',
                endpoint: '/crypto/hash',
                method: 'POST',
                keywords: ['hash', 'md5', 'sha256', 'checksum', 'encryption', 'digest', 'crypto', 'security']
            },
            {
                id: 'bcrypt',
                name: 'Bcrypt',
                description: 'Generate and verify bcrypt password hashes',
                category: 'crypto',
                icon: 'key',
                endpoint: '/crypto/bcrypt',
                method: 'POST',
                keywords: ['bcrypt', 'password', 'hash', 'security', 'encryption']
            },
            {
                id: 'uuid_generator',
                name: 'UUID Generator',
                description: 'Generate v4 UUIDs (Universally Unique Identifiers)',
                category: 'crypto',
                icon: 'fingerprint',
                endpoint: '/crypto/uuid/generate',
                method: 'POST',
                keywords: ['uuid', 'guid', 'unique', 'identifier', 'generator']
            },
            {
                id: 'token_generator',
                name: 'Token Generator',
                description: 'Generate random tokens with custom length and charset',
                category: 'crypto',
                icon: 'key',
                endpoint: '/crypto/token/generate',
                method: 'POST',
                keywords: ['token', 'random', 'generate', 'string', 'password', 'api-key']
            },
            {
                id: 'ulid_generator',
                name: 'ULID Generator',
                description: 'Generate Universally Unique Lexicographically Sortable Identifiers',
                category: 'crypto',
                icon: 'sort-numeric-down',
                endpoint: '/crypto/ulid/generate',
                method: 'POST',
                keywords: ['ulid', 'identifier', 'sortable', 'unique', 'generator']
            },
            {
                id: 'bip39_generator',
                name: 'BIP39 Generator',
                description: 'Generate BIP39 mnemonic seed phrases for crypto wallets',
                category: 'crypto',
                icon: 'wallet',
                endpoint: '/crypto/bip39/generate',
                method: 'POST',
                keywords: ['bip39', 'mnemonic', 'seed', 'crypto', 'wallet', 'recovery']
            },
            {
                id: 'hmac_generator',
                name: 'HMAC Generator',
                description: 'Generate HMAC (Hash-based Message Authentication Code)',
                category: 'crypto',
                icon: 'shield-alt',
                endpoint: '/crypto/hmac',
                method: 'POST',
                keywords: ['hmac', 'hash', 'authentication', 'security', 'signature']
            },
            {
                id: 'rsa_key_pair_generator',
                name: 'RSA Key Pair Generator',
                description: 'Generate RSA public/private key pairs',
                category: 'crypto',
                icon: 'lock',
                endpoint: '/crypto/rsa/generate',
                method: 'POST',
                keywords: ['rsa', 'key-pair', 'encryption', 'ssl', 'tls', 'certificate']
            },
            {
                id: 'encryption',
                name: 'Encryption',
                description: 'Encrypt and decrypt text using various algorithms',
                category: 'crypto',
                icon: 'lock',
                endpoint: '/crypto/encrypt',
                method: 'POST',
                keywords: ['encryption', 'decryption', 'aes', 'cipher', 'security']
            },
            {
                id: 'password_strength_analyser',
                name: 'Password Strength Analyser',
                description: 'Analyze password strength and get suggestions',
                category: 'crypto',
                icon: 'shield-alt',
                endpoint: '/crypto/password/analyze',
                method: 'POST',
                keywords: ['password', 'strength', 'security', 'analyze', 'checker']
            },
            {
                id: 'otp_code_generator_and_validator',
                name: 'OTP Generator & Validator',
                description: 'Generate and validate One-Time Password codes (TOTP)',
                category: 'crypto',
                icon: 'clock',
                endpoint: '/crypto/otp',
                method: 'POST',
                keywords: ['otp', 'totp', '2fa', 'authenticator', 'verification']
            },
            {
                id: 'pdf_signature_checker',
                name: 'PDF Signature Checker',
                description: 'Verify digital signatures in PDF files',
                category: 'crypto',
                icon: 'file-pdf',
                endpoint: '/crypto/pdf/signature',
                method: 'POST',
                keywords: ['pdf', 'signature', 'verify', 'digital', 'document']
            },
            {
                id: 'basic_auth_generator',
                name: 'Basic Auth Generator',
                description: 'Generate Basic Authentication headers',
                category: 'crypto',
                icon: 'user-shield',
                endpoint: '/crypto/basic-auth',
                method: 'POST',
                keywords: ['basic-auth', 'authorization', 'header', 'http', 'credentials']
            },
            {
                id: 'random_port_generator',
                name: 'Random Port Generator',
                description: 'Generate random available network ports',
                category: 'crypto',
                icon: 'network-wired',
                endpoint: '/crypto/random-port',
                method: 'POST',
                keywords: ['port', 'random', 'network', 'tcp', 'udp']
            },
            {
                id: 'numeronym_generator',
                name: 'Numeronym Generator',
                description: 'Generate numeronyms (like i18n for internationalization)',
                category: 'crypto',
                icon: 'compress',
                endpoint: '/crypto/numeronym',
                method: 'POST',
                keywords: ['numeronym', 'abbreviation', 'i18n', 'shorten']
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
            case 'bcrypt':
                return await this.bcryptHash(params.text, params.salt_rounds);
            case 'uuid_generator':
                return this.generateUUID(params.count, params.uppercase);
            case 'token_generator':
                return this.generateToken(params.length, params.charset);
            case 'ulid_generator':
                return this.generateULID(params.count);
            case 'bip39_generator':
                return this.generateBIP39(params.entropy_bits);
            case 'hmac_generator':
                return this.generateHMAC(params.message, params.secret, params.algorithm);
            case 'rsa_key_pair_generator':
                return this.generateRSAKeyPair(params.key_size, params.format);
            case 'encryption':
                return this.encryption(params.text, params.password, params.algorithm, params.operation);
            case 'password_strength_analyser':
                return this.analyzePasswordStrength(params.password);
            case 'otp_code_generator_and_validator':
                return this.generateOTP(params.secret, params.digits, params.period);
            case 'pdf_signature_checker':
                return this.checkPDFSignature(params.file);
            case 'basic_auth_generator':
                return this.generateBasicAuth(params.username, params.password);
            case 'random_port_generator':
                return this.generateRandomPort(params.count, params.range);
            case 'numeronym_generator':
                return this.generateNumeronym(params.text);
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

    async bcryptHash(text, saltRounds = 10) {
        if (!text) {
            throw new Error('Text is required');
        }

        const rounds = parseInt(saltRounds) || 10;
        if (rounds < 4 || rounds > 31) {
            throw new Error('Salt rounds must be between 4 and 31');
        }

        try {
            const bcrypt = require('bcryptjs');
            const hash = await bcrypt.hash(text, rounds);

            return {
                hash: hash,
                saltRounds: rounds,
                algorithm: 'bcrypt'
            };
        } catch (error) {
            logger.error(`Bcrypt hash error: ${error.message}`);
            throw new Error(`Failed to generate bcrypt hash: ${error.message}`);
        }
    }

    generateULID(count = 1) {
        const ulidCount = parseInt(count) || 1;
        if (ulidCount < 1 || ulidCount > 100) {
            throw new Error('Count must be between 1 and 100');
        }

        try {
            const { ulid } = require('ulid');
            const ulids = [];

            for (let i = 0; i < ulidCount; i++) {
                ulids.push(ulid());
            }

            return {
                ulids: ulids,
                count: ulids.length
            };
        } catch (error) {
            logger.error(`ULID generation error: ${error.message}`);
            throw new Error(`Failed to generate ULID: ${error.message}`);
        }
    }

    generateBIP39(entropyBits = 128) {
        const validBits = [128, 160, 192, 224, 256];
        const bits = parseInt(entropyBits) || 128;

        if (!validBits.includes(bits)) {
            throw new Error(`Entropy bits must be one of: ${validBits.join(', ')}`);
        }

        try {
            const bip39 = require('bip39');
            const mnemonic = bip39.generateMnemonic(bits);
            const wordCount = mnemonic.split(' ').length;

            return {
                mnemonic: mnemonic,
                wordCount: wordCount,
                entropyBits: bits
            };
        } catch (error) {
            logger.error(`BIP39 generation error: ${error.message}`);
            throw new Error(`Failed to generate BIP39 mnemonic: ${error.message}`);
        }
    }

    generateHMAC(message, secret, algorithm = 'sha256') {
        if (!message) {
            throw new Error('Message is required');
        }
        if (!secret) {
            throw new Error('Secret is required');
        }

        const validAlgorithms = ['md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512'];
        if (!validAlgorithms.includes(algorithm.toLowerCase())) {
            throw new Error(`Invalid algorithm. Must be one of: ${validAlgorithms.join(', ')}`);
        }

        try {
            const hmac = crypto.createHmac(algorithm.toLowerCase(), secret);
            hmac.update(message);
            const result = hmac.digest('hex');

            return {
                hmac: result,
                algorithm: algorithm.toLowerCase(),
                length: result.length
            };
        } catch (error) {
            logger.error(`HMAC generation error: ${error.message}`);
            throw new Error(`Failed to generate HMAC: ${error.message}`);
        }
    }

    generateRSAKeyPair(keySize = 2048, format = 'pem') {
        const validSizes = [512, 1024, 2048, 4096, 8192];
        const size = parseInt(keySize) || 2048;

        if (!validSizes.includes(size)) {
            throw new Error(`Key size must be one of: ${validSizes.join(', ')}`);
        }

        const validFormats = ['pem', 'der'];
        if (!validFormats.includes(format.toLowerCase())) {
            throw new Error(`Format must be one of: ${validFormats.join(', ')}`);
        }

        try {
            const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: size,
                publicKeyEncoding: {
                    type: 'spki',
                    format: format.toLowerCase()
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: format.toLowerCase()
                }
            });

            const result = {
                keySize: size,
                format: format.toLowerCase()
            };

            if (format.toLowerCase() === 'pem') {
                result.publicKey = publicKey;
                result.privateKey = privateKey;
            } else {
                result.publicKey = publicKey.toString('base64');
                result.privateKey = privateKey.toString('base64');
            }

            return result;
        } catch (error) {
            logger.error(`RSA key pair generation error: ${error.message}`);
            throw new Error(`Failed to generate RSA key pair: ${error.message}`);
        }
    }

    encryption(text, password, algorithm = 'aes-256-gcm', operation = 'encrypt') {
        if (!text) {
            throw new Error('Text is required');
        }
        if (!password) {
            throw new Error('Password is required');
        }

        const validAlgorithms = ['aes-256-gcm', 'aes-256-cbc', 'aes-128-gcm', 'aes-128-cbc'];
        if (!validAlgorithms.includes(algorithm.toLowerCase())) {
            throw new Error(`Invalid algorithm. Must be one of: ${validAlgorithms.join(', ')}`);
        }

        try {
            if (operation === 'encrypt') {
                const iv = crypto.randomBytes(16);
                const key = crypto.scryptSync(password, 'salt', 32);
                const cipher = crypto.createCipheriv(algorithm.toLowerCase(), key, iv);

                let encrypted = cipher.update(text, 'utf8', 'hex');
                encrypted += cipher.final('hex');

                let authTag = '';
                if (algorithm.toLowerCase().includes('gcm')) {
                    authTag = cipher.getAuthTag().toString('hex');
                }

                return {
                    encrypted: encrypted,
                    iv: iv.toString('hex'),
                    authTag: authTag,
                    algorithm: algorithm.toLowerCase()
                };
            } else if (operation === 'decrypt') {
                throw new Error('Decryption requires encrypted data, IV, and auth tag');
            } else {
                throw new Error('Operation must be either "encrypt" or "decrypt"');
            }
        } catch (error) {
            logger.error(`Encryption error: ${error.message}`);
            throw new Error(`Failed to encrypt/decrypt: ${error.message}`);
        }
    }

    analyzePasswordStrength(password) {
        if (!password) {
            throw new Error('Password is required');
        }

        try {
            const length = password.length;
            const hasLowercase = /[a-z]/.test(password);
            const hasUppercase = /[A-Z]/.test(password);
            const hasNumbers = /\d/.test(password);
            const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

            let score = 0;
            let strength = 'very-weak';
            let suggestions = [];

            if (length >= 8) score += 1;
            if (length >= 12) score += 1;
            if (length >= 16) score += 1;
            if (hasLowercase) score += 1;
            if (hasUppercase) score += 1;
            if (hasNumbers) score += 1;
            if (hasSpecialChars) score += 1;

            if (score <= 2) {
                strength = 'very-weak';
                suggestions.push('Password is too weak');
            } else if (score <= 4) {
                strength = 'weak';
                suggestions.push('Consider making password longer');
            } else if (score <= 6) {
                strength = 'medium';
                suggestions.push('Good password, but could be stronger');
            } else {
                strength = 'strong';
                suggestions.push('Strong password!');
            }

            if (!hasLowercase) suggestions.push('Add lowercase letters');
            if (!hasUppercase) suggestions.push('Add uppercase letters');
            if (!hasNumbers) suggestions.push('Add numbers');
            if (!hasSpecialChars) suggestions.push('Add special characters');
            if (length < 12) suggestions.push('Use at least 12 characters');

            return {
                strength: strength,
                score: score,
                maxScore: 7,
                length: length,
                hasLowercase: hasLowercase,
                hasUppercase: hasUppercase,
                hasNumbers: hasNumbers,
                hasSpecialChars: hasSpecialChars,
                suggestions: suggestions
            };
        } catch (error) {
            logger.error(`Password strength analysis error: ${error.message}`);
            throw new Error(`Failed to analyze password strength: ${error.message}`);
        }
    }

    generateOTP(secret, digits = 6, period = 30) {
        const otpDigits = parseInt(digits) || 6;
        const otpPeriod = parseInt(period) || 30;

        if (otpDigits < 6 || otpDigits > 8) {
            throw new Error('Digits must be between 6 and 8');
        }

        if (otpPeriod < 15 || otpPeriod > 300) {
            throw new Error('Period must be between 15 and 300 seconds');
        }

        try {
            const generatedSecret = secret || crypto.randomBytes(20).toString('hex');

            const now = Math.floor(Date.now() / 1000);
            const counter = Math.floor(now / otpPeriod);

            const hmac = crypto.createHmac('sha1', Buffer.from(generatedSecret, 'hex'));
            const counterBuffer = Buffer.alloc(8);
            counterBuffer.writeBigInt64BE(BigInt(counter));
            hmac.update(counterBuffer);
            const hash = hmac.digest();

            const offset = hash[hash.length - 1] & 0xf;
            const binary = ((hash[offset] & 0x7f) << 24) |
                          ((hash[offset + 1] & 0xff) << 16) |
                          ((hash[offset + 2] & 0xff) << 8) |
                          (hash[offset + 3] & 0xff);

            const otp = (binary % Math.pow(10, otpDigits)).toString().padStart(otpDigits, '0');
            const remainingTime = otpPeriod - (now % otpPeriod);

            return {
                code: otp,
                secret: generatedSecret,
                digits: otpDigits,
                period: otpPeriod,
                remainingTime: remainingTime,
                algorithm: 'TOTP'
            };
        } catch (error) {
            logger.error(`OTP generation error: ${error.message}`);
            throw new Error(`Failed to generate OTP: ${error.message}`);
        }
    }

    checkPDFSignature(file) {
        try {
            return {
                success: false,
                error: 'PDF signature checking requires file upload and is not yet implemented',
                message: 'This feature requires a file upload mechanism'
            };
        } catch (error) {
            logger.error(`PDF signature check error: ${error.message}`);
            throw new Error(`Failed to check PDF signature: ${error.message}`);
        }
    }

    generateBasicAuth(username, password) {
        if (!username) {
            throw new Error('Username is required');
        }
        if (!password) {
            throw new Error('Password is required');
        }

        try {
            const credentials = `${username}:${password}`;
            const encoded = Buffer.from(credentials).toString('base64');
            const header = `Basic ${encoded}`;

            return {
                header: header,
                username: username,
                encoded: encoded
            };
        } catch (error) {
            logger.error(`Basic auth generation error: ${error.message}`);
            throw new Error(`Failed to generate basic auth: ${error.message}`);
        }
    }

    generateRandomPort(count = 1, range = '1024-65535') {
        const portCount = parseInt(count) || 1;
        if (portCount < 1 || portCount > 10) {
            throw new Error('Count must be between 1 and 10');
        }

        try {
            const [minPort, maxPort] = range.split('-').map(p => parseInt(p.trim()));

            if (minPort < 1024 || maxPort > 65535 || minPort >= maxPort) {
                throw new Error('Invalid port range. Must be between 1024 and 65535');
            }

            const ports = [];
            const portSet = new Set();

            while (portSet.size < portCount) {
                const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
                portSet.add(port);
            }

            return {
                ports: Array.from(portSet),
                count: portSet.size,
                range: range
            };
        } catch (error) {
            logger.error(`Random port generation error: ${error.message}`);
            throw new Error(`Failed to generate random ports: ${error.message}`);
        }
    }

    generateNumeronym(text) {
        if (!text) {
            throw new Error('Text is required');
        }

        try {
            const words = text.split(/\s+/);
            const numeronyms = words.map(word => {
                if (word.length <= 3) {
                    return word;
                }

                const first = word[0];
                const last = word[word.length - 1];
                const middle = word.length - 2;

                return `${first}${middle}${last}`;
            });

            return {
                original: text,
                numeronym: numeronyms.join(' '),
                wordCount: words.length
            };
        } catch (error) {
            logger.error(`Numeronym generation error: ${error.message}`);
            throw new Error(`Failed to generate numeronym: ${error.message}`);
        }
    }
}

module.exports = CryptoTools;
