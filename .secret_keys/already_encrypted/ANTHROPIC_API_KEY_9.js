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
const ENCRYPTED_DATA = Buffer.from('2leIPHvi1ouzNWJhhYSZ8gw6AZUMajr2vvj51QkyGMe0ovKs+WBf5u99i0EPh9ujG9pyHHp6qcBOLtzhg97i+lToMm/JlcWLhaFbWUoxpBw9bbg+YNOBNZwWtKfgd+zLMznsKnCgfwsGppLMqZt2k3H/bZirfOhKuuw/EnPSvQ85IPLESkimNFKMP10lPrP0yOTg5J5IVEX9LV1f/hsyBLJmyhKg/+V89sm/h6sdlz2CkCJ/ojK7wB/+HksAxqUOZ2aO84KjGC7HDUv92Lajb2j6JmO2Kpz4MUQHvh0U+5Eifed5Qom9/1dVDva6t+AxnGiLb+e3hdC+S4LzhBEem5E1PwBnQYHVmefX4JWITp3e4JG9sUYqHgegGnIxLCZtf2Etcb9Qfgq+qVRJG1c2boEuag+vVRbEB4eq9JXqqcTmWWGsrljBbr8+5gdHctOgkaY75d8X7PtkAd2Q2p9pz8seM2F3qjF7iIyP8Zh+GnBxuOok5o7yIFE5ZBDglIdAT3xsU0QxG2tufbQAsa8MreWfG3vxdX2YjrwJAlCMGexjW4K2sg8/fTbFla2wOnuky6+n5hgl950uixnO8xk4fwctcBdPY28JSnTQUaNkqKZt7FwXCzi0ii+usFOaHjzpG80N4jWRcd3qUmxHvO3tBi2xz7fPbS76TWub040rmHuzWcHRudvnwCFxjH/+T5GOrxdT05cppVNAOwVY9J2rmJyYHWvqiqLFIZQtIoF2KyaLqtYy/49pczynohXYYAUgbbhz4insgL5MoRJ5c+ATQgjAyHv/v/93AcyGTuNrJxHMyvy+VB3OMKApBCVFKUszKJr8GEJwp8vvbhTqxJ4wg/dgpEdBmUMEqfsuARur2q3Z91ZbMAEWFqhDow+PNIkzNYdQMyKk5whzaLFhHKrIsbZWmNkFECpFikZnNK6SJQTgjj9a0LxECvj2MPv28caQZCDhiK7BUPBPBQb0gS9UN3THbiGiUXVEEjOLcyOvkJ9WCO4VbPV8D4LQLMg3qVd7jJxmqTO+DCAyndKtSqvyWZ0e9D5sLFaKT1K+/fzdeloA9NmsbjLGNL40abvEvQeGeQlGD0UPPxycEs/2IwD0tG55oFejoYEAWhM5mejR0tme15rXiyzY+bEgyGr7wnwzi+yAyRyGDwdmXB+A9XFCLEN5ew3jVxFk62UWrK5m+U94a39rX1gNytOPRhDjz6jeCLu0UL1Z24TFwHe0jinIVJBMfkxGC6M3uRaJVCTG1ghbOsI8ZcqRit/IiB1yBWMJ/7lPDjxHQduynTvAvvZBMvaOlwzR5rr2bSzcxCP4Y3QVEecPGBs7EnkpBHJaLw148WaiZG7dCrhtZdpVDgQSeVC8jI4HwBasp3e0', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('GaBL4igosDrteqYP+LY6mtFtJuNIidb3N9TqRwTCEddvBdiobujJeqYuuSFXRE8/Mken+3BP1nTTpHGXRMYvRKj+Dv80Xiu2lQ/hAnrWlZUDBF1ebORMvw0ySLbUbAz/mlyt1a/EYfKo6lH0Q1yKiqCKC6zLrcnIQg/XYJL18RqXqqinQZf171esE9T+UwVig0jI5qAUQqrAMRPMnBRUEaTWQOyDnkHr/xNpYqGgKnTld4lE00csuFdAdV3mLU27dGy8kdvdwFcI9khdwbh1aW2Rt0MyKxqV9TejEZzsBBtn0ivS57+YPnbmiHmhXCyaXvNZ++P6VOOVYPbssQ/PS5e4L5SE/cK6TZ5EUe+SQxquxsuci+JOf5ZyQMjnd4AAw+ecrzM6zfyjnCR/+KAakj/s+LC5gg+K0Hnc2RDNAb6tfUQpyCvjN2vHRkwddd5F/kWi2z2EifojmNzh/vou0ZKtNcaeC032LCLWI/XBs1f2BE4Gn6UK8wo/tX1ezeAX', 'base64');
const PARAMS_KEY = Buffer.from('o75tq6GWqUW/3Eht1szGlrpwOGHg42RvE3q5U8gpT1c=', 'base64');
const PARAMS_IV = Buffer.from('McNHAYsuYzFINp6xPfLCBw==', 'base64');
const ORIGINAL_FILENAME = 'ANTHROPIC_API_KEY_9';

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