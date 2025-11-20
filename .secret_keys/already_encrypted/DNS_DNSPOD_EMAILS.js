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
const ENCRYPTED_DATA = Buffer.from('hjlTgUFNsHBNcdpR9grC7RHZ5BOITVuuldMO4v8KVJoeMb64AxzMYM3WJTCIYRroW+LJCMaepqj/PNiWGOdE7Gj3+PcD135g7BgCf6AC3kN+1muHkguMl/TmI3yhKyFLntzoC6YadbY2AKwIfqGHtp+4ZhhzW0wWkwyvHGAmC7/sudln71+f1+TiifXudhMD2R56LPHNPiURFEdCE35oc9gnVkH10cpq+OvaxOZ28SA8MerPmenJXQfUt7HFS2nXOi3BkL3M0tX3uaoE98x1XJ3mUqSC9W6UWRnVTIfhIA6/nJ2kzqMPZAjqESFiGnPl9zw9qIaamCiEkteS5slQFPxA66FtWUve+B00U5+dw+EWrgCjbin3aDiVkRRBIgwDD8a72xjB+0PZ7NhP7nqs6yltEY81eHnjEuJZEwTWQn0N2l8/yY5paatEyTFqMoOB7cBIouRqTu+WFdcYajWwsOSXfU9e9i7Ztgm1yzuxRn8cBv286kt7YxF0sCujb/XtT6RMtQSLr/mlpuX1kDdaOWsTJjkBXHb5SJtsxLybRIifSmWN+GVpcZmGG6ucQxVZUNBhHyyzuI99RQ1BK09kWOsiRJ0+emWoL72ItB+/NehKbsybCs+/LawDj4p+GvOj4A4xoyt6xid/BcTmcrNg7wU5RadfVnmm7PxFe42XrwdHronYX/8JcTUzU8479DH809A97HnTFaeHwZjfD3Sfex7tlo2ImAwZW8t/aGFYSugTpsBirwXfNi4wGSNjXolDTbtJQ1LbVg4Jm0gCb8C6FXb28SlJAgRC3lL1nBJfa4s/fUvkOBhae7LV9/lMCddi6TRGAmIKJQSb9YGLmyanE+eL5NyhD1l3cLuXfNwL6zMX3p8/llgOQhBdQNZtFbRc38RPcXqvPoRm9TWHgvTkwM8LBtVgrpYBO8rpAIoSYRNmcepXxSL2SHjtILXIHI+ICwLJYtqEXUSV3d1ksdxNz7VwgNlSdRaarwpPtPBxn/ueF1ej+9bXX3hIWDtdU7A0L0zL0I4oBQhz+A2q+CMfir2N00WNMIzx6sTIUC4bTa6ljskPLLVaAZSLDBjJ9OfEewy5XXLIb9kDQzphBdvY5ojXWzeXhs21l17wVmgt1UIICIB2Vtmw7SeIKo4a0l/yfXoA9a+UW/8Q/Rch+kmwb7p75BrSJBo2pA1/CQkK29PWySIJQPUhAuwAAUgOvZiYhMTA1AoZvJE0sUU5o2iMZjjKmIArrJHiiAX8PYcJbzQ8k3XXNS559t8tJ3vF+Ex1WUBvd4MNbOUYJg8aXp+7KTo8FC+cQh14UpB5qnyi1+34DwYeOWvsuZFZts4AY/sBIZp9WXXQtQ/7skJ6CohMWL+/zB9U7wawejFI', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('wZQRZtpV23Z/rSgcW2jVZ/B55aCffBOG9y4ZYSVRyxNfVfyzwIzNdAuPJ+KTSx/AC73+COhay6Cypa9G1XXxAxAhHSDMRPzc91yOwjadeMMgCV9aAf8zq/QVJSy5FM/qxe9+VU7x2EtPOAhg2BwPGJRQ+LxojtPaUbGvdk+/Nh/BnEj+u4jNdl7IXtqFJy439idBPy1bIU0zWDoheNW/smQTOiHzdyiXmSem7lU1lFESEblPnJ0wJHw34FJE2cSDiMdjyg8sLSS4cQRSmN9IczBv2fRqc4J1mD48hlxo5DYQk/djm6GkXHc8vmcFLinzp2D9EwY3lFzE7RYM9XzSk1tlt/j3vffrtTkHAXmTl3ujbSjZ4D6BoOTCyc+GZIM0XKpUgBQH6UuPSd8y2vvRHjiAZ+UNXRhcIVYUyh1ni9ncdHqJt0bGFtaCFHY7MuuHk/4LWjMzW1XMIFUAtvNd1gWQS7mirdCWIscLrDL+aEjOiwpK6gN1owBfODsF3uSJ', 'base64');
const PARAMS_KEY = Buffer.from('xu3sqDNKIySTpCc7dggXDLiyzkoRZjc0Vwj2JWGCZGQ=', 'base64');
const PARAMS_IV = Buffer.from('SoXRCaa1mivzBbgCZf4S+w==', 'base64');
const ORIGINAL_FILENAME = 'DNS_DNSPOD_EMAILS';

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