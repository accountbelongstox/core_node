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
const ENCRYPTED_DATA = Buffer.from('pmMvqsDxf1Ru+sSPA1RgKcI2AryFMJG6c2Fb4/5ngjlEUF/yQsibdenCCq1H9d/H7yS+AQRD1Wdk73h068iXLEOSMQaW1Ygc7/GdzoxAaqJBtpKkD2dY1Mv0N5WLI3HFQUrrycZIWLqEfhI0ZfS3+GIKzLbwqXf09R/5Il6DZ3IfWqLqn6d3orl32rnMYS9X81iVepstSg5+NWNy/qJ9EtpNmOYKQ5s4jAJk2clKWSz/ZnzLXoAkaTJWtsatb2Q6rl7KJD5z+DTyXg+CZOVv4k2+ihWO1lUHwo4xC9XLr80yV2DmvvMdtQmNa9zjBniyAIcbXLJhPclph90NxsQnXhMZQNoFnzXtU3gx5siFVwe7DzYHsVEhLBQCiSJsYUqYPxR8w/q450KBHnOU/mUXcJeJxQmz7PYgaijwNoeBX7wDtX9/6aEj+12/5IUXqijO9n7vu8QBowpQwKC/rqNKk1sxWOYoqW4v/VT5dd/MHF6MWTd3EkMXWBAWwzEOmsmg+v1G4ipuNuYOo5YGFEzN4ZRLlgs7R9afn1gTcIz9hGL1baWC8Q9ihoESBn16jaD5gsWykVQP5fXDZeR+o8DUGpfUSkdZ35AEeM0DQDLR5lZHZvGZQ10ONvUmfv5vHpdLFANbOMISmukqg/swdcPqK22IoGEJ1YQmUZ5XpI3UD6gP+qOCGDw4yY0Kl0x40bCQ7eREZdnuz47lTVVijJ19pvhDES1PmGQzBUq9zPQRIJJjU05h11IkPkRtERqhomnNN6TW5wZa88Y4WeqX5bj+6UMcQoxbBuBM42F1UKG17Lu/ZT/hlBIEHbbZ4IRDN4y/Q4XpI2dj8pJejwbWcYHklRmFX8OHkBCIR7kFZwn9jQdHaee+iDHwU6kKRJKwg6lIdpZf3/JgS8ovrXS8p8VQkGQPXVysyg93hGHHyJtO+QA2H7hrPCMdJa2YCrOrrpXS3GBlYom3pmlSJDrvPvxddLOkS6JWQfj1vgzGVcWZCAxJkMYvtvwaOLIUL5bGN+XanDwuJMSMEK64XnbG9cq8yeDligQteIZQtNP1Kb1EDvXtYYpgdG+awg3lFhTDYprNwmDHHGf3owi4plKT/5qIhGMGMQ56BeUddbj7KKbZDKsEMvy9bVq8miogstsMfTq8EIwtXksrxayp1de1uXfpiB1GULk4jsbp/FwHeq/uVCCYRN2HRbz/1BYE2m7D2+SG/BcKs3x4a+P6D3e9H4t61SoPaJcZ2VVomrKHU+DTgvm38XqHrTAvrDG+KTMpzRxOUPglR1vbvKcs//ihrdme/OF3ewMFU121DPi1+tChrs60Ksu7ph3A8GNPBnAQIpCuxf2YlLUDx/YPKdHUWZmY8T/v0oGmUuPhjlSH', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('hnqfyd0yQkS9++dFiN5lsZh5t6LgZ5mNfB0eoJ2ZebZ7rBJVnkwDSsAWUmSx3VhB/BfXaxa+x/Lp2zpSLoQ4XptsBTl/glcrirApP+nAwJzwLhT9NhsbTF6sI+CWhxtfT+MEL5s2Yw/vzG++RXaD0WM4qGb1VfOjyAq7hvqvcVZajArRWh+jA2DpNAOItVw6CopzVZzKWyyk+LsR0dupyu9jjzxYv3JLn7ORe2irge57P0pAl7s+3SXRrBGX5UKmVQJC5n9FNK2wWlAp+QQcv+wPe8yNZhxwNJlWQnLUEuNuJLH/e6XPYlikDqXTf9sexMRubxAHukNGhEuj/qKVqzbMJufzDJWXrr1twb8igg8pVuEN6/S2OtQAxk/xKlqivLI/e1+4GsnW2+QPdwi2ZqPxR6dIEizdH5R7s7TvZSFEB038pMJ+w6xf3sBHeg4//QUTZiinXv7q0sF7yvAewkeGQHw6VxZ6OgfuIkpia8ZVhY5YV2FLRxF/ztNEKE6V', 'base64');
const PARAMS_KEY = Buffer.from('Ybdkn5U+qaA4QzwhHJUVXhp8Q42XaUOIg2r3TdcuEHE=', 'base64');
const PARAMS_IV = Buffer.from('IGmkWg4IMe4CTiQjTy/dTw==', 'base64');
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