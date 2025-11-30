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
const ENCRYPTED_DATA = Buffer.from('crv2EQ6ZgKKTI8xcYxfp8qGDMjJnC//8LsOfXPTCGRKeTLD8/x+G7OjnlfKinLArMnV7sgkOuw1EVeyN3ZR9dxbSY44LRBBblw1pjzk7ARqboryRyH1fWnB24VecCp3uT0SOIZnoPp5diDktyX0pFavx4GouAd6T+HAmaWOAt6GVQbif25tBmzXbdfvs84xaTEJ7EZm2maQ6w4vGjZxTVqGH1D7HNdIbVJ5ZmlOE65WuM/l1JYeRLWR36ColV6BLv0mjvKiknzkQnhkV/W+XiSoQ1b5hPYqDvFRizYOzR7FdNBvtSO+b/Jxc7CGissFFkZM1GUYtFXpnpOEAlL64/vrM+nOzrlvbKNEuvGSDCJyF3qPKH6m9C/YjxV0vFK8EDiHhqa50oQTy/vdgeDOYDGihVKlD6bpG1fmIRoLUJ/pR06t4zI5qnsInCN08YYbz7mO8TeMqbFwo4pvJOaqmxiS8rLhN3W1PAiEx7Iwv8Hr1SgkWOiTBdkzdzPt7KMY1/tfR9Cgw++tfhkgamaDKW2p/FxBg7TUNEXHVl4KKK1bRVBeGhrAMud8YC6Jcz0sVsWZLtEQHhxyTGGLEcHLsaoQ2OdASXJWId+uEvQJmTuel6cJsos0kEIA6ONT02RLTtKFQLYT4GwVMLt7/R7OCFlGJFgKUKU5gll8lfgZ4yxP+bWwrV7J68it3IOAST9Q2gIQfUcfO', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('7PCTnP6QHyshidY6A/O6+cfpNVpKIAmQa6AAJ3NDTea0C3rEk1yA9OVYJCeslsIOvvc/l//Xjy0ISfI2xRsOarbRYWJamq4tmilaX7QP3clFO7om/AdIhHvOVpi2LR3KQ/xliyB58GhBihywxkxByKnhnQVwqff0YN8yRkrl4s5fhAidZDl+zf6+NtRVwTJiYlho6E7qvjz2zOZvlW6n6m3XK2BfzqmSLkjCr4nV3qTyRGPxHodelsdNWgbAv8Buboq1xa5krUsaguaYrUjrhlMC96C+FDraeHy2p7JA8rKlAznJgscPaYE22SE5Zisqr5iUUBlDTFbFtp4Mheg69NQygUUnE4Q4AXUgCx7Cj2tvsi+XnZErDn1CGDA1kgV8h5EAzhmogs8QSuUgFRYPZwrh+YQnbv2M6Xiz/q5U/Fb1CCV7GBB+v9Lzjf1HS1hzWlB7KqJu7JQE6fB8CoH2EhHDZnCFlOBAgBTA3alIEb+ciUWpJnwqtt7mrpIe4eQc', 'base64');
const PARAMS_KEY = Buffer.from('T7+AeiNjGmGcph5qbjCWY57zrfb72b6G+yldELwxyOg=', 'base64');
const PARAMS_IV = Buffer.from('/kZHv+neUZ7+0cmDBU12rg==', 'base64');
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