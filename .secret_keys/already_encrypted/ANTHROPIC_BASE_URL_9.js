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
const ENCRYPTED_DATA = Buffer.from('fOUJRknYMNfzUU6+FcCiCkFpPHAjJs/eoyHx4Qtr7KnSy1I0P7BP796o361GB24RgqUy25pPCE9Q+ih102w3ErOpY8ntX0uwJsNMEz1VmQpubh1erSzrSXS9rFp38kfYUd6spXcOyNyW+no8c2+c8oBpwk+sGp3M43RVoXi3RBsuZauq+t0Bb+r7VpHefKQK89kOCmb7IvffYU95xEkUzt7S3uSVHEyy6ApBlGXy9nQBS8c6J2CzRGrIqcq/XFPEnrRtRcPAQb9ju+L9SFfSt9QDpEfK4qh1E3w8mXJLuVbQpTnGY/CbGr8s2uJGcoZFWFxkZtXTShFk8SsebzNtUkBZPlMqWyMLX4dPQS4tWRDv6VzZZwaEPxHvtAkLIZn1selOhk6a8uPdUkXxffEogTP5Sl+wMNMrgI5x/KNjy2VHSr6Z64LHi8poeOT7VHz4CHm69kU0PBvHYNEIowd5xASAFO8THR66e8gQxfB+NrTluarisz2zqRQiEHQdkbzKfn5dF9CYir+9aRl2YbgJ/Nwr4w19YY/dp15T6x7afSLQSpsde4atBimbGs/k5sdRImT1x/aTdDd5lT9nPkhz8yIydxnvEJQtUaQ9h0sRE8ENBSoSsRWXsaQSI3ev2FszbEg8LmD9dv+hoYbJvFWCCWZkHlwg961WMNsUZJxan8VmcHrTy6aFgUBr0mOuZd9bJ2swOWreVX2zwxPko5CMu40k2bcd7GKCIxU1TsykEstiojoOXwm9DhDjhSvUtqHRqzJaeZvIkwpfs6ImXZA6I4HeCeIV1uKEPiRyKYt2QceOArH36IS06xIKJi+DzFgOn0S513hz+OILBS7/Tj+lm4O5yHAhnTKwLcbTfk3TfE1FoaVLZBKoO3QQiMG+VCmEMKBUYmIIOOIAVQALCZaZX2D/0U5K326G8++0Gc51X9/oIxDRMgdOkouJKjV/dL1UwTi+fe2rOe9Buswx6KLRIIC4srIXOD0X2KFEAvM83SDORsuj9Xgw13ablgrjn8aKcxMqhKhnpeR3CHIEYw1k07x3qjsZqHNnzYNJluPQxKnqcNn7aUY7unAn1xEXzFBiZzCAWSQKvfXMzKTXCqQX5L9PIKF4V3rc7Oe2eYCUGJdYTr+z30dIkEZCLqEqiwz0hmcODrm4Uou32a98bdP0vhg4a4Jz/e1dT18yr/ueiR+UxI2VvUNgcGtWTGuKd96x9ILRWrcIboMMNri/IcRiahdFD5hgbxwPybpDDYLZkvW6CQVVqtJWi2u5ISbtb57WZDQUNrxoglGRsQbIbf0duio0xqw14uF2cauwkp3mNhlls6sWUjDjfCLnnvi/gfRvfsaQiOr2cNWh+X9GxzTVNG+CL8TG32ryf4p8', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('O8bmRrOyPMh695pXaRmX5KqerkYUy7lk6hsdlkLPKugCMXE3kjhwhTi34rv//bVzQZsqP2Ks4b/r/uuedwz4MRQeuB8SeAdHHRw3hUFTwWAJ+yKe5uVAlxb+BZ0SSeFI7YNYuN9ATDQfbbBt2u0uU+dhtxvbZMD+AvKn74nNDP9tsZgp313Rkpji1FRivqhko1CTmcn9H0tnRpnu9LOkOTwNcjBnoVlwADvy7Klmw1ooC+qXT+tRque1ClPrwhv4YlZ+xAIG+sIhTY/T6poM0RzPf/X12/3T4pSWN8OQWQoe/mv7gjLVMsqBoS2F4XacqKdxRRPpIYJ3lkEG+aQiEYQiS5AqQBye9zKdmZ+Col9WFG//R9hMaXFh6Qv74ySV1sKPTUmECWVOg5RnXGmATsTiTk+KtdfNUEObvqn/OSnN2LVCWLoyPqblulqPr2LNMibp6fteSv1zs8dl7Uy5hUl61yOF2LhaNGo2LzJBk2s83u6aBbW+udKcfbzGXHif', 'base64');
const PARAMS_KEY = Buffer.from('Teaq9C61z3qIfuukR57Drrw8W8iGI0Ipxkq5TSvp4PI=', 'base64');
const PARAMS_IV = Buffer.from('8b8tk1JZHMTGZnAGVdJ6Lg==', 'base64');
const ORIGINAL_FILENAME = 'ANTHROPIC_BASE_URL_9';

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