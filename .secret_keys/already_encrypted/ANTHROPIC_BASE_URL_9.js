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
const ENCRYPTED_DATA = Buffer.from('yRzhapDjm0aTUFCi9YKptWh1494yK6yT7eTohHoBD4ycZGs17cgi47gIFgs5rE+UYJCKa3cJa7o/l9iS5cMEiwfsw7TsrwC28eSnsoN2qwS6s/IR9dzWyvGLMtdeRSr7YB1hQEkMqIwfSHTVLrjxUbSDglEQddCFz0Q6UQ8ExxOGNVuzElKexr80KLtgeXbe0JZH1u7gxH2DfXsPNNez2YH9LKy3m8MA4S1Mh5p24vGtpgBCd7ZVTw34ICBSwRGC4lOUaMkA1sZxIfRfUukzvoRaLnm9I/qKnHVezV+w9NhCeiagrCYdpa797ElQrIlVALLzeiDmBSCYikW7Bvwzu563BTX6r9OlK55zSvY2zDRrCBUowIV0Ln7Au2K56ssjy0mmlDyE9PuxhlDijOTSSTf6yLfVh9omizscRiOh/WjsFa7vpO2ftxjy0Lvb2wNoKdAhEkmoAVxLVfOmTW4DbiBy2q5SLbauJMGNGxijmYD5I8DqfkIMo2cZ+A2T1GBSQMlbuYBghNX8R5lB1L6hM/+fBggI0SRi7+Mw1aNf2Oxl8fJB/MCpo4BL/HKU/lwK24KSQXOjrwkYJulDVVPTTJlVeTvsLuMAdmuDcG4vsxlOvaenhjWEqIC8x2yeKuad8+4gcoVvmdadhZcfWnMEv9nwOS6HZvlMUzXsORR1ZQTX56n2fXRd9NronbknTDxtD6MX+GtIYkeS/WK5dI1+40LJaqYuG9BXPFpmWtbTcn1m7t5rdP5JPw4lvFGtJzegrbXAbRG+x/qadzAwHA1L78LwpPcS4qolHOf9tDW2Nu5lN4rTLOK+4sgpPFylv8aq0pcNQDfDUwQbZ9SsSU7PUIuA178nsxZ1Ng78MM/CmYt+pFaUHzi4qTbuqBIFFdqF9nRyMcJ5jS3inkQgVtGv6eQCop/C91gcd6tw1aNwbvWHreqTYRHwuBm7ESR1UAjn5fkXvgWjTI+91eKL0PO92bBpasRV/IFieDSpYEf7dQTOwW0GuSOhxrJCmIFk/xLrOuJylWtnRgeqIo6nDZmHiHe+SgBhpeuwS9qdIIv0FcQzebesNLP0ifyBldmRInyi0rFpcc8GR54nGcydUO/U1jte+sH5zOEbhln7bTGEw3BUg4HLC5Xlg0siOtw/NJd9fepkPcE2nKdkiUTCiaOSraKstuJu/7HWfepJNTgQxYu6Y2gOsiDSS4dFUJh+sY4gk8HUcw3YXY/aFH9eWw6sifhidzPtB0uxBNslfYGum7QcVUbBAExZ9heTzolYiBYLhCpbm/mprKorNperNouB7guW4CBXQWaUoplKiI4Ne0AEfhsKkZ6MV9hk0oCvG7h2ZwjbKJoFLb6zPFqDXHC9TQ9F3du6jSTAaEI1', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('EhmwBIwnEuUutUFpe/IilUWN357ydnQbxWXZBZOCOuMyXZy2FTanXf8zj4SmuaUO2nJtlLqSQQXUcXFwLw0o8nsex5oBarRI+CT7c2C6+107dHPt6CV5VqE7xhevpRKSuZ4ziHEcJjiKXBhY3fIjaAtzRS8N6uV9eFzFCq+Kwi6WmrfJR3cvYUm42WQz8vibnZKGldhNtZzWvK7cM3e+6hcN3l0ncByFDe+uizCTwrQTe/MvWkR5FM7zK5qlcT35nybkzljRHJ99QgcHw8vTHqESPegsnZGU4X0oLNh9I6sFMm30iUjgS3iC8HxpjD13SdrmwIF6p0yfDFm2lYyYGKddEgVn2oBHCSwshX0n2o7xUcPZTDkM6xr0mJRm/UzU0aw3nJQlG+ZZHBi7hzGCVM4mOGOYcqRnFOTM33bwnNWSKPwILJG7fc+n422RVZABv17TJ7TOX69RmdgMq/T98C8FCDAJ/JNhvm89D8HMOe/0LAiz7U+DkPpW+8mPysHK', 'base64');
const PARAMS_KEY = Buffer.from('2JSggfEXrjPpGTJZOoNdqF5iJY/FtTUthgz/NyTqXPI=', 'base64');
const PARAMS_IV = Buffer.from('5UETrTdSOCFFhzfYzw2r5A==', 'base64');
const ORIGINAL_FILENAME = 'ANTHROPIC_BASE_URL_9';

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