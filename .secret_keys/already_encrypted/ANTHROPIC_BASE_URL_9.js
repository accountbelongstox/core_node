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
const ENCRYPTED_DATA = Buffer.from('LTPUc+0C0Zjfv9ZCjZg5nAAHq1UJjBR3T9wYDQAsVJdfGIN8Y11pHodJUsY4ZlrZw2SVGgBniKCInsngDarub4XskQJ2Ig7rfALqpQPR51+41oTd/KScL497iH54aaYLwd4sJYTALPy29/fTz6vowCbnk7S/XHd4YUY8FOUsBCHJePNo+I3aYohbWmq4nSlsaEjaxwDLlOHtaWoXoizUFLE8aCNYNA5kNXaZrqsamRGSW6AcLqPzsFB1N26izfmAKScPtIC1dohHjzeRPaYN1ogOqKeO8p8S5mmfJ81335m9NiC32cic7J5TboqtjaD9a1o8yfq9JjkeHqsG3NvfwbdNdxgwYXajnA6gz5Rb18nMBIgvfV3SmmIvm1gzQj/zs89STY+K+wxcfdKZrD3lC0ZdrjAUg9oXxXKKsGYr7XnEMsR7q1cGYZbpGYAwrhN4mzsoZ0fklfsNFFwsiHIqD4sAoGExnDngP2fvxk4Fqc3cfTd0u6Y+yujR7IDx2wMxxO+K70ExIPvJq6Gi0WI0TNTh+Fgjzf32Hf02cQd+UpD02XtIuUFY7lIJYURdkSn9UzdN8Svz+TVceDHlF/72uYePleWO5njPXaETpCJCx0fHYJX84xA9Do4xzmDfOji67vWSNQ31XKqE1mRuUYkwIIQWF4ACXf2S3jEvlXEbGR+BQutZb77AJSzblNibw2hJ9447RdvT6+aQtDB4p8SLDY4lKU/SJ+0wio0+EcF8AptkzQqVUe1M+cj7KTFu2S48RXW9dpjRoCwyDQ80Ktsih17zdjUIHcqaqL1zEm0JKBZTVPIxl01DFE0U5xVz2FJRg974nrDT7+iisjGMSGQPH/nIvFvFGiTsUfCSmhuNkk0nCDE2/2AL/l1bgnIFoyfpN0Zlfl+C6GtjySM+Aybggkjk1/HsYtSAW0/wMsthEq2m8xGtKoelAVM3UgTLyQdtNeZk1Yxl6qkNr4Cv5ZHJOWFTWQNj7LKz9V0QfLVxYZFliXBSAI745xUd2yRKs/ZOsVg3uw9kCowmrk0MZAyZlBSRqkaM4P5dq3hN5ERtHPOccJVdVYt2E4nP2DBrjubUASeIMBxkqpG2ngKXiHBO1AvgYT5JDVUIWIex90nT4oCIXp1cuhSsfg9v+Tf40n1efChImbv+SbmmzZ25uXy0NaJxeF8odFpO4tCvgy7wj68iw9dpqFA0iol/VHQ7wYrdd60L1JRb0VOqXu37dQK0SAWGxVWVfaiM+CwIY8019KiTSM40t57EuylTBTYDeBaPbqMMCTFB/M0UJZljdxPfZCHL3UmSxsIQiQ92mLj4x/dzWV6p2+RZjbrykATEc0w4lYPcr5YoN+rsK4TtuGfxpB/o/DS79S5inaHD', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('nh3fAqUjxofeZAZCJ0iyxh2mV/thI/UV3RmYRxBQah0G9l4oX9kyyd/HXYK4SLpxMAM0XSPVVzlNYdTOJYBfkNpHlilxQvkAeaJtjceNNbwsIzLLTcrXZ+H6sqpJOP7wlc484qb3oZ8vsiHqSnfJE3l3ULXDtRHVoBVsYZDgs4n5dM8bsr7GCuQCHxivv/Pnu6AITyFU3HcJNbY1UChOT/8Xxf3iTtoxwe1b8dmDFZABY3vcl4pWMtGt+OP8we699+apmjeSjDxV9T1rJPSDeKcl367NEyN6TApLaOH8G2wxe+3KOByXKy/b4hMjNsMkVnJ+sX6A1Kd8tBKSN+DtgOBlJQGT+co8lJZxD9JkYizgz+MTgk8mMaGZZy0ARkH3EU61hhnXevFWzsKFYvLuOezh6dzCzSGNgHMZeSXCOAFulAW/72G2XpUk6nA1wbtpxjHfSQaC5Kcv5ZsU8qVYyzOza5gn6YPaa3BYR9/EtTcC5BAymoeWLFrIa9gGHBXC', 'base64');
const PARAMS_KEY = Buffer.from('A2Bbwjd9aImRFeUk/QfzJs0zWajyOiA3Eka+geJcr4A=', 'base64');
const PARAMS_IV = Buffer.from('JmekNqWFOrHU6ggqI8E84Q==', 'base64');
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