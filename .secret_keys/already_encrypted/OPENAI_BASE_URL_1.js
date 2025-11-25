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
const ENCRYPTED_DATA = Buffer.from('XCiL6DKTFKwFFN4q8QmNev9hfEe7x4Pz5QLwdpTFiZGMNa1YXMl2Iojqa/JxO0aLn9c74Eopb62qltlfRfFwCiauXihwFCH8bI5FE/yv9k36TnoL1IK9zulvkteK4O2m6asQIEPaGClkhA63zKayn4euZKnde1IHP0GKxeTs06j23g60gO1Tk0T4Mx+jlRV3Xbq8AAyKfQdYDAYPYf9bijey5zGb76AwJ9E9SxmQykoEePqfMIbkXmD7bO28u9O4JPKSuY1XTWqtD4uWDGvbBxkZukH1ddus6KO+6/s20wUnuGnU7ySEVxlYjNy9COjue9ddRb80G5PjKj48PjtkUdL+iCeaAZl/vMvH1hLN6A8ghIGVe1QmE0L3XShg02qv1b9OEwwmmsKqo+ms85JzoO/BtlnxpZzzKfPZ+UFTOOv4EDpfNx9pF7cXpui0XL9Rg0s5XVuQKQW1rH3a4vYuhoDeUMCU3/wo0sFYVpd6zIMpdcIJk8CtlNlRIuogp7IY4G4maWbUDRLc/yODVbdMuMRdOwdWhZhykiXqWk2AbYN5QX9Vbd1ulr+U787V+4yxxRR3ze5e0KAgE/Uzod+K06f2DaBfM0hYVdVhhiYc69c0d9PQHS7Qj0jwfmD7hgFZSj7O95j5XZDxS2EEvluTnebI8oLlpKqyCedalciyTT7btLP/axteuTY+JYUZk1s8vZprxPcDmVxbWApn6ccNrQ/J7G3nATdZV12RFHNTkSURoqQoBjQoAHqn+3TDYGNdvcJ98V0N71eKnAj/UXD30l6XW9jSEho5Rc9ZhyNfQYtvSuZ5A9pegL/kslNbBfO9BSb2N4CMc2PoNU5oejhZ3ov/0aJyPexXWURQS95xPvBgeuqo7MZsXhh2wi4gPGyQdr67/z+lOlWxu7x39SH4huLjuzav8ITcNbVkApgC9FQXyzdwblyDfqHWzGx34EBXG6ElaNWxmE+esmoAZmA+wR2kxBulFMpCvm3SSnXLtoDIHymybdbO5BSEjkp8HLogsvnqhBwysnDp7Q/14KyfHeWcBxFiv3/394yB+ut6++WgqDykUDjnCYse+qVQHXtgjm+bXxVuzqdf/kYmIwW+oX7IqgKjgtxrV9fDyAC7UV7L/sEglwOqLQr+n9SS/MupqCSp+BzfSxKViqgebNWZUCXAvyOo6rMFqZPzEB5H0n2QgzTgL58OFa9XvQ9ADKUKwepzELLMAmA/ItQrjIkwapd0BLgUG8cY9laWTni81SpI4i7incMcyN2jRZpHyIypwXnX0a2k0p7UiU1kzwpNNSoicMxdmY4F9IartlwkEr9PfLVPF26JxvsSnScmMcB4s36+i4RZhIbrn6uluX/dG88gZiQJq553X3JY', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('tNQJnsk6K+BbphYkyv8TOz3Cz3oIpxnCb7R2KwXmW6lAeNlQnA94meYefUsNFlJ6cSq10VIec8vhpYqgMV3Ht942nKWxkICmt2X9z3C70vdv2J890Uj49nnB+yCP7KJZN9gnGuhcezhLVehP3xQibs+x6Mv6jPMwrp0mIi0mC1wzd2JDDu/Is/+KAzkAqA5wjhHr5e9eP7P0BcMinT0DkIjXUNIVeaZEKhhEskUuNwfdc44K6q68x4vsrnjoskraoF3OB7y+tuKHr59bL+22Ft4JMcCXMYi5PnSMUhjR2aVidl0UmL1pcg8OXXbvf4KH0/tK7NS6qrkJ+5s/w+qErPHxfEr5eo60j9iEdqowTwTg7rV4lTLxyKR82AQRklNHw3O6EKzZNddD8bJvZnzTEb2e/Ri49mkfeYuiRuLrbKwP1VjTX0zDDueiF+jk22Zu/Vg3XEn+aVJJ7QdlLXuSKKL6NMFA7BNs7UN3raNnlyKJOD6STfh/rUyh3RcyvE1p', 'base64');
const PARAMS_KEY = Buffer.from('+ReuIGQs3pr8yXKxsBtxyUjTZUJFygv5HMr/6K3MVSs=', 'base64');
const PARAMS_IV = Buffer.from('w3jDzllRbW9PoTCkeLiuBA==', 'base64');
const ORIGINAL_FILENAME = 'OPENAI_BASE_URL_1';

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