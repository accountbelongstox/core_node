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

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

// Encryption settings
const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 32;
const IV_LENGTH = 12;
const ITERATIONS = 1000000;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;

// Load template from external file
const DISGUISED_TEMPLATE = fs.readFileSync(
    path.join(__dirname, 'disguised.template.js'), 
    'utf8'
);

// Function to generate password hint
function generatePasswordHint(password) {
    if (password.length === 1) {
        return password[0];
    }
    return password[0] + password[password.length - 1];
}

// Function to generate a random pepper
function generatePepper() {
    return crypto.randomBytes(32);
}

// Function to obfuscate parameters
function obfuscateParams(params) {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(params)),
        cipher.final()
    ]);
    
    return {
        data: encrypted.toString('base64'),
        key: key.toString('base64'),
        iv: iv.toString('base64')
    };
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

async function encryptFile(inputPath, password, outputDir = null) {
    try {
        // Validate inputs
        if (!fs.existsSync(inputPath)) {
            throw new Error('Input file does not exist');
        }
        if (!password) {
            throw new Error('Password is required');
        }

        // Set output directory
        const finalOutputDir = outputDir || path.dirname(inputPath);
        const originalName = path.basename(inputPath);
        const outputPath = path.join(finalOutputDir, `${originalName}.js`);

        // Read original file
        const originalData = await fs.promises.readFile(inputPath);

        // Generate crypto elements
        const salt = crypto.randomBytes(SALT_LENGTH);
        const iv = crypto.randomBytes(IV_LENGTH);
        const pepper = generatePepper();
        
        // Create params object first
        const params = {
            salt: salt.toString('base64'),
            iv: iv.toString('base64'),
            pepper: pepper.toString('base64'),
            algorithm: ALGORITHM,
            iterations: ITERATIONS,
            keyLength: KEY_LENGTH,
            tagLength: TAG_LENGTH
        };
        
        // Derive key with pepper
        const key = await deriveKey(password, salt, pepper, params);

        // Compress data
        const compressed = zlib.deflateSync(originalData);

        // Encrypt with GCM mode
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([
            cipher.update(compressed),
            cipher.final()
        ]);
        const authTag = cipher.getAuthTag();

        // Create HMAC for additional integrity verification
        const hmac = crypto.createHmac('sha512', key);
        hmac.update(encrypted);
        hmac.update(authTag);
        const hmacDigest = hmac.digest();

        // Generate password hint
        const passwordHint = generatePasswordHint(password);

        // Obfuscate encryption parameters
        const obfuscatedParams = obfuscateParams({
            salt: params.salt,
            iv: params.iv,
            authTag: authTag.toString('base64'),
            hmacDigest: hmacDigest.toString('base64'),
            pepper: params.pepper,
            algorithm: params.algorithm,
            iterations: params.iterations,
            keyLength: params.keyLength,
            tagLength: params.tagLength,
            passwordHint: passwordHint
        });

        // Create disguised JS file with obfuscated parameters
        const disguisedCode = DISGUISED_TEMPLATE
            .replace('{{ENCRYPTED_DATA}}', encrypted.toString('base64'))
            .replace('{{OBFUSCATED_PARAMS}}', obfuscatedParams.data)
            .replace('{{PARAMS_KEY}}', obfuscatedParams.key)
            .replace('{{PARAMS_IV}}', obfuscatedParams.iv)
            .replace('{{ORIGINAL_FILENAME}}', originalName);

        // Ensure output directory exists
        if (!fs.existsSync(finalOutputDir)) {
            fs.mkdirSync(finalOutputDir, { recursive: true });
        }

        await fs.promises.writeFile(outputPath, disguisedCode);
        console.log(`File encrypted: ${outputPath}`);
        console.log(`To decrypt: node ${path.basename(outputPath)} pwd PASSWORD [output_dir]`);
        console.log(`To show hint: node ${path.basename(outputPath)} show`);
    } catch (err) {
        console.error('Encryption failed:', err.message);
        process.exit(1);
    }
}

