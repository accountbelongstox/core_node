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
const ENCRYPTED_DATA = Buffer.from('zVfYinatRVWgK6I9a74KwdGR7NoLGboHPhKFv3SO5q0kiQm5LZh6OMbry+Nz0nxTEH0JbKT9vCj3rLjKcPDvEDI8UuNGzFt8H9fGeG4Z3F8p8Pm2yAZw7fEy87qiFIbd30X0KLzqaoLCNQCm5Ef/y6p/0egmh744awRuyQf/I31xFEJOpZOinT2CG++bYm6qtUbehbtNTc54fqTZpSnXz/hVw7a0goS1JTZKmgLFQm/e1eR3zT6yFNTin629nzw3vjbQ1tEq96rPqPkfLg4GRS4ik1HomPQkVUJhXGliVOYyXOTSRD21UzYSmtEqgyiSvWqE7oFz/PwkkO8demXwFl4MqlSO3+uhW1+TvfdDk82SL2XF9aXCWhCijXlREh/hmw74Ek5OEPRMWrH1g1ZDyoEQHMurbZ9b98uIhpfhQHLe1JnsCg9EqJI3a2pK4NI1+oWpa0J4eZcQe4709bC63u/KaBq7lI2S3WcFwDqhDSwVepaNlT+Is2KkYQRhh89zWtS/aL1IyCjcpG7n/bGG9dPwXwidWlmQNMjfa+ohKXmRmcOFNxF+4GAz+FOKdYxqwe6nqspu4Sz80xDvq4e+kwNumJUr3KR0f92VFNphmudsG/BTP8Wf8PN/27qcPvStBlfyM1NxWmqI4pqGYxpPPmKSnmAOxA97QFIr1QGr7cM2r7B8h+weXiKs1PAM9aWOAXUBM6/C1e0r42kZnzvGpWbTih138tNpceQKLm/ylOAC7LDYGoS4FX7JXW4pEAnz708Go9HsVnHjDJjgqJm0quNAT1E9FGgZ0QdwLplDOz6PGRqwTFNbcVLJcRWD0D5vs6MRkyvdq0w47waEg5pnX9clTkjRgCxp+KV0DVzOYfCuAPXTgz36pUTmPgNQwGKGXrtW10wP0ceg9AK8yDJiR7yR/JWntF34HfS8I1XVs+SVoJ2bzHquz6gmyQrUlpHio1ARfCDvm3F/Kv0DIn4GmQaRWGhRPiMQWd/Vm14HVt/96KW/dzjakHN8i9IJABRJIh06O8tLcNwFrFYo2v2RUxttKrcEgSDtoPwDPVjUefQ9d3B8X71Q3h8ipK9pYIYIHiF+RDFA33EX5k98NA8NgikPeK+gQmwacE+Z5Rc8gJU1XOa/xaFdjEi6jpIUdBSpZ8x5qpsNMil8b5jLO8oIbJn0VyzOmTsnef8jde+oQmw0BrLBt0D6wN7zcdbR3YsNWtsspnT5uCSv0Z6CTZdSv3H21tPOhECheOrC/LREIAD88Hq6nHHXnrEJtPL1IMoRGOsqxcqZDsrrOHy0ECYsUyGTU0IjNPTtoyi7NVvHKj0qgO0EkDt6EqFDFbFx4rJ7/VliOLSFPP/Uy2vbo0JeNBKdW1Mz2+j7X/9m', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('e46cGnTHcpqZVEt7hWuULgyvw+V+FNV6JCtsKcpCT8PWgy6siT9quExuiYoWXO0HHAHVLjlc7a4CL9d20Ko6p2NoinaTf0DNVkk8EyJkYhNcFrsjt8n/QqDS1b73wwIeUvCc+XMPqESS4tYq1rjEmto1kb6iRngflb1ZhwgtbvNK8BIrVz81IlGjsWAwzYtceaMSQqJywhnGuydt180ufLhOvJhobU4ZVS+nERqejJcDQ6/5ssoPFILAL5rqB1n1KdtFxSqZIvZ1TjIVoaL+jnMDZf+2nR5nh+73o1d0Lg2OLDBRajchwjJx+Z73ETTmQ82fnZOZcdAogidZY1IC86vMPdoAziPh+yRteOM/VtkvshHcO44mrzSzBLVj6kANFu/sisb5dBp00M2wxpKTFgWDh2wVSYJ2lE9gCeSO1RbynmZN3KQI2oyLNGWtxOJaM35sMmIIJ6Ch5qEHMN8Y39tzrqOO9UjmZaxtZqfPxOsSsN7NSYtsYHHkRWyVnCCM', 'base64');
const PARAMS_KEY = Buffer.from('/OjRPGl6PDVUPZ4486Ff9eNRX6HrVEM1iU1V+4K+ZNg=', 'base64');
const PARAMS_IV = Buffer.from('tYT7IdFZyyzdXe/IsgpnkQ==', 'base64');
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