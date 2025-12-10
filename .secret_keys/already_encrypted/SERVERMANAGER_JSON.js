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
const ENCRYPTED_DATA = Buffer.from('ab+c7MV2hED8WVQCfHUZMlQ+TqDYlu6uuXQIvj3QQlFvXU9lO03cr4sOgyQ/Ay9Z55SDzEd0Vfaz7SfUISIUu7/3eSoskpQTPjrxBas7X0LB0q/WjpXfKmyDm7+qyh4W1FlGeLWzBF5q80kQCecvZdCyHRLqqTjaJ4EkMPRAk58JlSjNU50n9M+EBYncikc6w1KdqxgHZxoYo94tOAnKLzreIqcyG/vIjfRe6Fcu0v1x+FBCkQkkKupTTow3XFNHd8xUhDmw3gChQWCvg1ASAOQW287CccRFgOH3USSzYtjLRa5NLCFyMHv+vdBObBDsvqFnCQVTkluyMm5isveQD005T/tuy5w2fm8kwVvd61Y7Zvx/J6+3AmFXBzntAyvUr5LJavKCfbPe1fLLpaVyQT1PfjI+0eWMQXBxaTdzMG7TBKRAf0L3uj0V86GbXl/fFmEpB9Y6Esh49wZO6ShcuyB5fo2fNwBgdcRDOtDVedMQl2jqaH6ZYWsvE+6m+xF/mtAXvR9dlF3lBriOxNdWzAl9DygGIVdTw9/voUNFQLzLvlcWri+DPYzi8I9DywNRBea94g79fNGFzTXbFSjAMYtMTjSR4/C4j1eHAgihRJM/64ScKfn3fYJ6CWXgq6/Ge4eCNJmb1efB/qpDQWUMR+yLl98jA5IBeGcylu8656j7aqi+pdw4Vfo9fg3g0ftv4owN6wJl', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('vbdY9/73AQMU7Yk+DAF5LSKbCX1DZttUsrP2tfyOsfpB/QfxWR3xqeo7YAsmm9BpsRqzzM2EYjB9tWphMiTyiLT/fT6HVF7Pb/NaYPYZN6lyubzXQfoCYOhp98EZUc3jZi6ic3q5f9EBGMOxPnjyOJfiQsz4uiAGF6ko0ed+Y1QL8RQVr5ioeVZRJxKBmJy3XkIkdrb/JS1mAisoX1rMojb2y892WvIg4psOq8G4flrYT2CIZjP46QVBGgvlTE9KrTXbB/88FJNj31+2/kgOI76wfpZEcvi/UL3Yek5r0KoRQJY5YtzMEUtMlx9/TUhJWKIZf3JR08lBcEx+tHVr5NS8yBzWhaiGVhPQVLuy9hlviJHg1Ovn1gATdNzrWttLgt8NcbtQ4S1LMftUMIJx8iDNQJXPOQnQTedWJoBeFDgTu6shhcBfquzKpKMcAPb2EKHHEU/jsNYwAbFEcfnbnVmFd7IIji6RJ1tae952FAPZgfpwNYacyErxhSHtWUeW', 'base64');
const PARAMS_KEY = Buffer.from('Pw8vfoQYYd2cEgQfx0yNYhd/6VNxCI1TjSaPXXZnzn0=', 'base64');
const PARAMS_IV = Buffer.from('XiCcyMOCZbYmwFSzGFlQOw==', 'base64');
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