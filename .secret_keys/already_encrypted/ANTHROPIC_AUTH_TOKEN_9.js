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
const ENCRYPTED_DATA = Buffer.from('/Yu8jcdJAihIeLJGcN7svCer80DZwJfKdp0xxYWN+6s5mB/PBq/bpAJ/MfqCVsx+ntRKqKRVg8ebyyeota7ktgkuTMz7Ic4NMxjRXE3KbNSZykXTWnYJPkQ6PcRPJfy9SGtlZbRYEIXc5qU3+spqnHdkKue7F0VbKShTnCjymNGIbLvO5Z/XfZtlRpZlBVJJEoihCI2DhD9hpiZPAqTxZf5KfkKi1cRP/sK2VoB+8+H/5nahhnI/RQrAKPEDlr+Fapm6N+oihqoIawtDbKjQWxNjKyAELqy2nsXKQHqEcp/GCM1JMbIA1ZHkHxY9WWWZnTYszyVJoi3xq4MYHEbYoA9GEymskth2smfeo/I6CuOx8Dn4wDqFQA0/Z7Qk/yBQtnaUQL/NWrXubeUFyw9fnl9u8Tk3caxfrFoQnuIByV7x6avCEGkoZdcYeGJeRJUcgzHuvOcmJJyCeaUZOxT0fBBtb3ISVAu+GRcBSJkk9ak2URXmwpMgnr24yLiHjs3/Kuk6ZkpODtO9CDL3QxIHh6Z+wfvzijyTnqyUw2Hof6KZqz4Z1CzhsF3pdusIi6jrNptGjiRt1fyasohaReugwmYoTz9BgYTlI2vC/8BhNSIHvQwCzvwB1mSvmn7pTkLTbmhIj5H/950znmYh78Tv/wNuoH7GP35O7Xl2nRO9F88FKUYjwDRyS2MYnDtI0nUJYka58ivDDbVbIcTZzkmpopfIYrl6eXjuc1y0xXJdSjLRM9mX+/YvqPmylBFyBSXFIEGXclB95DsMEOchBGID5I01Kbnm/DslFSj/n8HUtrcE/CFcHxOgXUBzzpKiodVRnTzxkPGsd8HyRWOl01Y8mwyaHggfQAKnjfFjeX/1c8FeFj7lA9r3KaMRgr2Q3MVBSK1SwXJd9vY0xrq4PMFNpd9usu4JeyhlYk+Rey1G+z6gvnbkprEimUbqvfoLxM+LXRYxhXDgPrV8MUPpjl0hI5CGvfFSB09+X9wE2Wz5InbiszveVbuNUjv/KFJop9TRwSla5rSawl6MHBjs9REW3/9rIDXS962sLyjRdYkyCBfUSG/FbgtZaLDtwD15yFk2W4rCWS6SdEv/m1d9Juuw95gGiFhsURSOjhJ2uR4fYv8tcPZbbK4SApNxHcbGH9s3Yf5cbukG/Q+TH4HOGuXwH98Ayl6jdGlPFN1WFT9BDCa5ghEacJ7v4BE1YR5YfTTipzDRqvjxkok07yxY02Syqm9kdCI3JFAE5eZDpKTHy2fvcwdZRruUUw9FoM/GLg80Lfosj8urFcJ+RX+tPu52CMhqG+DvUoAOe6b3by3vQDL/EFgLoh/kVDGThBXNWIeY/1UCF9oH19eGkPZWIPa/xeSwnexYotHB3MaE', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('QT7X8p0B95AyLKqsq7sShiKKEVESR1PoP5HlW62WMIDmElMpBsZ188fBatgTXQNcNftVHomxXCaS5LNdgdROCa/UKhJg1judlGDDCUiGPLab4CdZWev0Wpnr+D8R22kSVNWFyEzM8lni2O0MAoygJv46/9z8Gk+XSvdCOS0YcWnVLsEd/+vlnlnDcjMzS1cXHo6C0//yQ59ETJl9we8BT0D0hYa/gtibH+WEDTN5QlRafIoq8EWlbwmCBnoCkBMN2it7wgssb/6vKr5AX5D/+85HUR6Lt+0uV45DDH2MbwG7udWz7kl4tXqVSfOCUW7TJ0jIhjjUw1lV3dOr1RQt3i/NkwZV4Pfsl71Pd7iwkTD88pKno9j1WMkJ808dj1YBQU8PMpvSWw+B2IiTj4CnX8L5vkF/aGxGq+NMUVJijaLJo1Liqjb1VDYGXrVKcTSgo4bTUNblvXrxWxOZMij5YY1F72gQOeyt3fr+DmuCwjSj61miMim6wLPFLHLopgli', 'base64');
const PARAMS_KEY = Buffer.from('b6HTS9nWcJkuyFlvNutSWeJqWIfE7YHT7lStsNFnRgY=', 'base64');
const PARAMS_IV = Buffer.from('5dVDLaHDdH1hPwAgj7ZYMw==', 'base64');
const ORIGINAL_FILENAME = 'ANTHROPIC_AUTH_TOKEN_9';

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