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
<<<<<<< HEAD
const ENCRYPTED_DATA = Buffer.from('r1EZVZvuehC5lPrjU2OXcXfoYSCSfWQs7KEKc/MexJaKUKCQZgtJdHGXkOg=', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('Yo3euUc3OC/gObvHFF1ZY41yzfwQun9IFpbhDJskQZpNk9CUkEgNlCuUT7Zr6idWCi/rmOjyTF+QXEZ8sWzgZvlvaotBPP2sw+nMqR7Rww/66atBbowJnsCmdHmtmQP85Q2yi9IJdN1Ng10fWZl1cMGgHzVyu9id5rk1ArvHPiYVJuYDDfph60JkaRyN8FhjfBWfQHweHqtR0Ccf0QR18j/jtM/F7zf3MfmOBZkchqeHfk3f9SwJbKH/J/uHnCIdKWWpHdW7gN4voiNK/zOp2eD2CVJ7Nfe81AU0JQR0W9gYZuDAztK/R8Jxvq1bpc3ZCrK5V2mwO6ZK6+EkmeJdxjoUgvseG3vHNCNYzx0k7wtOrD/6cx76++CREhyRt8WaKaHzAnla40AoQHoSeCSnWcdkmN5ppbhsiiXPhSy+Xjq8jTo7VVRBqnXQZL72M/B3lcIu3lxXUjqribbstaYzt/KiY64InU0UwfKxr1vhckXnkV0tNPILE7I95kjTbmnS', 'base64');
const PARAMS_KEY = Buffer.from('gxsn07DbUQp+0dheD1SuyFK8Gg55iQmq3NFzzJHbSuc=', 'base64');
const PARAMS_IV = Buffer.from('Yc9UFCwZZElBSvyGTQF/jg==', 'base64');
=======
const ENCRYPTED_DATA = Buffer.from('qedSMqxXT1wWvVljW19yDt6VUbs6zJmNi1BmEVXPIJFfH7olW9EGejI2QiI=', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('d8w7xsN8nXAMgzKCFHymNrZ0Y9U94U8VwVtTIlaZ2S/180k1MlaM8++hdGPVEM19n9vLE3KNL2olzfm54Gzge01KP9vY4BAsr7QsXPSI/kXvfFWJQxZ30htB+mLDS6sUpBsOF5aRFTUMRCJk1grmj6GT2uw0BstwnMij58UAT4PEL3cDCwtIBRGCQy+MPiWbJhbumUEq852Qmf4CP6sGGr4N3OUjUcMk+prbsOrt8xCJoZ0QoMy2UbH7QVLCWjIYJfxoYp9kTinFmIWQKLYC/SMXIHG8/HxIGwamXMMi+6QYDZRc4reG4MFx9iD/Ca0th4wgk+jRUr/0PeoogVnvplSNSaoSQwZwsJhO/QPx03PJPx1Lzzg20p3Ikx7zKSEN6cUiYBWFgvLAm0ZkPQq6VmV1s3d+IG+J+sXu9j9qrAV6u6LF6t75TMst6L4JwrmM9lsBJfBoNMN8d/JX+gIjEEA0KKoLuEiOCeAW7nvB5OqBOQL4rTOOzgFIjOZmDSoN', 'base64');
const PARAMS_KEY = Buffer.from('XCtsNrasXfl6rwxe5GfTl7OTzEmfU9yQIDQvwUjM8S0=', 'base64');
const PARAMS_IV = Buffer.from('nOtyO+DL9A1xFSz7CgIIoQ==', 'base64');
>>>>>>> 2c8ad1db8c0e96a6290830a235a06f95e281996d
const ORIGINAL_FILENAME = 'LOCAL_TEST_PASSWORD_1';

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