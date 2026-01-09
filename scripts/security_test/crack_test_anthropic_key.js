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
 * Security Testing Script for Company Encryption Service
 * Purpose: Test the security strength of the disguise.js encryption implementation
 *
 * Attack Vectors Tested:
 * 1. Dictionary Attack - Common passwords
 * 2. Brute Force Attack - Sequential password generation
 * 3. Parameter Analysis - Extract and analyze encryption parameters
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

// Declare all variables at the beginning
const ENCRYPTED_DATA = Buffer.from('xt5Ak2RYXG/XNPzjfV1wkrNTRnAHBZ+ktombq2ip1Biobxt1uf97NqjWgrWlVh2wh7xZTFHVt0w0vEMnKio=', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('2i5HlrZbpub5YV0P0hkSduDEGe1xjzEtapd/BZgXVf2IBWNLRTuqPZH4Ext3jAozEifTxXarBDYCSfDgTh/uz0KAd30d55G1xK3U6us4tbT1j2uqLVLCSckUPR/h5IgHVpqZKd45+CcZxBnGZBkJ/kT4HRnOumi0V4uoyLPgEVlma/Yha3U+oHV3Y3BvL/nLwneU0t+VfyXGNTVnOxpKJoD3qBtJVVW65SodkgpsMy6iv6OxS5V0MSyfSqaAuox06P2cQBvBQ9d94v+V9wS16VnzX6ovz33upoYOOJB9RB0D4DVjobXroPIoNsXABC5ZfjfC/oyBPlulgNGjd4Q0g5Ip/EsGTV0KhnfsH1hCkGoLSKbjQwwS+CFJYTQcBbTMQWAWzi/VGRhsBdF8VAKLxfdYZtcX/IvzI8H/g6+bGN+0f2hElJaSEhPTyWW6DcXZlSKzdOKfR9/g5VUpto6ZB6XcYOhcJLAkbdgnMKiyMmJe8CpKWfCpwZhsBouPSzW/', 'base64');
const PARAMS_KEY = Buffer.from('K2rThDG7vC+WNnqhBIHNfYFa29R5gaUlkAxS9rAGtus=', 'base64');
const PARAMS_IV = Buffer.from('5yf0zpzjhbWx91zY/GLYmQ==', 'base64');

// Statistics
let attemptCount = 0;
let startTime = Date.now();

// Deobfuscate parameters (this is always possible as the key is hardcoded)
function deobfuscateParams() {
    const decipher = crypto.createDecipheriv('aes-256-cbc', PARAMS_KEY, PARAMS_IV);
    const decrypted = Buffer.concat([
        decipher.update(OBFUSCATED_PARAMS),
        decipher.final()
    ]);
    return JSON.parse(decrypted.toString());
}

// Derive key with pepper (same as encryption)
async function deriveKey(password, salt, pepper, params) {
    const pepperedPassword = Buffer.concat([
        Buffer.from(password),
        pepper
    ]);

    const key1 = crypto.pbkdf2Sync(
        pepperedPassword,
        salt,
        params.iterations,
        params.keyLength,
        'sha512'
    );

    return crypto.pbkdf2Sync(
        key1,
        salt,
        params.iterations / 2,
        params.keyLength,
        'sha512'
    );
}

// Verify HMAC
function verifyHMAC(key, encrypted, authTag, params) {
    const hmac = crypto.createHmac('sha512', key);
    hmac.update(encrypted);
    hmac.update(authTag);
    const calculatedDigest = hmac.digest();
    return crypto.timingSafeEqual(calculatedDigest, Buffer.from(params.hmacDigest, 'base64'));
}

// Test a single password
async function testPassword(password, params, salt, iv, authTag, pepper, verbose = false) {
    attemptCount++;

    if (verbose && attemptCount % 100 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = attemptCount / elapsed;
        console.log(`[INFO] Tested ${attemptCount} passwords (${rate.toFixed(2)} pwd/sec)`);
    }

    try {
        // Derive key
        const key = await deriveKey(password, salt, pepper, params);

        // Verify HMAC first (faster than decryption)
        const isValid = verifyHMAC(key, ENCRYPTED_DATA, authTag, params);

        if (!isValid) {
            return false;
        }

        // If HMAC is valid, try to decrypt
        const decipher = crypto.createDecipheriv(params.algorithm, key, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(ENCRYPTED_DATA),
            decipher.final()
        ]);

        // Decompress
        const decompressed = zlib.inflateSync(decrypted);

        // Check if decompressed data looks valid (not random bytes)
        const text = decompressed.toString();
        if (text.includes('sk-ant-') || text.length > 20) {
            console.log('\n[SUCCESS] Password found:', password);
            console.log('[SUCCESS] Decrypted content length:', text.length);
            console.log('[SUCCESS] First 50 chars:', text.substring(0, 50));
            return true;
        }

        return false;
    } catch (err) {
        return false;
    }
}

