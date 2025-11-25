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
const ENCRYPTED_DATA = Buffer.from('m+NbS+jWeID0jFyN6s5Zm/nsifuOlh04pqTkpduWrFFgTDlAvZmfEytCdR+js71lh8Xzl+jQLVFuyYgA+VSd/W24Yy9zvoRsjrWq2dSuENocx+oMJIkSgqmTiM4gbH6Wm69zfhZE/zu7aT9a/ac4OGkoWJLHrL9tu/ABir8QDDBavhJYJcxDMb94+tvcChx+bsnIhqQgYspfjxMqTQk3BxsuATvlzRegUMdwZ+MrIkYwd/dD9/M1SbtmLR/rBGPn7FBPv2Gbyn9LNKl4JvO13IukmQK5Sc0dxKBNoKjnLDbqQyU43WxUy/ZXTcU1gTu/I+bvqqM02WKtYtklbJYu6Y34YzsT0O4sfGVHkhcepnEb3sRlMbqFEqZ5sDzUF9Zs4kY9DfmN0E9SePhPwsZ39+PZe4etpC1tKQvHoAENoNoPHNN8+xTyhRAWH/ousfejXi/RYu8GOmu1aLbIfpkDwgh8oojW1Ls5N9zTeVCmMEJ75BP5hGLjhSMImspSznRVsiqZ5N3UuwET68QX7qd7l9Ghn++bUnT2z2Imlc/CQ2OBR5lrctoqeqDexuFdQTn2ZM8jEeEldamu3pBdTNRDpNru7/kBWkLlLUI8osZDBBbJBVnroSkSF1Jw30bMXDro+gzaEylMFC4JpQ+tgg4qTh6CxtKBa98Z6OstBHrneAFIGWRJgy6fiQMMSGlw36/umjP2nr8DFoiWRkVGKGkyhTHURyl5jscdZFQgjkSYZreFtCk/Byp264if9GvIn7WGcqTH1xG5ViOlna6NX6HubzcXDB4pk8XipNQJMFpQC8XZv6oRuNr+mQmHK+vnCgSr9hn+8X9Uu80UkmLI+La9ZUnGcY6puysbtkm71tg9hgKGciu4V0NMVumG61nXNAH4HEOSdJDaUCgXFCUGasw35A1fkVfDC+g3lNZYnE7wLVgWUAPHSpFwDzrXOrBwSvtzoqidLeV3/2y9I3g/Iee6l5G9ATrDL/oXcrBFOw8OZcaX5POnm1e3d565udnZDIJK1FiVqO4bvYd52qUp58yb9DvM+QME9KAxY5z1eJKPtJa+OmZcZtSAlcAl1EDu8ezo3cnqUT7U3ZP5xVTUCwkvRxkN0QoeymW1UQ1ISzIplVJ0WMm+UU94ubY7d25py1gSnwlh/tlx5zEFWKkLzxhGPVDnzhgIVhg8k4oAJxDfCrcRPD4V9D08ohleYWQxA41d2hAadoQ8dHIbpjE5eNxpVHE9rwL2uJdWogEmiMeHFP0vxQBtP2yLp/1Df9Sd50I2xB/sQvy+YHuM3LxtAvZEeXe5qTHeLV68SOg+N1kq5xyghYyTxnYrEtdkqW+0Md8uwsLtvKxmrTb5qtXc6SLjI9lZxQbS+EXFE+aI', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('JU6u0tAoL/5CVJ+a3JNiXBWitOBDwmvEYvO33wQKYsbiOtGsZKgJUNc9tK2KzMFhH6XHTXEmGgvBlz9aiKNvRgKABo3chyXZvXQo9oFuLtRuNYzP+IMN2HGc7719reK+7hM9PSrcjidGbaPYGwgkxADcAnVRaaDdYIVWQONEVw4COpZYPJLgPZOjHAtWePcyf4gZ2E8XfPcWPmWHK2DLvo9dviJgvn1CxcZK1YLC27/5Tz3pLMyuj9AMDFG2jXb8uZtAu3IRTEL8UYp+I3XyfrvsL9HpUHNeApFylhUa6Oaeqte84O8aeIIWXsGdDNwsTLODrd/IUgeEqzb9trzT8QCJoYG/rmzrdx6sV3QU1f81nsJHT5W7tiRyOn/ZjAh//DEAyiotLnrk1LMQQBXQfhVPgaVjR3Dm0JqKmvwtMhIoowdTqSxoJRHjAMQY3LoE1CjDRrXJn4UE/8alysGrBTk/k7XRPGfW+9zQ+tlgGqEGSkubQV4J3KpYdTZSEixO', 'base64');
const PARAMS_KEY = Buffer.from('1Whj0VoVTcwxWFRn3ukQk3HdglNnEayb1S4UCt8qA/8=', 'base64');
const PARAMS_IV = Buffer.from('SI8XblmSb5JTOkFdoWG1pg==', 'base64');
const ORIGINAL_FILENAME = 'DNS_DNSPOD_API_TOKENS';

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