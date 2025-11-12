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
const ENCRYPTED_DATA = Buffer.from('bZbaJifbzl+lhxuxEBMMKFjAMnnmqKX69UeMvWkxG5MsDkG5KUMIi+IoQ6SWO+fTA/MvJjHQdmnspo3cjVAbAkzQzSHQjQRC77F521EIBrydvrY38r5qN8A8uA0qAFmN+dGs/W4gu3Fl/pTlm40x/4gZ5tWBvy22nlatvkXUY3fpjOJz8rVQEGfSJ1mn4V4OQipXM84UpWecQ4MZFV5OyMBrTJBtUrGHg0sXPbk+Wh9OKooSTIEu+54XuCFdNHy5IfLrAddeGXwfKSldt1aJY2OQEnm2/KfCuKFEBo5R9cns1MCK3Xes3lgBE5kNZoNWu27OaiiaphueqelCnK9u+wEzMMWmtxc/25zxg3QV9kSQe91KdcTOgLORV2Kuzj9RPtJ2+X68bJYp3chVm/Cgocf2WAKu/GpRjpnAJO8Ul4GDPgcZ7vQy9EbJ7aiZ3s3G5mRYySJQ4SnBcZg9ZThNwM1EKtu1+sB6t5yCskpJnX5gRr9co36hvcwxbicmvsVK/+vTwzA1HrovSxt5aoRLgjhZYguu4F3iswtxr1mRLACK5EkIfXapH2jVoeTVkhMLSCwAy4ppWUIR+2kaYW8c9EhtnADphyVlyFsp++ZVg2detFqwUE+dKJdz2FKdCF1hHsWrfNS25LNYX32wsfH16Sp41ewtZwKz9ox/4xF/Phcn48QdcRLob15dnhg7y7cS6QlLGs3wbS9rcnlGipLGsLQwfimCZ76w/rh5IEnoWvC2Me5NlTputIftrCtnevnSepwkx0tGr3OeGoVh7lYLKoIx5oanOfIO5JxfYVGl0ZFeNroabexKZld2wy7wFXcD+oyz1wDqsbUgcTt10ZApDxuuaUAPpKQTCoauIXGU4x0wfATo/9MPo61TVBSMdJLsZsKhAhrhl5eAjyjGRIi6At7L1VIIkwKoQVny/YeF1zadz4A1u+PqI0Z+WIXmt9fLl06FnKpQWtnDnUvHQPp94K2oIKuQFOs1ytlYcyVIahggbCkTlUzocLP1XLbWGPhiGIULGjf+QY3KV9NPt03/9QdxmFmNpCXGOFOcRMZ57teAnuCp4nbMkDCxgHRYw255qfUQdGHDzYTtPOBCYwCWnE9Xziy6M+t3y7Ko9U1LD7nKTAF3r0SNYNBu6A9+YArU2kJjYCNwzqTPk7KgRje1RbFbM+rlVa2f5drK91Hdob1LlWpn9K34ix1DT2DUdfGfqs81iCeTFLA2vQ3xl/ufahi2cyMM6r/vaDsF1jfioPSud2oVXnrnnighGqtIuoOnMXfG6+FFyG944zRwmPphXmLcf9bgUeQm4A4IansK5ljHZkxVM6Mx8TWrE3Finr9l28c7LnUrXplx7o1vUv++caJvJ/UgTnwCLqON', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('+V/IRrAsBWzFYHLIwWGID/oJlpNNGfaqelwb4Luo/ru/rwrUpS36CR3u1xnBlFlWmMrvAhQqoLIKbXoUarU2BXGL+iQSXVEK6EEx7KZeSvhUmvfmZD5804QxC4nRtHP37sJrzJ982E7fWtZLQbyu+mF4yw0pxtY5D4lEZnOHpRN6UTA/fxgN9AfJ1/UbZeV6Kyo/3GMcgpBeSs0UuojCbvTfjdSiP8d01IlKnR4R54OZjkf5WIjMvmeOw3qgP+eOcVGxUJvlWQ2s5KXQmbRYVSSN+aCVk3Y2IngnktG31v5JzDapC5fPxEb7TIOZYGyq0+jLXiGXm+qBgyFKSSIToOtmR5a/TU7oulrlTepcRlG8zlCWCMHZMJIuPGRgnE9H7lzKcwcH4Z5X6i8a12afbF0OEhbQu5+Q/hOGfSdfmtMWLzKn9y1NN69Q4feePzOwUux+uvEJ+R0V8QsOB7h3r295D7qTkFLxOwhOjHfCFTwiPkWTcTcOTUfTGLCeyr8w', 'base64');
const PARAMS_KEY = Buffer.from('gcrzN6x+1+2PAhj0tV5VfpNJSh3JB2WUKoQD7b+78nU=', 'base64');
const PARAMS_IV = Buffer.from('fAUCESscEIH5a5PLOYPIzA==', 'base64');
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