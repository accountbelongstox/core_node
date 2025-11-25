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
const ENCRYPTED_DATA = Buffer.from('HkSPZEqmx3R/HEx6qf9Zr9GhH+dLZa0LinDI7j1pZZ5Nd2N1lmOIC7ODv/BhILggRsFANxEIH3ojHms3ji5oUsZsNssBPPKKWFzhLxDpEiMTr3kZaqKXg+fBvHUb+RXMCZu0DvGyDYwJshBlPnihFhJfSRt0ecbsOf0/iA7ZlCPkqqPAwTRqAPvwoTx1ol5SmG5uFy/lzxkLuDD5lm7L+PLKBT+CsCJMdzOtBH8AR9VrLo+U9HRwNEkZBcfoB0J7i2d7yD2rG0oEbGZotEkioI8gA+V2Nzu/heOLbsX3ksv0xIxy0JpCHfmt6nmvuFW3hZxCcn9F8LTxXffLfGzvndZuDxdWgHVCmKo4MDDtjkWPtJHFIz6J/S+3cY58ZfFWG4NuMBqurO9S7yYaUIcEeR7cTgM3XPYOCIhxB8itQD2XfOSCA1bLatqJrabaPGuuJHKcxDs3fK0eEH8GQSVmNUCwc8/FPtPoZU80AMDS+8sPpu1+UoaLNFhEu34JmhkGU4m+uULOb2Rf3Ld2KG3krLuwruS1Ul+f0JyfkIZ4AWjBvXofFGRiSFy4wAvvfq6s3DRV2H4RvAERFMqUTz0wpoBHOHSp5h1PXC/nWw5Xr73V2y6AFdUoErjwOVggAf7EeQRIbmrgb9LGbtOFYWRTyqo0/KeFm9HDpgCRYcw9dUj5AQJ62aGH6OX8og2gGLUvY2bd80UF3EXSxxzABlmQ2pKbcEH2m3RsklT/KlntVsnBjxh9vVG3B/ouzn/IzVYL0lnmBB0vMDI1ICAMgoaOG17We5LqbNPS0WewsEZ8BHiiIElZEFWK6li4RxEC9gpwWmxVB0ERF8mZEWknXYBXy1xR7hDD6B8KQEBbuCLxdfPiJKUafGGSKxO4f5qyK0nTJOT2oK0pGdhCih3wEuXEEKbyuSUF2+QA4eERQGJ94MP6pnlX/2mn/rY5YoZTy8WSFS2Z8PgPuK4xnOz0pZR5sw2Yl4gnYHCvjPkTDhsjDfznswO7hQ7jvbAOnnxBXk/mqUTkBO6Lzq0mFfS1a7bkPb3YTXKrd/WWUHb5ApW9NSBUV1S9HB/WLCHZx85XBqKYUKbyPn1GNKgiMM02topwtOhB1sB8sNrYAxCxj90SrDLxhE7qXrgwm8PCt0xbTbwKaSc59QgzB3i2KHLTKv83HYo2VSk9QSdeXMaEG7rIubuHNJXHDS92XoSJeQ0hxec3zgSlZpDWluhG2gCFqhfgKIA2lC15BecXm6XDoRsF0dvHRkc16neoUBRXEFvoKZcj/S+ppK/dLGPFiTpoPLoSYzTPB7RXBNoR1+Rc20I5anSv86YxPjLoLR3YuAtqieY3NO29H8F2dbraca8ictGJdQbwe48wNdDzz62B', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('6WYsLb4sDi6VG8z288qj4BG/6fifCdZV0ZQeTwfk9NLHOJIS1aped7Px4zZ6Hr/ApJk/3bzoYwU40d4RfS8eE7BpsQ98f6lKPQ3lWaj+W16yHT1IrL3C0X6PvfX539Zd6yXhK+zxCWpVic+dXIVeXcksmn49J5to6NSBTKkkRS9SumJiOd7arthxrVFiBCq94NP8sEzoJUF3CHOgH3NYVf3cKm20st3bk3ZT12zB6t3NENbTFbQd8VIQbl2wPTpzMXzMnWp/me5tdTLqtOO291h2GMpN+ih9LoEtGoE6MOOiEVSvCPJHjpxsZXCh8SI9ZiEGP1I+ffHuvNP741ah3CJl57AMwrtuqJVmQoTevJdYpU2HYnBEUxqoQh1zFC4nXReg6ZyK8LZmAosd/koXyvrW4ijlXrS/752mEWoxJn7Fkfec+WGD4yvnF84MfbhCufkssQl4Sor+1FVfyYrzO6XYiA5yLWbtLOnkpTaFXvMPIeUiu4TH3tq/JnKHpGwL', 'base64');
const PARAMS_KEY = Buffer.from('uUd6Btoc09FllO+P/yLtyIBkO664rluEHfYwdL4/gE4=', 'base64');
const PARAMS_IV = Buffer.from('+LhwXuvsaF1xiT5767fpQA==', 'base64');
const ORIGINAL_FILENAME = 'ANTHROPIC_API_KEY_6';

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