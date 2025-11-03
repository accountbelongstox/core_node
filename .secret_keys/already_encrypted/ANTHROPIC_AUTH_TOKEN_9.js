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
const ENCRYPTED_DATA = Buffer.from('2oOnZd++7MdDjfJN/BTfwewCxkGEZk+yJlM74u1BbgDyKlVXwQpGSBbyTwUzgEpYY32of1aj9b8ZwHp7pcKAZwk7vM4xBdioQhzxTGnscUd5YWZqS1XtfsOXQIQyqtVwqy+o2SjJscRwBxOqlCViQHRz1TWaybJYiYgBba1JTfHeEDAJIvJm6Ej2x2B82/TcxzWHd6tcyK/VLS7tsju3+JNwJJ6icLfDfqDa1Jx9qy9OThLAoXUl2L5bChCK/xpVsLxM3YxfYHc0j4XiP1BLqn1Q5IF3wowcXJIei5oASSc0SYKlza8vqkcsu+rkX2T0yENirKTLDchqW+/1ZLqtnm3FEaBT4XzyKtgfEw9FWI5agMoNrH0Fmlc4q0eCNiRdT/65RMmOPJYa4wzU2OEMJ0hpZ5S82MgVN5gJReZiViBoMmF5d/Q9ZIik4PsqLt12oUyRk+Hd7Z1/TNmP40PslYSuukGavR64vKHIoDcTTZkr4Wtu4mc7/1LnsC6g37yd9/AzeMoRdDGGGlfGB3hkvZcpWGE3UIXAS/PcxqjY5jxL1AFxKEZwLhxBi8fEnERWf+A53zTLRuRRQYL68Eg7uuHeagljlu7GBw0HezcX9meNY7T0DO8Sq9TklTtfR7qGC+KWOfyGlVLPcXbJ1wpk7oCTZGbERc1AQI8RO/Pyt9D4YFJGxBvU4+w5Iqka7KvCOj7XUtmKd0ZsOUIFBC1x2mXyrsNG4JFFMqwKvc0SGARDIu2VsPKUlq70m/PevzyyMdUp5xYFvQCtOuiT01eQZFrao00CCjjJwzQUgnLx9JVSlR5YjA6Tfm/JZiFDoZhlGLoKEpHoLdSCKcqnhgNPZpSCiPwkb0aD3M0+OaS1/DEcujPQKNj66bK/Tzflb/QiSQ0VmpwRi9VS6sPBpT+DNnDxhsV+KYQOJ78ReogablhuQzVfksp4kzNdEIkzQfHQ82qUOkIWv0Oqs/20a5FgTq4R424KgLL1lg7Y26UwCWRhY1J7N8S6okmtBEUNaNeX6JsCi5OyxiBCtK8NBJA9XNF3A6p4pCu6FoBGfGja5pxcE3ll+bHXmwNihsvB+qrjKN81sa9W7Z0rbzsSvKjh3FbX9I7el+J1gx5Nx/6BjgPGCWyLLQ9kDhUVm+JbFYpuG+qMUfg10qKOBrcSCKPALih6tX5E4+wEcGI/peOKoKF3vXNB6M4Dun0wUmXJR7Fs7MGApCYDP2M2XFqW4h8+wNGdTY/gfEdiwrGBQCOtzjPWIeMDmNR1uN2Pg0BDs5RtAY3JaQUDMdXMgo1BP8NTuRZNsFqwdcShGy7w0uGLxEY8Z5tUBIP/36hQEzf3899XWS9oCujaO0GgqDpe5PTSsvfNw6eWy42dsbv1', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('WPWhaAUYTqjkUpmaaAedOVVwmCGk0CKTJ33yDLCaTDva2par+KUsbmZATpULjbMLOWfQ9NsxrlinpTG+3AJX9a6RPcV3IH0AKRosBhXwl4g6kHl2sD78JQ93xz7qNM2U19+XRXG6jlH7EXAU/6qr0REE565bSuGM5lAreHzuMY2kqHoi3ve0E4Nmc26eHFgLc1Y6KG/NA3qTeShZxLXZOGA57uWf06FS7fNwmoK0mT8lVadDA7+bWpRGgQEE4P5cigGZY3o9zj802ZHxVgKIzVR3J2BfrEVVKCzII4Nq1mep8hb5mbwd+frgee53Y7u3WZyijyNuUR3wSIcNVVQ0xljGj4yMRFJj9nU5aLIiw61NoUYQLtYJODJXPtiJYij7f5XuEgTHgnFc1oIWvSKB5ks8wUUdAbzMsYDHmuYuqh0lR1/ylm+ju7kflgXLj2e74r/Opao0qccniu22PSeFdJrNw1c9wQo+6+rv9MPQ/l0oqz4A8+WbSDB6gTfm+Tmb', 'base64');
const PARAMS_KEY = Buffer.from('u3WcJi67wxVA35Vayx0NqYVYd/OANNyAJmY7dO3Tlh4=', 'base64');
const PARAMS_IV = Buffer.from('u68PWASNBRSOC80Q+zua7A==', 'base64');
const ORIGINAL_FILENAME = 'ANTHROPIC_AUTH_TOKEN_9';

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