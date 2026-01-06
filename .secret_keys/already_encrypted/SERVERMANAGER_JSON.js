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
const ENCRYPTED_DATA = Buffer.from('ubt4waRmB0h18MMB0+AhLlU2MaH/zu9N0/WJqKKtYko3T5+BPdWkzckEnhcJ0jwdJW4WysXqaQGsWvBP35Sr83iUjbUHBCyNsPcVNIgTa7ijRj7Ypn+pZ8unvBZmDsv6I6hnKZYJPiBAbbz1OLzHLu92210QjW2QXs8jSySQ0Nqw0tNJxjsXMfDBXcJ04a098NiXRkMJQGmJ8PVKY4mhGRG74YXAByxKNGQf6An5eDku8lMnFt8dXsSLkvtM88YqPgpZ1YYPq6r+4thBbH/KtTDgSsQ9Mp7oysGG0C9NayCJuIA145MIcl3jQXZrqy2FalRRqXrTHNIUcjfZlWuVUsqPybNRrT6ycS1HZAloJLR/+7SjLT1aa5gWSzhpxQGWWxchsLt4vbkZf5f5q1utx4iwsBalg6mTOIGLSmA8Qw6OUU+hV+ejh0hT1/cFgvgv4gi7u/P8hbic1iKzBZwXxDRs5qYGI0Y5h5NrbjJj1SbUDR/GU2Jud9pTx7S5dsSvWWCfg/3HT3xO+7DlXpgtYLf96YgqMTd20i5tLczA2Gcia4T3Ap7cypRCkji33aCNL7Y8uUE62bRf7FDgFF0gxnAnv7FYO/Qw2I+wSKjYeoNrRN96IZ0MElrgD2HrgAsOZQUgtURWdTiesJRNdT4BbmbQ6UVGuwhPbadfAEEiZpTQ3KvSItfEbom77ug+s8Xb47gl+qub', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('VPc6Oe6CXAFQ52Qx3wCf7U8u3hLhqoPwVuacmBgNC5h5F0GzxpDvnefoZhW/uEw6OpUI/IyQ/y1Si508aWCemR5uee89OVVohbxWPkSOtBkq59xqZSsi7Q86p5rRVzV69nhTMO2UH0vLgLB96irtwlknA6zBE24f8tyHbBZlvKZHKpRVJM0zMzHJ2apjpapyuaJSsjMyOhvKPIkDWshgnpER0Q7mUbRw0Bswdyye3vawyQDf0j5fSronyN8SkXCQWGVf3/mlc6eF+7q5wGjGsQtej4JvWHqjYyBJ5YxbOP33zW+oFW2M9qujuOcudJXbUm2aAgslIViwmZirGAly2pufKGEyysejjFcJ1o6OPD5ZK6iXq/vMKzL+Xi8japTOSWpRibgsbmlCcWN4ntHMDLzLKnpUSM0heb25nGBnUdRrVy25/r3mU3j+CAbA0QMs+n9neZI2WSbz7c8pxvTXVsFjsd4BPCHZ0wgD68txnh/Gg+jKvI9AfZxj49LGmSLc', 'base64');
const PARAMS_KEY = Buffer.from('Axa0D03vSEXbWuAZmYEoLYRrt30zzkgf75LGqxsvn3c=', 'base64');
const PARAMS_IV = Buffer.from('n+gwHwLomdOsIxU4/8pbiQ==', 'base64');
const ORIGINAL_FILENAME = 'SERVERMANAGER_JSON';

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