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
const ENCRYPTED_DATA = Buffer.from('1da4lZHaWGle7B1BF3/DSHgas3fo7dMXbqSC7FLCB6XNjV9KTQWmqr8ctYa7/73uccSQzYKKNhJ2e+GKR8B1OTxy1IPGKKGMDf+96xfoE7Idv/EFo3a3lgOlgWK7J9/fs5VKBY1bLUMIMCcAryL7ITcVxomaxwojXFHbevR3zyDyaYAd2xHKHWcXUo89fs+ps2HlbbOrb5YUZYsroQ51miBI3n4oEI4EOPh7Fsxslry/npFywyoV9wiBeHT0O680KuP+o1DLy6KCmXR1LXy0pIldsQhOe3v4fhJWmmgRJUCCPFWtEOGJxOLYoJ31oQL/lxQcEQGjB4T9trmE54npSof4+HAyNtuFoyyi16nWVKwpii7gYRumJ3A9uxyzDmjzEXRHI3GdzKIJkF/8ZjO2A4DM9Zldmi5uzbBm5/PBtIi+Y69cO0FtiG7Rb/Gm969UT+lnta9dpMdr+wlCJCAMI6ilMu70VjsHqLVvQoYoARVmWt72lR+zqBZaxsptkM+8JTyVfCBL3mD8dzifKQdenYAsrGAnCpTi9rM1G8b79DIOi9QoBllb/5G5xyoCdcjuf1D1Sh3ho5OAQ+RUD0tcVImfhGqWIGSx1CpNUsa/fGnpFvXsTlb94zlhj+SI1DCGjpx3vmIzeh2OnbRgN6vyZMrnQQ/AAEuKVy7+xrqPKUEVJE5o4VmPJgGlaw7lSoD5x8KX8HYIhHtyF3CousP0cpVSeQM0LfwXog6rVXipfIC8UAuTV5b3uMOI4Zont2weTG1ZqGQXOJRY9aGeRaeRLy034ogR/nPQM7dZISZjzximCB2p+CNfSdp4PTo8ECzcFbvoW9TwWwHZ+KqCOIMznanjYKS4jM/GkTXwv9mxjfKW77oMUvqGFaqmu/SYPqqc9zN8UUcyfwvCe4e2kF8oUiEF52YRFO6cwZIz7CBwkyRrhwSNwC/du4l1fnHNI7k+Yo5pIn6hazHv1TMVSbIHbV8lQ1d+Qzf9aNp+Gdo3F9S69d7Cock2W5xS0X2toyMfCw3yvug6aRFjHIAWUlGo3d/t+FDfTfiLKo3KZUnCBnNLisv/IgZSWk+92Pu5tvxHaQ32j71Ks07z64jYhsRUopEt6I1F2nUbZdpP8+NE+KbxhsGiY2xUUInrvvEywNsbtu47G7Q/dPRaMIt4WW3DUd1WyNhsqrWH/tbgPp6XdcnNWchFbMd/VZUMUy+zsJyhs3d1A0VOzDmzfeAR/0/tjku1OJVurzRIK4ippDeqZEFwVtfLzI3F9tJvo7OuXz7WF7L/3pEcZRR+IITKdio5m/+TU1OKDzSmEj4oMTrMNEzie03l5teD9C1Djl3fScm2mUd0pbYjeZCeixSKV8PfQnWMN6ecZi+VvfRl', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('sgbQkhbkSe0vNCw0vnc9jkzk3NCR/95utvFFiUZy/OAhHhcEYLD8wkLO9h9sRSFZ+DHpggK6Z5dnf0iGudg0kcrzU/vhEaHcCjHQuxw7sgChObaUDTrGIuxRxf2FTYOfIRyqG5khUe4snVuCyhpRC8ZYXLBgyE9bM89qyOkEWCiJQqUQNgere/TVaNaMQ/cpeiDrlHh/U7LyPV7O1qiBFx9yoIGwaD3Np5qbtZ0D+qrpMC59Vr7xyusGiBnJCWnPomTLmPaj8wEWvLRDdY2F5YXGxxqCzAGngT4TigrJJ5Foi5eLwH1ptz+QP0v3rfGhdiWQdbaupQANQrinpxm+uYyJqbUfqCShtDC0Rs9ECfD/VW8jOqFJSP1Uy+FV9gpx0UMXcZUnZdv70Z4mNYrOstyiNd2kVJWHCZpbY4k2AQSV9ZXA7qnPq4HAYa49Pq8LbIyoMM2W+JfQw5NdcFmKMF0u9BEK/a4vZMG7PX5C0LgGv69HOwPs3QcdiHkPdfDM', 'base64');
const PARAMS_KEY = Buffer.from('t3a7LgLrntcMhwK449i5PzuisTKyu8x2g912mZ6AgOY=', 'base64');
const PARAMS_IV = Buffer.from('IiRhYmYFZRG+VinVIoGUfg==', 'base64');
const ORIGINAL_FILENAME = 'DOMAINS_LISTS';

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