// disguised.template.js
// This is a template for encrypted files - DO NOT MODIFY

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

// Embedded encrypted data and parameters
const ENCRYPTED_DATA = Buffer.from('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', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('vDb7ZftmUbNflvcwyMjqauyzl3g70RHhobB0Ydspi6M0cKqagx5tSuHOkLXYzH/2IBlXoKYjRDRJ4oSuQxTbr+Y2aUR73T5ZzlfEBsK3gxamGT671AlXBRW2QffQvDEFo3YrMwqvOGqedsBkKuCviWIX4C8Xw+0DEKtafxNjL+u/Z4L7qmP5v1ootFM4I0YoQehWTkqfOVnwUEl6+2v7GetTcCQhSHZR+hD/JN248urK9ZbDbU2MVZhN4CwtPbAxzj5mz5ZgJwWuxarNw7N1ztbwb+ihcTbuL6TfR0BLjVKSYyvCPQaQbbpaoPX2/6voa5xIz5t800zDtXHT86rOAXJquAAKTwStH7Q6LexmDCwAwXz5f9BJl23VAeZbAZJUXbiDXHfU6q/7lEYeejccRkYjft6IwjRlCm0uaElJZLQHPTZGRgiTpvPeuMUcmEdBRW5l+UO4AiIhmdz6zEuWnerKPt0mZi8vrXfGC3Z0UDfJ4yrrb/50MG5cAYKJPODV', 'base64');
const PARAMS_KEY = Buffer.from('h1DMrDZp/+8DiFYzPdAFb6P1dm/H1nTM9T5MaVY4ez0=', 'base64');
const PARAMS_IV = Buffer.from('0PklsWBrckbiYlX51RLr2A==', 'base64');
const ORIGINAL_FILENAME = 'CORE_NODE_ANDROID_KEYSTORE_B64';

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