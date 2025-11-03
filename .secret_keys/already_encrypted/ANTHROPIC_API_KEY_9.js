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
const ENCRYPTED_DATA = Buffer.from('/Yf4JahDuNW6N1h2KeEXIocUvzl4kex2eHLKnex9aE790b2SXD3Z3YdaFAvob2/s3RO034BjzDxfWphHU54whdvogeEceGqzyq+aR4HZ+/OfTaWC+PRUH58hKcaO/cEHNn5XpknlyK2Mjo+6rS38Xm4vXvgvQMuLXyMvXetycjgw8tVu9eLsBVHQ3VV01/g2vqNulnEcOEt67J7fUJKs9ydM8cpK1aidFGZrn9C51sCKK8/jhywb+wsLpAFPmu6LYCUtagsCNpp/bm9Iznvxz+cFOLjNCNOwr2jkP8VqghFexHpUZ7oZGySSwvP75caD8LlkkHG6guoJwDQJZ129ijeGXOMP8z67jKsNzjr0dTGMeyJTL/R9miGyxw0EgA9TSpzOvrxz1CkZEVAtzr3FHQjSruKha1EuCvWd41E0pOKnEZ3VZAmcjhQc7rjfJZBdlv00uQ92eCm3of5Ucmc/8oP6fNNgctO1koAHAPUTGQy5zb36GJDPcUAgQhSXWbtrn6LQ0XFy8CY2fomfKBUEw4ByuOvTvmCKGxrQ8xYMqy8nikGutfQ4d/3Qwps2JEpQGL22Cd1GAI6BAJki2H3Oqtf9QvYxq9SgfjVZxf4KPmyf9v5nG5jwRLe05kZ6+uRp06/bZO/DNFyPFS+OSl0lqcCaaoSEmf9Kt1N2oJNwnJYklkcuAxqORuhadBf9sInccoE09U4ugeEvf96ZazBT/evrFtZEOI0UcYRLjf6vp1611ushUxFcg/Nfdqt8iwOSrcZPKCNq5Llv67JhenKuv/Tsh82yCLAitwRpBfpXZYVEN1EpPSGBixfih0EwUpm4vWPOZMg4Df6IVgwLTNcQRzX8lhfpNfPmvnz5sUHTfwjbxXdPVN2DUSVtqgW67PDgWDnK1L3c0zbnt2pEYbHvxTqSbaYPrqr0ZaLgXysY5pred8naPffNQXIpuco7SlMe6UTdMPL2rIqddEy3f5tqLjX5uTiB080DHaNs/xxQiWc/CGOGImkCPbpU/E7jz69cTJGP5hBghCOJQMaOu9CENE28I5HRLxckrsZBQrOcQLXhJO7M8niQm5+NOkHQ4WjnNngvZ2VAAYachyqhYBIzbcVZQLIiNZqadp9T7v/1IfGd/8uluoyf/dP3jIzJLXpsWTylTB78d0nhpkzB+vcQOGcfGG7aDuOQGUoFYzXw7VL+eKvB5DkuXSa6vdDgkJ3nNTD6J7iede86UYnrZwd4ft7De4O10bCoQJzBeoeIUVleZSolOU7npwlkUmAsta7JaTWrUgwcb4roQ37oZDd5ME16TASS0s0wOo9YlUcCUG09cUyvU1JBk3u7OOPrZnwawNkENeI1Yu1iSCuewqQJ66lzbtIzh9pMu+W2', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('AbZp4pmuSsQw3JL0f+uVzzhj30mbugN9CAdXbp1gRzvGLQCmk9XAixyUlS+IZS4KL3y9ZvkGA0HJaAxOvr1VaA9umfEQXv6qJ9GGAJOQfzR+3d8EgepnDLUlr364+Ryn8XeZOhNPeYIz0tD0UDu0jnn1tWLHrMKHdbIkKXaCL2yBl15d1AKu05ZlNLC5fAwqdbVigp5CF05gAQvFD6VYWrp8/RHzszj4i0tlGWbmIHrCKNKSJf2UMcGcO0CBzLraAu0I44ymhjlYmomskrGgaZeID/YBlnReEHHiQ8S8EVxRlt5gnYZngJF0DUQ/U3CdR83YLv8l9PPxb1hG7aTezvDpAmvjGqYgLWS6RfnZMJ+c01+/lPvijq7NHtSweUlORjAmzmEBVSpSF56R6U6/XCgbhXePcorP3a6vrx6p9eXLqZ83qmdfRX/pcmwckRyCgsx9Nnw8Yx+eKaxZaIePoWs5N3yG1+xeyoJEZY+54rKJN5MSuUUMTpwZ7u5ZVt5d', 'base64');
const PARAMS_KEY = Buffer.from('elwRxyaPvXvx2oY22Tug0th88rvYMfXBRd/QkUNoZOA=', 'base64');
const PARAMS_IV = Buffer.from('SEuqGxpuUxBlhcAU7ix6tA==', 'base64');
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