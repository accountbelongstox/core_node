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

const SECRETS_BUNDLE = {{SECRETS_DATA}};

const PASSWORD_HINT = '{{PASSWORD_HINT}}';
const TOTAL_COUNT = {{TOTAL_COUNT}};

async function deriveKey(password, salt, pepper, iterations, keyLength) {
    const pepperedPassword = Buffer.concat([
        Buffer.from(password),
        pepper
    ]);

    const key1 = crypto.pbkdf2Sync(
        pepperedPassword,
        salt,
        iterations,
        keyLength,
        'sha512'
    );

    return crypto.pbkdf2Sync(
        key1,
        salt,
        iterations / 2,
        keyLength,
        'sha512'
    );
}

function verifyHMAC(key, encrypted, authTag, hmacDigest) {
    const hmac = crypto.createHmac('sha512', key);
    hmac.update(encrypted);
    hmac.update(authTag);
    const calculatedDigest = hmac.digest();
    return crypto.timingSafeEqual(calculatedDigest, Buffer.from(hmacDigest, 'base64'));
}

function generateFakeData() {
    const fakeData = Buffer.alloc(1024);
    crypto.randomFillSync(fakeData);
    return fakeData;
}

async function decryptFile(fileEntry, password) {
    try {
        const salt = Buffer.from(fileEntry.salt, 'base64');
        const iv = Buffer.from(fileEntry.iv, 'base64');
        const authTag = Buffer.from(fileEntry.authTag, 'base64');
        const pepper = Buffer.from(fileEntry.pepper, 'base64');
        const encryptedData = Buffer.from(fileEntry.encryptedData, 'base64');

        const key = await deriveKey(
            password,
            salt,
            pepper,
            fileEntry.iterations,
            fileEntry.keyLength
        );

        const isValid = verifyHMAC(key, encryptedData, authTag, fileEntry.hmacDigest);

        let decrypted;
        try {
            const decipher = crypto.createDecipheriv(fileEntry.algorithm, key, iv);
            decipher.setAuthTag(authTag);

            decrypted = Buffer.concat([
                decipher.update(encryptedData),
                decipher.final()
            ]);

            decrypted = zlib.inflateSync(decrypted);
        } catch (err) {
            decrypted = generateFakeData();
        }

        return {
            success: true,
            data: decrypted,
            isValid: isValid
        };
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
}

async function decrypt(password, outputDir = '.', options = {}) {
    try {
        if (!password) {
            console.error('Error: Password is required');
            process.exit(1);
        }

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log('[BUNDLE_DECRYPT] Starting batch decryption...');
        console.log(`[BUNDLE_DECRYPT] Total files in bundle: ${TOTAL_COUNT}`);
        console.log('');

        let successCount = 0;
        let validCount = 0;
        let skipCount = 0;

        for (const fileEntry of SECRETS_BUNDLE) {
            const outputPath = path.join(outputDir, fileEntry.filename);

            if (fs.existsSync(outputPath) && !options.force) {
                console.log(`[BUNDLE_DECRYPT]   SKIP: ${fileEntry.filename} (already exists)`);
                skipCount++;
                continue;
            }

            console.log(`[BUNDLE_DECRYPT] Decrypting: ${fileEntry.filename}`);

            const result = await decryptFile(fileEntry, password);

            if (result.success) {
                fs.writeFileSync(outputPath, result.data);
                successCount++;

                if (result.isValid) {
                    validCount++;
                    console.log(`[BUNDLE_DECRYPT]   SUCCESS: ${fileEntry.filename}`);
                } else {
                    console.log(`[BUNDLE_DECRYPT]   WARNING: ${fileEntry.filename} (password may be incorrect)`);
                }
            } else {
                console.log(`[BUNDLE_DECRYPT]   FAILED: ${fileEntry.filename}`);
                console.log(`[BUNDLE_DECRYPT]   Error: ${result.error}`);
            }
        }

        console.log('');
        console.log('[BUNDLE_DECRYPT] ========================================');
        console.log('[BUNDLE_DECRYPT] Decryption Summary:');
        console.log(`[BUNDLE_DECRYPT]   Total files: ${TOTAL_COUNT}`);
        console.log(`[BUNDLE_DECRYPT]   Successful:  ${successCount}`);
        console.log(`[BUNDLE_DECRYPT]   Validated:   ${validCount}`);
        console.log(`[BUNDLE_DECRYPT]   Skipped:     ${skipCount}`);
        console.log(`[BUNDLE_DECRYPT]   Failed:      ${TOTAL_COUNT - successCount - skipCount}`);
        console.log(`[BUNDLE_DECRYPT]   Output dir:  ${outputDir}`);
        console.log('[BUNDLE_DECRYPT] ========================================');

        if (validCount < successCount) {
            console.log('');
            console.log('[BUNDLE_DECRYPT] WARNING: Some files may have incorrect password!');
            console.log('[BUNDLE_DECRYPT] Please verify the decrypted file contents.');
        }
    } catch (err) {
        console.error('[BUNDLE_DECRYPT] Decryption failed:', err.message);
        process.exit(1);
    }
}

function showPasswordHint() {
    console.log(`Password hint: ${PASSWORD_HINT}`);
    console.log(`Total files in bundle: ${TOTAL_COUNT}`);
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
Secrets Bundle - Batch Decryption Tool
Total files in bundle: ${TOTAL_COUNT}

Usage:
  Decrypt all files:    node ${path.basename(__filename)} pwd PASSWORD OUTPUT_DIR [--force]
  Show password hint:   node ${path.basename(__filename)} show

Examples:
  node ${path.basename(__filename)} pwd mypassword ./decrypted
  node ${path.basename(__filename)} pwd mypassword ./decrypted --force
  node ${path.basename(__filename)} show
`);
        process.exit(1);
    }

    const command = args[0];

    if (command === 'show') {
        showPasswordHint();
    } else if (command === 'pwd') {
        if (args.length < 3) {
            console.error('Error: PASSWORD and OUTPUT_DIR are required');
            console.error('Usage: node bundle.js pwd PASSWORD OUTPUT_DIR [--force]');
            process.exit(1);
        }

        const password = args[1];
        const outputDir = args[2];
        const force = args.includes('--force');

        await decrypt(password, outputDir, { force });
    } else {
        console.error(`Unknown command: ${command}`);
        console.error('Use "pwd" to decrypt or "show" to see password hint');
        process.exit(1);
    }
}

main().catch(console.error);
