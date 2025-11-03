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

// disguised.template.js
// This is a template for encrypted files - DO NOT MODIFY

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

// Embedded encrypted data and parameters
const ENCRYPTED_DATA = Buffer.from('eGYU0v5dPoIivx8c0qkci29CqGyuiPeLpipEJfY12goo1l1p1swxeZdQ80C3HpPTvWGDuc0aj7QjgHuhsO5gTpizXYreAWiACbuyrGYPbmtpTjb2oFjI95dfdMvhOIqZXWuYoBqiv3LHLmqpIa8cmk9JtpGw+llzvlEsvaaqtWqQ+CpyglTN3ERdnYwyjYtyQUbFm1+Tzc7rSnirleNr440vKyqvtNnkBzqjukTcBq/105TtNR+jx3UixdPK7+FtpYUIMEpLmXV4/yKrT3CxggMAtAsre9aMNxluo7MTwDlxzMuV+mW5IZHVxUKFPZfG6thO0S7ZNMp4w+7vVKDy1yJ5a3NozumcO9OeQiLHRunoHqWVRJsNIFG3HW0KaZX6PWTUYHT4tGEWn2xMa2wWkPwiA81TEixF6BLrMnwYDV4tNRQhGVe0zJ3cHjVi1zzAKBpkDXX0IhTjQnPZsYj1z+frpNbzoAexZ7FIwcpbk0tKu64JB+y0hcX2myoMjUteYmLMJMQPq1cUSx2ACJZJRL5h5HjU9At06eIqX4XhgK7L+jIqZc8Jr4rVYKH11fDCiXoH+dnrFtX3hQzIVTJw9NMHqCWUH6cZPu9PLgMQDo/Z6pqRCSzkorfTzb3tzlMN8+6dXdXR60roGifQouScYAOPHjCAx0ZZIgaowOz6uhzPzNV2MLYZwOGwjJorxGPitq6XTep2', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('HYGqcqLTm7dwkYxjiJctslSsIgHiusDdP02RCZxyHL3myD/puDuKXP64AJiLaxFkxPPQqCcZuSsCjeTYReM7ycimwZQtJ7i+SAWm18cyRKaIN3P6MqrO0uIHlsPPz5r+Le28dnS/7vjoJYGqiifSWhUVY5+DyjGhxYn5jG9ZTHLZn8MNPO3RsCs72g+2xl1lTZTbwWpDWSEnqOUzCMOgWNoI8er8NyjiKwXrnB4czVNE3a1w1toN3aEakY0RyzUjWAdt7L0JetHZWcxkHP54ct124GkLhNGVZBG0PWykzGkOYcOUBRPQ/tIOosylXqjV8BmRdMX2E+HAEqQvOnHtvyZgKOR4VzCeHXvh2JgUOUBO0oMvoJkNyrI7RMQO1bLHtJ16QTzIJyvj3WW8dySeRACzx27vIyv5IlXCk5BHPeaN1YAy6xpj3Ju2lUGsImgjmoxcvQkWK2fBUyjKo7j6XAhDvHXN92PtRFD3TukXbUauRYTR4g7bgjAuL8rbrkbc', 'base64');
const PARAMS_KEY = Buffer.from('ZrytMuu5hDzqgsEYuLBsJJmQ+zmNraTp9w7Fo+hIedw=', 'base64');
const PARAMS_IV = Buffer.from('cwHPqrmhX3ZfnU8l6Y+AXQ==', 'base64');
const ORIGINAL_FILENAME = 'SERVERMANAGER_JSON';

// Function to deobfuscate parameters
function deobfuscateParams() {
    const decipher = crypto.createDecipheriv('aes-256-cbc', PARAMS_KEY, PARAMS_IV);
    const decrypted = Buffer.concat([
        decipher.update(OBFUSCATED_PARAMS),
        decipher.final()
    ]);
    return JSON.parse(decrypted.toString());
}

// Function to derive key with pepper
async function deriveKey(password, salt, pepper, params) {
    // Combine password with pepper
    const pepperedPassword = Buffer.concat([
        Buffer.from(password),
        pepper
    ]);
    
    // First round of key derivation
    const key1 = crypto.pbkdf2Sync(
        pepperedPassword,
        salt,
        params.iterations,
        params.keyLength,
        'sha512'
    );
    
    // Second round of key derivation using the first key as salt
    return crypto.pbkdf2Sync(
        key1,
        salt,
        params.iterations / 2,
        params.keyLength,
        'sha512'
    );
}

// Function to verify HMAC
function verifyHMAC(key, encrypted, authTag, params) {
    const hmac = crypto.createHmac('sha512', key);
    hmac.update(encrypted);
    hmac.update(authTag);
    const calculatedDigest = hmac.digest();
    return crypto.timingSafeEqual(calculatedDigest, Buffer.from(params.hmacDigest, 'base64'));
}

// Function to generate fake data
function generateFakeData() {
    const fakeData = Buffer.alloc(1024); // 1KB of random data
    crypto.randomFillSync(fakeData);
    return fakeData;
}

async function decrypt(password, outputDir = '.', options = {}) {
    try {
        // Validate password
        if (!password) {
            console.error('Error: Password is required');
            process.exit(1);
        }

        // Deobfuscate parameters
        const params = deobfuscateParams();
        
        // Convert string parameters to buffers
        const salt = Buffer.from(params.salt, 'base64');
        const iv = Buffer.from(params.iv, 'base64');
        const authTag = Buffer.from(params.authTag, 'base64');
        const pepper = Buffer.from(params.pepper, 'base64');

        // Derive key with pepper
        const key = await deriveKey(password, salt, pepper, params);

        // Verify HMAC before decryption
        const isValid = verifyHMAC(key, ENCRYPTED_DATA, authTag, params);
        
        let decrypted;
        try {
            // Decrypt data
            const decipher = crypto.createDecipheriv(params.algorithm, key, iv);
            decipher.setAuthTag(authTag);
            
            decrypted = Buffer.concat([
                decipher.update(ENCRYPTED_DATA),
                decipher.final()
            ]);
            
            // Decompress data
            decrypted = zlib.inflateSync(decrypted);
        } catch (err) {
            // If decryption fails, use fake data
            decrypted = generateFakeData();
        }
        
        // Prepare output path
        const outputPath = path.join(outputDir, ORIGINAL_FILENAME);
        
        // Check if file already exists
        if (fs.existsSync(outputPath)) {
            if (!options.force) {
                console.log(`Skipping: File already exists (${outputPath})`);
                console.log('Use --force to overwrite existing file');
                return outputPath;
            }
        }
        
        // Write decrypted file
        fs.writeFileSync(outputPath, decrypted);
        
        if (isValid) {
            console.log(`File decrypted successfully to: ${outputPath}`);
            console.log('Note: Always verify the decrypted file content to ensure the password is correct.');
        } else {
            console.log(`File written to: ${outputPath}`);
            console.log('Warning: The password may be incorrect. Please verify the file content.');
        }
        
        return outputPath;
    } catch (err) {
        console.error('Decryption failed:', err.message);
        process.exit(1);
    }
}

// Function to show password hint
function showPasswordHint() {
    try {
        const params = deobfuscateParams();
        console.log(`Password hint: ${params.passwordHint}`);
    } catch (err) {
        console.error('Failed to show password hint:', err.message);
        process.exit(1);
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (!command) {
        console.log(`
Usage: node ${path.basename(__filename)} [COMMAND] [ARGUMENTS]

Commands:
  show                    Show password hint
  pwd [PASSWORD] [OUTPUT_DIR] Decrypt file

Options:
  --force                 Overwrite existing file

Examples:
  Show hint: node ${path.basename(__filename)} show
  Decrypt: node ${path.basename(__filename)} pwd mypassword ./output
  Force overwrite: node ${path.basename(__filename)} pwd mypassword ./output --force
`);
        process.exit(1);
    }
    
    if (command === 'show') {
        showPasswordHint();
    } else if (command === 'pwd') {
        const password = args[1];
        const outputDir = args[2] || '.';
        const options = {
            force: args.includes('--force')
        };
        if (!password) {
            console.error('Error: Password is required after pwd command');
            process.exit(1);
        }
        decrypt(password, outputDir, options).catch(err => {
            console.error('Decryption failed:', err.message);
            process.exit(1);
        });
    } else {
        console.error('Invalid command. Use "show" or "pwd"');
        process.exit(1);
    }
}

module.exports = { decrypt, showPasswordHint };