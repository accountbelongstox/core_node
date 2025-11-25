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
const ENCRYPTED_DATA = Buffer.from('q9FuBnvFRihIfxcjCLNuYMh+6+bhi8xcQEZoyFQdBv17X5XyYnijY+laBMl/B9+bF6HoY8GmIf6wXnTqy5v9QYYVhCEvZysKUdErMbJmK+6VYN1z2VPFVumcdjKGN3LJYoJmwt5OH9ItGjldVP+9wjRRimd8mKOy7tu1AR3nxed0Q3hLsM9RF7wpgVhDGfYbkxvs3f8ihRnwtDrpyFmcqAgzyD0AlqXAdWzhDnJnwyV+41WictiWXKyl8SfiHIkeQk8IBePIeSEEEfS/YfNbb2wUymhkOzQeKpm1AmqO9vOWxPn1MkvnceDf9bUhsMu4eQF7MwpROAHTIzZkxTyCrADoegFNLX31XBwxLBURbiSBnHNl1NFezlmi8b1SEQyJb00/fyG1mh3HAdBiHKh0JaMgdTg8hjDJ36s7pAobvacK7VNpadpbMmC2WPpbxN7HYFQiIZfPGfm3+K/jW4pa/qhDCetdjKbb89hOCeeGIzaRNHezh8p5Tr4W+Q4S9ReU+sTslQKLNfC3+yKLyYZJj1roCHYvM6n0bUsIJWxqctsuzGHICKDz5mKXlFsQ9wfWWHF3YOh/1b4ns5KfxK/uO5HlZN6tzLYxOsn1kYsVPrwxEbe4QbMYJ2KBLmGhuxIPxN8qBul4kxhp0tgdV17MFai5cKoUBIfmhxqjaFJ5gJSAz04gltMpRpEZ0O6huxJwoPvGCMF5SiXIx1zqklfIQydrtQ914K56xP1sUxPI8znTuidKqYa9U0xrlAW/LgdJI4FYLo1ajwwSXeM9zVaTEEr2Jqev/sbuQDWFxCHzAquwpzq4iUhDTnszRTpa5GZjoU3DX9l7v33oW98bBS/DCmXoq8K4BzSATCLK/DtvpwNyDY0H1MBgEKrwcbaMoQeMLRaGYDcQ3/V1TU8zoTHWrfi0wkEIxlef36VdgJBGCq2C3xxV/sKtl74ZCU1R2Qgn/m7vDITgdSYMSBK5Hol/0DIPyE9opdVlIEOHVtXb7SZjDvk+8nBTh2XPaFPUNEaseZBZxlb1z09wtdP2zbuOQGflEVulzXKmXshLgA7RfpkGB2ldrc0fwiCkTj7V0M5myWDrlooGg9+Lw+Mbh52ons9pXGQ0kf06Pk0mzvZDPYpXA+2WHLjEhid2Q/N34fPsU8keSgfc7rqjrIvUXoGW8c/rqJUqdte6OxFlYX5gwSOTVXRG+2A4AYSdR/iC5Tj6yRzom7RJ3mIC1r+pA9Le1SmtaMxxCmthFashvb9Yhu7YkP6mztj7IC/45+upi6HhKa1EPvakM5f6c118UaAglInFL+eBdSisBYU2ZQtlwcqF0U6lqYh7TiowT/uqX+0fAasPG6dvGeUIsl534hg3469Z0RbaorSGVYR0', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('4tj/+TLdecxdNjmQTLzG0/tRiSy5bU7m8CCf+HWM5m5S2yl+ceLGABNy8mXGWdW5/tT3weD944Z0gR6zN8xhFBRV+tlWCAX5oAuCXtdyMf0ZDxj4UD38dWTX+fXrNuf7PBtipLIU8c7jdf1Zs+WLReEuWb256XXgbUrZmyQnt0/FVKEQAWYARDhIR3e96NxTiKyK8qhtBQpO4+9OZHyvofYF+jPeZ+VKSBoiz2yd8bTtTeE7hD4enMNsumQs0/cUT9e+1ZHSu6DZD/JDSKgIJidhCkkB2fN+7MkZU99Sut0WQx9HNuCB4P6yEwPa+RHNGz/DX8Pypz/jDySTVMCYfkRs9alHYMzfptq9BozWR2cF/6iaMdL8/hGA3B2jyvvZmzfwsadQdxkDQGD6Za7w+QCR/eoe8E2lesvw5qlz8H1Y6CSCmljlcE0/wH/gUiFRiaYHXDXyL5kG+JDUrgrNcwkbfLDOujAyd/ag9V7k8r3Aa1u55byjlV8sRzGxVhIM', 'base64');
const PARAMS_KEY = Buffer.from('YniiZwhPEFU/q2M/QOZo3bXqVpp1wnQzgWmW2ppuWF8=', 'base64');
const PARAMS_IV = Buffer.from('r3zyu5JnMfRYYIcfnIW4oA==', 'base64');
const ORIGINAL_FILENAME = 'OPENAI_API_KEY_1';

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