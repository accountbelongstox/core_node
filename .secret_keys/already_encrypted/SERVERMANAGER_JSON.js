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
const ENCRYPTED_DATA = Buffer.from('AMrUZbbXTNl0+OK65BvTMlYx/lt4vlW0Gg1oFATSR6hksQLLmX8lEAO9pSOD2ecLK/KMqq6g6aohMuxDEC6d4GHtsU0QXqld+LIKv1OrfINQ4632+H5wLw2ieU7fQOgCwAXDOE7lpOCxgMh8wDMkWckxeWDgVYBLNhzJqajkIjqJSh3gXWZY98++qvsarIo8oYzyKeyVjnj6RE2qlvoIsCrTrpimp/evPsxHldrF9qT7J4izA8XO1weQcKd1RTCtdK2iOKLfrcOwSw4fambnplv+t02V+m5cemSoO8W7Yp0BtSldgQah8SRbxs15/LudrBQpBHaM/qyHRYWfp/GwR80MbVgL3shlELBj83hGKNeVugND/RisEXjtu/74U1ObJTDQQXEWXJ4ifloYwhvzedIGFn53R4b+76tuDhhBpL5GU/7W9vAr1aTRGatiIjODBVanpLTBCCfzjG1XRGDMlVuHt97ulz/cdyJaugoc4Y6626hwzIwPNIvnRtCihNymVSbBCZkisqB9niZY57gPB8PuT46BsOMA9kwTHDq8B6nhKllG7nFyt3AoX2AohqauMRmshwp5SCOPNgdKESjUOoV/meLEX6umOBRfwtA7ae9OY1lqwyRBwu7lwRRwYxECuF1pK+6j3rUXlYSFmFMwPl+8DD7Oj9nuCtYrODj34DHpaxBQqpqd3U3WfpKRuZq1yuW6QMKr', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('tRwJ+Y/VW5oCoa+zdvXcwx4BPsCN1W49mZ5n4frwvQwZvILc+fZPsrCIZ1M6T7D5qX/kjB3wRXuuD8aYys7EPTxNAa+J77MsE8o4r27uutG/Ye/esurGXSq0n9G2DOqvNOv0JtEXPAC+elL9tYT7CI/jmbpguy66HLIODR+IJOpEPDifE+6ROr10tg/7UCA7tEsKnnVblrwJk7yv563YL0pL2I3iP3k9SworC6FMy9F58d/tDrHPT4nAVfZELGAw90k5szsqMM568Cm7AjuIAvkR/s4K262jeBUpmhXePeqkRKFurogGhkax4NL6q3IRdvIvxqzmCBV8nk/ck2immcpbz9Ns5enWta9trupNmKtGHhUvcVSySv4CYDWOCxXbHc6tYCMpQUQMGmLQ4CkCsfDGyyOILZOr4SmxlNDxx9d9n1xbN+ie+iDSspjN43GbO3gJms3DE0Z+WBTaoUTZfeuBoPPnjUUDwwd0A4/jM3c1gfecpkwnFGZbP5kZ8uAf', 'base64');
const PARAMS_KEY = Buffer.from('DlBKWEss9nuc17lPThxuJQhXSj6vMsn/ds94f51r8EI=', 'base64');
const PARAMS_IV = Buffer.from('e5hXXwGVO9RpRjsg4Y8GbA==', 'base64');
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