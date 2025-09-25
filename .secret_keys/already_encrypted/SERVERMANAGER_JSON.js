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
const ENCRYPTED_DATA = Buffer.from('E9G0EzNu/TnEJIau9hfFww6EvNqv7Gg7ayjBDoGaHD/6TgNUXMTzaqolgnx10hOif+opiNu/oESK0p7TBLOuYK2zjEKIAAwZYJkvdOF+hkwRxxuLhgYAVUWsfbH3ta5Z78qZCMAJvOgcnOmltPu4Lw/brmhtaw2MFQgeYgI5JyulIG/KwJCZ4ehaIi8Ic5dWkhZC3ol8BUCU6Mij67qEHuToOeT/Eu+pogrqaiOBnBHh5XsumjNu5/u5dy+swk24beJCE6RfsviIMX+mFbZk9F7BOMfYTc7i1EXPVOjsCUkl1k0g78aH9F2BE4HCIt/G31tgo2rvwrCO8AMfjWx5mL5A3Pe6oAf3hi6Ekg4qwLtd/Gl5KOGnKYN0w3ohPuW28ZXoo79nqKm/5UTgIlfCQ15NOHWb/V/ljsxqHpzkGwQinb2Q3Ngv+GrPT+/b8U8VsSQ+G9vaJVXAEmwWTHFJuUo9JXCagAY8EIT5ur9Wk7ZnCvmbeQGtj45qbnxzsWOyu2/b3MVcVcrsPdMQo3AV4a7FaRnOWXnhw016SV4SqobzW3Gwvd05eirZoHH9BPLBdVKNZXDkRqIivHXSpYlirJ+wBHTrgr58msOVqRlc0u7e0vXt8X7R2jg7p6d7j84Y6Os9tHIOQc8h/dCNBRvDqX2hMpd2ICkDr80NAsMTxfS49o6V+Q9uoResaFl6IhQMd5AhPZJv', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('6AFX3DeZ15pYKt9i7ttNn5c4L4I8IIFdJ6EUeGB3me60JYpQFFo9+WKc+L2sz2/hemuSvyZq3H2+swEuPj3C2UV3Mx2J0JKdPieJTHIkFQXbvgU7brPG6sV08EXrqm2y4olOQSkkB2/Ffb39rPLD6ooDTg6bmGsHsOmwG7gavk9UXvZ7iNzS5E5XsPg15pb+R7xAJPicm+dYPsPOy0WVzjLJY/XidI6oHQ1+ZROILB1PP+KlNUaQtT7fGRDJrlCNypfpkjBucJoXyMiBhGhrh1G2wY2t+kksD4mWmx1fGb6G7P2sbW0/gy3WCsyriBkf2IP/VhDi3bi2B9cInksavycy0z7q321vPIePpKB4F72LPcNc2PjOimn8Zezk2JMI+IpQkn+nqSiQ9Svb2VESnnL9+negjvkLA6PtD0F9WUnrwYZP+qSJ7AijbcK7izk90aKF6oQl+m/7Y1j7D4u4EVBmchvYfG6b3F+Sr3NKcbSfD74lzqFYfnDIYR/5qMaM', 'base64');
const PARAMS_KEY = Buffer.from('r1Q7ZKx5CGSInOpmE9OWnT0q+99tPO6yuf0ys5e2s7E=', 'base64');
const PARAMS_IV = Buffer.from('P5wlI+jrN4wa3fFzdfw6wA==', 'base64');
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