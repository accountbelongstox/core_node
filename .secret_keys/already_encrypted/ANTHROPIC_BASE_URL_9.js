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
const ENCRYPTED_DATA = Buffer.from('sn6GJHiiAg0RoTFPwuIZnBiLmRPZd70gu8XmTdhXyOamTEw4wtxLQHH7EwQxFqe7A48kGHH/ozq4ksfm3ShM+JEBFitqNarT4U4mkWMcVd2WRMxcmHdYVBd41ApQg2B0mr1Ah60Gs0+8/2Wp7uX8asebQIAimIKPDMvWlE/DN3XG93xSymKWudx2ANTfTxgywFbhzoBoQn3Ya1903Otuwr6GnJdDzd0TZDBoi3/WLMkOUipxukZbIYJNMHFmPw74xZ9iRh7oUQgK8aPJgHVjZEhyP+sY3QLfFLYKxplt2dfFRVaGPYPs7TU82sXBkhil6tflen4enpyqRsYA+wxqQXX6WO/h5AOijVxfCWRgnYGmgnoW3jXRNYayKNU8DBHqh8HG+ivjGJq6y/AFGvC5wjR0CCb+GQtuy9LFKItS/zhGTaSN3rtW9xlgj/S7/RfvWF68c4+K1ViQsRi7Jq65974HMF+NsTvi6QztlHngWnKJqI5cxXOcrptYDRNNLjtMlXZ40rCOuinWOiVNqkb0aTV9TISvYr2GoiTHOqf27WMfpMjWeb6EIat0RZcq4I9zHxM1Bp1oJAB0navlvsTJuiYMvjyKDWojAfsTuqk5OFeDsqeYuoDhs7SXH9NGBBR7vj47zOPAi9gAAsEGV+MzRuwNVl8AwuUiBeWunLj38BX/lFTjmXBMbuL5o4I7hv/737bwwByS74n6a8nn3Kwoy1x+W1fETa29zmXCz44dxqbN94ZMZatujfaOtBouXfF4U8hpiR83B5a5iVZgktPp0Lonv8SU2tJ2s46liZIwz5WIeORxnYddD6M+4WD1zRtv7UglGecB5c07/xKh55g+UUG6ozbKBeBSFj5J/efChMZ6ItfRw/rk7wFd8RKuPw3UQhDrb9QyBKR4S9VLu6/jW2S9nvkug8KQDfWb3H0iBFuyR/l0g4TqBstC/EOcWSR/7a5Uc9+rfyNWyMEwxBI9nrGXcqq83AmXC23/anrXbXk/xpP6MBMt0n3zBuo+AMrL8AYBe76C9DFCUItpk9wSoqE3NmT030NCz3DjQEPn9kAtin/wuHCzUTSAVFJrXndy4KpD8dFv1V+k+LyoZxpqLYYZu+Vx7EC+H/3LySECKzaRg1eVdzuhdQ5hpdgFIukrR4/KoAC+9gghzfo2FZc+wp+BESISp8aG//h3+I3obl9izZBhwDorzyj/qF7PwMVqd/f/DXHjW3ic15FizaqBZVdFQez1KOsxXZUOwFXsARNHb4xq+jLMGERZmKJPamRkDzCiWSc7mdHSDNeOsd/2ymlkWC0b+IqefXytF/DLCOUCoc06VsHcc4850kF1Lr1D1j2aD1pjHoireg/K5SEsvpq1gomvLYSa1RC1', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('qmqAx//DP177e0+8FR5zQ/uwL2jDWsFpw9l5x/ziDqP6xJNJI5ZFe7LksHUw50l/Pbs3gMj059zWOGBUFJMgM72yUUQBTJGFJrq8UZokdG7YZx+ecBa3FN1/MR7gsH8Of1bGb+CmcCLvyOHrOJNFI+CpYd7Uyb/ikdqyG4FHXnjqxcdKfpThK9k4sMBUqj78Ksz0JDJrcNq8uVWuNvyzNYQjr9hSXe/kBnjw6AgScybc/IIDz4SW49QzMJQfn2ZH00HOmZ2KEUAbADEbWyBAzimWKu9F/gIUEM7R6nyoPA03KjHIuDE3kJ5molslJsiHflV2UKGsyOp9TIbcXAt8/J4dkHcm7iqs9K9GkrGgBVcL0xv4LRlQF7o8jbXtDMrb2KAPZRtDLYkAmkfmUdHHwYQoa+d8QF0Q8MJHaFr8sPIGKgtPKFuyDHComSr5iofzESHlQLzHuCBW4VQvJjzx16VuUC+dvG5GuYUKqsUhnfQ289moHTOdqc9gkt+D3I/b', 'base64');
const PARAMS_KEY = Buffer.from('y7PouHqa82ttgVC+0n+UTbAgd6t8LhNVfuRzz+zkNRc=', 'base64');
const PARAMS_IV = Buffer.from('jwWRo1YAHad4QcqMvFUtzQ==', 'base64');
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