// Batch decrypt multiple encrypted files
async function batchDecryptFiles(password, outputDir, encryptedFiles) {
    const results = {
        success: [],
        failed: []
    };

    for (const encryptedFile of encryptedFiles) {
        try {
            if (!fs.existsSync(encryptedFile)) {
                results.failed.push({ file: encryptedFile, error: 'File not found' });
                continue;
            }

            const encryptedFilePath = path.resolve(encryptedFile);
            const originalFileName = path.basename(encryptedFile, '.js');
            const outputPath = path.join(outputDir, originalFileName);

            delete require.cache[require.resolve(encryptedFilePath)];
            const decryptModule = require(encryptedFilePath);

            if (!decryptModule || typeof decryptModule.decrypt !== 'function') {
                results.failed.push({ file: encryptedFile, error: 'Invalid encrypted file format' });
                continue;
            }

            try {
                await decryptModule.decrypt(password, outputDir, { force: true });

                if (fs.existsSync(outputPath)) {
                    results.success.push(encryptedFile);
                } else {
                    results.failed.push({ file: encryptedFile, error: 'Output file not created' });
                }
            } catch (decryptErr) {
                results.failed.push({ file: encryptedFile, error: decryptErr.message });
            }
        } catch (err) {
            results.failed.push({ file: encryptedFile, error: err.message });
        }
    }

    return results;
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.log(`
File Disguise Utility
Usage:
  Encrypt: node disguise.js INPUT_FILE PASSWORD [OUTPUT_DIR]
  Batch Decrypt: node disguise.js batch-decrypt PASSWORD OUTPUT_DIR FILE1.js [FILE2.js ...]

Examples:
  Encrypt to same directory: node disguise.js secret.txt mypassword
  Encrypt to specific directory: node disguise.js secret.txt mypassword ./encrypted
  Batch decrypt: node disguise.js batch-decrypt mypassword ./output file1.js file2.js file3.js
`);
        process.exit(1);
    }

    if (args[0] === 'batch-decrypt') {
        if (args.length < 4) {
            console.error('Error: batch-decrypt requires PASSWORD OUTPUT_DIR and at least one encrypted file');
            console.error('Usage: node disguise.js batch-decrypt PASSWORD OUTPUT_DIR FILE1.js [FILE2.js ...]');
            process.exit(1);
        }

        const password = args[1];
        const outputDir = args[2];
        const encryptedFiles = args.slice(3);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const results = await batchDecryptFiles(password, outputDir, encryptedFiles);

        console.log(`\n[SECRET_DECRYPT_ALL] ========================================`);
        console.log(`[SECRET_DECRYPT_ALL] Decryption Summary:`);
        console.log(`[SECRET_DECRYPT_ALL]   Total files: ${encryptedFiles.length}`);
        console.log(`[SECRET_DECRYPT_ALL]   Successful:  ${results.success.length}`);
        console.log(`[SECRET_DECRYPT_ALL]   Failed:      ${results.failed.length}`);
        console.log(`[SECRET_DECRYPT_ALL]   Output dir:  ${outputDir}`);
        console.log(`[SECRET_DECRYPT_ALL] ========================================`);

        if (results.success.length > 0) {
            console.log(`\n[SECRET_DECRYPT_ALL] Successful files:`);
            results.success.forEach(file => {
                const keyName = path.basename(file, '.js');
                console.log(`[SECRET_DECRYPT_ALL]    SUCCESS: ${keyName}`);
            });
        }

        if (results.failed.length > 0) {
            console.log(`\n[SECRET_DECRYPT_ALL] Failed files:`);
            results.failed.forEach(item => {
                const keyName = path.basename(item.file, '.js');
                console.log(`[SECRET_DECRYPT_ALL]    FAILED: ${keyName}`);
                console.log(`[SECRET_DECRYPT_ALL]   Error: ${item.error}`);
            });
        }

        process.exit(results.failed.length > 0 ? 1 : 0);
    } else {
        if (args.length < 2) {
            console.error('Error: Encrypt requires INPUT_FILE and PASSWORD');
            process.exit(1);
        }

        const [inputPath, password, outputDir] = args;
        await encryptFile(inputPath, password, outputDir);
    }
}

main().catch(console.error);