// Dictionary attack with common passwords
async function dictionaryAttack(params) {
    console.log('\n[ATTACK 1] Dictionary Attack - Testing common passwords...');

    const commonPasswords = [
        // Top 100 most common passwords
        'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567', 'letmein',
        'trustno1', 'dragon', 'baseball', 'iloveyou', 'master', 'sunshine', 'ashley', 'bailey',
        'passw0rd', 'shadow', '123123', '654321', 'superman', 'qazwsx', 'michael', 'football',
        'password1', 'password123', 'admin', 'root', 'test', 'demo', 'user', 'guest',
        // Company-specific patterns
        'anthropic', 'claude', 'ai', 'apikey', 'secret', 'encryption', 'disguise',
        'Anthropic', 'Claude', 'API', 'Secret', 'Encryption', 'Disguise',
        'anthropic123', 'claude123', 'api123', 'secret123',
        // Weak patterns
        '12345', '123456789', '1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
        // Empty and simple
        '', ' ', 'a', '1', 'aa', '11', 'aaa', '111',
        // Date patterns
        '2024', '2025', '2026', '20240101', '20250101',
        // Developer patterns
        'dev', 'developer', 'development', 'test123', 'testing', 'temp', 'temporary'
    ];

    const salt = Buffer.from(params.salt, 'base64');
    const iv = Buffer.from(params.iv, 'base64');
    const authTag = Buffer.from(params.authTag, 'base64');
    const pepper = Buffer.from(params.pepper, 'base64');

    for (const password of commonPasswords) {
        const result = await testPassword(password, params, salt, iv, authTag, pepper);
        if (result) {
            return password;
        }
    }

    console.log('[ATTACK 1] Dictionary attack failed - no common password found');
    return null;
}

// Brute force attack with sequential passwords
async function bruteForceAttack(params, maxAttempts = 10000) {
    console.log(`\n[ATTACK 2] Brute Force Attack - Testing up to ${maxAttempts} sequential passwords...`);

    const salt = Buffer.from(params.salt, 'base64');
    const iv = Buffer.from(params.iv, 'base64');
    const authTag = Buffer.from(params.authTag, 'base64');
    const pepper = Buffer.from(params.pepper, 'base64');

    // Numeric passwords
    console.log('[ATTACK 2.1] Testing numeric passwords (0-9999)...');
    for (let i = 0; i < Math.min(maxAttempts, 10000); i++) {
        const password = i.toString();
        const result = await testPassword(password, params, salt, iv, authTag, pepper, true);
        if (result) {
            return password;
        }
    }

    // Alphabetic passwords (a-z, aa-zz)
    console.log('[ATTACK 2.2] Testing alphabetic passwords (a-zz)...');
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let tested = 0;

    // Single char
    for (const c of chars) {
        if (tested >= maxAttempts) break;
        const result = await testPassword(c, params, salt, iv, authTag, pepper, true);
        if (result) return c;
        tested++;
    }

    // Double char
    for (const c1 of chars) {
        if (tested >= maxAttempts) break;
        for (const c2 of chars) {
            if (tested >= maxAttempts) break;
            const password = c1 + c2;
            const result = await testPassword(password, params, salt, iv, authTag, pepper, true);
            if (result) return password;
            tested++;
        }
    }

    console.log('[ATTACK 2] Brute force attack failed - password not found in tested range');
    return null;
}

