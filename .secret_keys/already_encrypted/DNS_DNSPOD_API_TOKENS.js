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
const ENCRYPTED_DATA = Buffer.from('ERtKudSf/B0vLDflKIHxMa85O12VZxrTHZsq/vwk3GnvHu35JJIAEJF+GOlFzEE7y+bfrkLyqXfFl/KieRxGi8pKoRdyEOAYSVeH4a1FgC2r07pVBYKAQq2i5BeMVT4FNrl1g/gNkTYwqxc/6BkEt7DEJWC7B/1aTuxAHdtjf2Qt6s9YC9Wm7U7+Y83FAFHWVCixcZU7yHjDP7Aw+ZX/cHqhsIjYTmGlX/2dccWD+FWEaku3qk6e7fGUVfxDpUwgvujau/4bppIWPaNb+4nzJR6jDmwVJ4efr+7/3ihoZJPVRCDIuMfKp/TfbLAbbvSJSe1JCjGYiqgHs24HaKperhNJZSz7Tv+uAY8V6bBWMWjWSAwnE0MRYPGsa/kzJa7nplQ5yc6oG7EdU0l1c5QBnFkPltZguCArzbStxBz8nGHGVgWtUySQ+ggWIfze98u/okXnD/Mz6g6MMeMCxSEdk3n8cg+Iv5gp2m2xfi0uYlq548z3LCYIArmt96pxTBmBs/hGHkiorP4SPnUxa0hhgnrugHFwAcJtWSEQwUZ0BsQVMJS5n6LHHDF19VUKI8e0yMnbs0VeCOm1B9YWDJzA3+oXlUUetCg7KahLYkiXQHvroBzfwlfPqWVRJrmb6/8dfnuO8OfyEX6qSqydXA/b3XACXUdFtrLvS8cwFw9e/1qHcJUM2SxnfvxyYfHTSJyVO1k17WyqcGkTtt1xBHMdSY0bBUtE3kOi+b/mhFIVB0mdGVB3k+I3K2QZrjFn3+4WKftVc3aurlyjkNwtnQ4Qnau8pKmPcnc+w89znxS/YwvFcE28qzoiJ0KwoTEUP7xe4uKe8V5Nehm1+eHNkIQdsR7wVZEW5XPd6Zj/R2Abc83utdgycOmCtdaQRL7VASHRgzSJ6NGorCYWBTrU+enmpBmAIoH/1iguT/9VbsmMvlzyuGxavpY9DLBazc2IMFBzXDIBXQvL55We3fIrhKolO3pO/LKu3Vi1asiCzh8Ztdd0TbpkvkdztAN1i968RlIayCNGLu6XnrqP+R69AOE5TZi1JZr7ReIccbA/eHUxDJpE5AMGZm++T0wX+4kZ0d9Z92qIdkwxa8+fiTnsKbAJano6xLwD8h815OpUG8kkhZ9WZJ+10bP30j+SzSgLVQaRjr/ovdMriDG4AKYE4lskPuou/yUyn1mIbeSLyTk70ZQkC9CZhDCy0ldQSFYOMMQOurFwEBbn/On7Q8VKX5FEzESB+XzOKLeiec8q9wTrDk+hNCdmqSXfh+jMtnlQzwhxN3jI1dapUYuUzjKR3yaMTdcP+uZ2dvSyvnOoYTUq7UakBInOMRNIwA1lFHwjmo1sAaOqug3TZe0Q8hfq3xPHR2jHH2BHa8PlE9Ev', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('K4vIlRwEi515qpucGL2Wb3c/zJQzRHHCtM7uI3igzXHy7wYiF7yvYduGHmjmNdZCIf0MkzW6SUYr/SXdQc0MKBRT+MZLdYluCelZ3dHXV3nibN1ZzcgKbpRDI5Uo3Ly8Vau97UrKxoMTdaQNjsV5DYGD4uyxC9Jvtt7RMSW/hdPVzPt6CMAMHqPGtAg/B3N3g+RfqiJ20LoayuAjpdhKwmF5EK4Sk/LDBOBR0aSHM3DZ63wpUHICSzAvA6OznoxpC/Zimu12Y3rMspOp6rE7w/iU4uv47v2s5/YwAQr93QDvP5lAD4ukwdjGF+Q3vqU4iE6j8gGbC6jXOUPeVOmbIAddSYWfe6myQe83ItjgXuVYNcawcxMKDNncGu9jhgmJo6H76PJxDq6uSDTvKh8rxd99DkJaLqHMb61U8aWCobsdFb5XH6USfgM3Z/++xR3ZEBuN2a68jdZ9rbrH1fZvbKBXhGz39+f/GzFuXeaAQ6uIQ2e3F92/1pGrT5Pj1mF3', 'base64');
const PARAMS_KEY = Buffer.from('fy8S/niF1IRaje2HTofqu0z5WXl+6fq7DGaVubtSZPU=', 'base64');
const PARAMS_IV = Buffer.from('GxyRfezWBS7iOtnQUOmBvQ==', 'base64');
const ORIGINAL_FILENAME = 'DNS_DNSPOD_API_TOKENS';

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