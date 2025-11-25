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
const ENCRYPTED_DATA = Buffer.from('igoCnBzwAmxygHB70gL/TvoyyAgc5x+ECu1RpnykPhY/EplGXh0bxhZ7DJKFodFpbIZ9JVwImdwbAwizw/82+eW6y8fpngLZX1u1umpO2/WQKyUAydqqfxLSNQYaEfr61rInzsTSlvwtnJH1AdGY9CBzViNR+PRYIQa5vtTj34mc9zENE2vNcuKitVkuWGSBAu18tGYaFsInmOy/2OFrMP5DIp5mSiv3rNsps16GoQ8Ax0KvRWDrF2ilWjJ04GBmg3QbaI2i/SQZGy3xGk9VY6Cbw8JN+gvtbpwTUR+N7CBD/JoxzTsAxkx7qYsdGuHj1SIq6ShbDB4SXJd3XErr8Il8ixLX05I2oJD0D1DxHdpqi+FjrquLPzjOJpcy2eUmeCf1gdBwuPqc1vgLKVJyfz+P1k2RGrsFl3W2fpfLDFFBouaWTviz5CqTGvwbeaDT2twNXQybarcIx/gDf1/wwNQB4+73i2kS92fGMaPLLeLe2ixVjqReKvBs+ZInefrJ0k563vNL8SWkDfN7Y4hsKRGOJezJCxWi4PZKrJ9PUYLWOAsm9KPWzLG4/w/QlL3Uw4u61xV+R1xBtCqE4DtKqgw0EvsRfqiK+hefh/ILIs7ouMrf9UAUb7tEOSaH592QedxDqSwoHRccE0ffAvLsOzcR28T6ijUG9M0qalHpj/2ESHpxDaHyfKgZ/VJB8IhMovakRrU/UeI9S9uyp7cCL6g8O26MY0rwNeHLeJDztmMk05T+brElTDbDKJS0c2aXOzLM0UL1YyfGfSaxuDBB1a4NV1N85VSYCfxyopVeSyYkJgFsBrKggZ/aIVTwSGqmsT5TpxB3XcnMgUXVltdmeyU0+L8661swdr3PCTBJNLoGr5hjnXW5FnX5yJF1yUF0mFlwnr4GnYxeSFNNFHiGykUHmmVC7ztfGU37CCziW9I43yR0MciHcVLyQqkZTrTyjKjOvMjLTIJiMSP31DUhfdsvHHqspd1217M2a350+xWjYmUJtSDh6f+Y2uc8+k78sjZ1u5cQ9L4wdn0+aXs5gVWIQ603pdL27rOEw78wvd5BlO8zDfzrHPKHaksf8Dn08kAwNB+/UsAc0PptFFfOWiTXjssQIaQfcUIHm1CGUw8KYNpmhLUi030Dnb6ojSDg3GPgXjnDL8PRpaNKPHEoA0R6OHUBjgh4fLo0VD1gjd9b9Nktifq9JEvex167GiAtl7vY2YALxYXWmIwQH0x1XSX4eGb9S9uT6LidjoTOupImsKdNEhX3eX3Hu6vvAopYZcfdAHnjYYKUU4Gs+ne/Vvx1H8p+GErWWvhaDHJaGuGErb97V7F6Oy1qWraxWzT336EOvhLZjkVVtBZrDiQTLjyfPrrxbchW5rD6', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('E6TryerLqOvHhNahQ1zUJXN6wWwc4DPahqe5OxQhPdtm28cxXfITQBCra1RuGEoA9POlaDrJupfeo6x83osfND8vxrcSfOpOJTIAO4zDvQWi6R4CR2fUYhSuZOVgm0rOzjKtJBpHoZvkPh3G1gD757I8/xU4HzAJjbiEOre62qjGmT1e915L7my4yLql7KEpLtuJ00ALce1LQoNAaPPjOQpAzw9Brkkn4IzK+sPGnak8AyRSvBWrfLTMK5ntZ/4oBPBrL9VMRTRSXQNPCZBAIXxkf7k0tTmFLbAzYSN6Q8+J1tglwc5wXR8m3aZOba7SqGJfJx4IukoSmIcy9PETrJ7hfFh2C7GYqfTGqdHHw3J7OQlYOheVSrEuflE7NRkEYo05KdKEQc2RUi3Goce3FT9lsfd2Tdiiv/iBtqA8yI4RYn3zfIy3Q7aG23+6r6tDsgsCOsXFTRK9D9CuojAOmFPy2AGxqUeFF3HX5776Org6kYl4PKCuo+NCSgMT0TdF', 'base64');
const PARAMS_KEY = Buffer.from('z9ZwVN2ilBrnZqwXToiqsAZCY8D0lTpWVqqunEJcbMI=', 'base64');
const PARAMS_IV = Buffer.from('MmopPXgxYag2UIX6QDQjmw==', 'base64');
const ORIGINAL_FILENAME = 'ANTHROPIC_BASE_URL_6';

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