// Analyze encryption parameters
function analyzeParameters(params) {
    console.log('\n[ANALYSIS] Encryption Parameters:');
    console.log('=====================================');
    console.log('Algorithm:', params.algorithm);
    console.log('Key Length:', params.keyLength, 'bytes');
    console.log('Iterations:', params.iterations);
    console.log('Salt Length:', Buffer.from(params.salt, 'base64').length, 'bytes');
    console.log('IV Length:', Buffer.from(params.iv, 'base64').length, 'bytes');
    console.log('Pepper Length:', Buffer.from(params.pepper, 'base64').length, 'bytes');
    console.log('Auth Tag Length:', Buffer.from(params.authTag, 'base64').length, 'bytes');
    console.log('Password Hint:', params.passwordHint || 'None');
    console.log('=====================================');

    // Security assessment
    console.log('\n[SECURITY ASSESSMENT]');
    console.log('=====================================');

    // Check iterations
    if (params.iterations >= 100000) {
        console.log('✓ PBKDF2 iterations:', params.iterations, '(STRONG - >=100k recommended)');
    } else if (params.iterations >= 10000) {
        console.log('⚠ PBKDF2 iterations:', params.iterations, '(MODERATE - recommend >=100k)');
    } else {
        console.log('✗ PBKDF2 iterations:', params.iterations, '(WEAK - recommend >=100k)');
    }

    // Check key length
    if (params.keyLength >= 32) {
        console.log('✓ Key length:', params.keyLength, 'bytes (STRONG - 256-bit)');
    } else {
        console.log('⚠ Key length:', params.keyLength, 'bytes (consider 32 bytes for 256-bit)');
    }

    // Check salt length
    const saltLen = Buffer.from(params.salt, 'base64').length;
    if (saltLen >= 16) {
        console.log('✓ Salt length:', saltLen, 'bytes (STRONG - >=16 bytes recommended)');
    } else {
        console.log('⚠ Salt length:', saltLen, 'bytes (recommend >=16 bytes)');
    }

    // Check pepper usage
    const pepperLen = Buffer.from(params.pepper, 'base64').length;
    console.log('✓ Pepper used:', pepperLen, 'bytes (STRONG - adds extra layer)');

    // Check double derivation
    console.log('✓ Double key derivation: YES (STRONG - two rounds of PBKDF2)');

    // Check HMAC
    console.log('✓ HMAC verification: YES (STRONG - prevents tampering)');

    // Check compression
    console.log('✓ Data compression: YES (reduces encrypted data size)');

    console.log('=====================================');

    // Calculate approximate crack time
    const attemptsPerSecond = attemptCount / ((Date.now() - startTime) / 1000);
    console.log('\n[CRACK TIME ESTIMATION]');
    console.log('=====================================');
    console.log('Test speed:', attemptsPerSecond.toFixed(2), 'passwords/second');

    // Password space calculations
    const spaces = {
        '4-digit PIN': Math.pow(10, 4),
        '6-digit PIN': Math.pow(10, 6),
        '8-digit PIN': Math.pow(10, 8),
        '6-char lowercase': Math.pow(26, 6),
        '8-char lowercase': Math.pow(26, 8),
        '8-char alphanumeric': Math.pow(36, 8),
        '8-char mixed case + numbers': Math.pow(62, 8),
        '12-char mixed case + numbers + symbols': Math.pow(94, 12)
    };

    for (const [name, space] of Object.entries(spaces)) {
        const seconds = space / attemptsPerSecond;
        const hours = seconds / 3600;
        const days = hours / 24;
        const years = days / 365;

        let timeStr;
        if (years > 1) {
            timeStr = `${years.toFixed(0)} years`;
        } else if (days > 1) {
            timeStr = `${days.toFixed(0)} days`;
        } else if (hours > 1) {
            timeStr = `${hours.toFixed(0)} hours`;
        } else {
            timeStr = `${seconds.toFixed(0)} seconds`;
        }

        console.log(`  ${name}: ${timeStr} (${space.toExponential(2)} combinations)`);
    }
    console.log('=====================================');
}

// Main crack test function
async function runCrackTest() {
    console.log('=====================================');
    console.log('ENCRYPTION SECURITY TEST');
    console.log('Testing file: ANTHROPIC_API_KEY_5.js');
    console.log('Purpose: Security assessment of company encryption service');
    console.log('=====================================');

    // Step 1: Extract parameters
    console.log('\n[STEP 1] Extracting encryption parameters...');
    let params;
    try {
        params = deobfuscateParams();
        console.log('[SUCCESS] Parameters extracted successfully');
        console.log('[NOTE] Parameter obfuscation provides minimal security');
        console.log('[NOTE] PARAMS_KEY and PARAMS_IV are hardcoded in the file');
    } catch (err) {
        console.error('[FAILED] Cannot extract parameters:', err.message);
        process.exit(1);
    }

    // Step 2: Analyze parameters
    analyzeParameters(params);

    // Step 3: Dictionary attack
    startTime = Date.now();
    attemptCount = 0;
    const dictResult = await dictionaryAttack(params);
    if (dictResult) {
        console.log('\n[FINAL RESULT] Password cracked via dictionary attack!');
        console.log('[SECURITY RISK] The password is too weak and appears in common password lists');
        return dictResult;
    }

    // Step 4: Brute force attack (limited)
    const bruteResult = await bruteForceAttack(params, 5000);
    if (bruteResult) {
        console.log('\n[FINAL RESULT] Password cracked via brute force!');
        console.log('[SECURITY RISK] The password is too simple');
        return bruteResult;
    }

    // No password found
    console.log('\n[FINAL RESULT] Password not cracked');
    console.log('=====================================');
    console.log('[CONCLUSION] The encryption is reasonably secure IF:');
    console.log('  1. A strong password (12+ chars, mixed case, numbers, symbols) is used');
    console.log('  2. The password is not in common dictionaries');
    console.log('  3. The password is kept secret');
    console.log('');
    console.log('[VULNERABILITIES IDENTIFIED]');
    console.log('  1. Parameter obfuscation key is hardcoded (low risk)');
    console.log('  2. All parameters are extractable (expected, low risk)');
    console.log('  3. Success depends entirely on password strength');
    console.log('  4. No rate limiting (attacker can try unlimited passwords)');
    console.log('  5. No account lockout mechanism');
    console.log('=====================================');
    console.log('Total attempts:', attemptCount);
    console.log('Total time:', ((Date.now() - startTime) / 1000).toFixed(2), 'seconds');

    return null;
}

// Execute if run directly
if (require.main === module) {
    runCrackTest().catch(err => {
        console.error('Test failed:', err.message);
        process.exit(1);
    });
}

module.exports = { runCrackTest, deobfuscateParams, testPassword };
