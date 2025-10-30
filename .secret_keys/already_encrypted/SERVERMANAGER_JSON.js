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
const ENCRYPTED_DATA = Buffer.from('d8Kh0eMgLzDXCAoIwxYKKtpp5pcKCHSzNF5x+m1b6YwVf+3/CGwpbMOgE1wN6AJGeyXeUaXtCwP5u5/NDgnYdMVzzQil45Gcljeff1evQXcK10ESiRwth65wXKqn9UF2Tvg7P3SNwbws7ivtIPbI17o6I7hD3M+bhWMXpyDWLTSUQkDRgUPadnMNDi6yEzEAZo+rsA2DHoNUhBrqGNrPazdaUvqScskIav2VZUV176frCX/qhXCy74VHnj8Wlj1BUzde2QH1JKG349MhBSEZBJFrpjW+LzJHv9FvNpsrNqeqF0mbKy6H55LMfnF5UNFv0uXg/KUxJIU0Wj0HRm1JzSn9ud3CLVMgU0lJo2YCfUyl8m+osEJ/shvkhN896hYSi5MYhUKCahGrE4z7gl9l4M7nuJKIDJ3wbyinu46ykzBRsFJI01jA/73JaQt7on11eduQhK3JkNZ15m7/+/eZO+wt+i3FKCVDXQVLvijYg4WLi4Y8JPwTsTyXef8gEWGVlgpczK14KfP+KJbZ+bWqyJJJFyrN+ZqRXbYSzwkAvLGhMxFnmTOjDuPBGgznC23d7Fp+RpQfDoyIhqXLdrXg9WhhY1q8cNZl0ANCSJhDxZn57H9gdLr/zLNJSvWJnyVshIRv+4TrZ1hGhanzyKEWZITw0VmCgdI4m3hCNUVV8dG7UYuJG1xOyekCLnBW0R1P19UXt1o7', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('Bz0ldOfV71SS0soZFzay7kiA7dFEBCUmRSaFKuI1ZyQOmRvn3dHoOtsUd0LzKObF0daYANNEGY2R9vEHjk558fwX8Gv/0rrQZlKA1EZlbfn1dQzAm5ur7u/j598Se/dKiAeqeLh59HapiwLYdwVo9YWu1sQiasi93VZYDASCZB1R5+qA9JCG/QUqlhVBkXga/1zBud/MGL9KnS5+/4wKrnrNymvnVsKigZz22KKNj6IIYEzsOGCKhdjm2cAvkgdcqxkLv1Qn6Spy+aJ2YTFlG/245Wi0vdjSiyoX7wsLYgte3zE8ng5VNCGTRrA3NcdGMq1KX8khkmSeXPERQUikDJRp4kWqp9pm+Zukdismi4ptB7jBwb+nCoTsG3s5aUeSNn0mMfuq86c1ZTXLcoRowPLNtP+lkiE3SN/UWToA6ebHJQHeTht/u2UxWf/z3LMpwn01rFmmb9VWBVj6/w0Se1bpF62uO384MguoWbttKLoUzkrqVBWZmS927kS9/kdB', 'base64');
const PARAMS_KEY = Buffer.from('mivSNzfA4lr928YAqnsjQUQeX0wpfsLOa10D82UNauc=', 'base64');
const PARAMS_IV = Buffer.from('u82CSWSFbMi3IFvf4TsMdw==', 'base64');
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