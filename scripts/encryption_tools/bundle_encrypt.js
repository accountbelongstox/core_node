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

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 32;
const IV_LENGTH = 12;
const ITERATIONS = 1000000;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;

function generatePepper() {
    return crypto.randomBytes(32);
}

function generatePasswordHint(password) {
    if (password.length === 1) {
        return password[0];
    }
    return password[0] + password[password.length - 1];
}

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

async function encryptFile(filePath, password) {
    const originalData = await fs.promises.readFile(filePath);
    const fileName = path.basename(filePath);

    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const pepper = generatePepper();

    const key = await deriveKey(password, salt, pepper, ITERATIONS, KEY_LENGTH);

    const compressed = zlib.deflateSync(originalData);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(compressed),
        cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    const hmac = crypto.createHmac('sha512', key);
    hmac.update(encrypted);
    hmac.update(authTag);
    const hmacDigest = hmac.digest();

    return {
        filename: fileName,
        encryptedData: encrypted.toString('base64'),
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        pepper: pepper.toString('base64'),
        hmacDigest: hmacDigest.toString('base64'),
        algorithm: ALGORITHM,
        iterations: ITERATIONS,
        keyLength: KEY_LENGTH,
        tagLength: TAG_LENGTH
    };
}

async function bundleEncrypt(inputFiles, password, outputPath) {
    console.log('[BUNDLE_ENCRYPT] Starting batch encryption...');
    console.log(`[BUNDLE_ENCRYPT] Files to encrypt: ${inputFiles.length}`);
    console.log('');

    const encryptedFiles = [];
    let successCount = 0;

    for (const filePath of inputFiles) {
        const fileName = path.basename(filePath);
        try {
            if (!fs.existsSync(filePath)) {
                console.log(`[BUNDLE_ENCRYPT]   SKIP: ${fileName} (not found)`);
                continue;
            }

            console.log(`[BUNDLE_ENCRYPT] Encrypting: ${fileName}`);
            const encrypted = await encryptFile(filePath, password);
            encryptedFiles.push(encrypted);
            successCount++;
            console.log(`[BUNDLE_ENCRYPT]   SUCCESS: ${fileName}`);
        } catch (err) {
            console.log(`[BUNDLE_ENCRYPT]   FAILED: ${fileName}`);
            console.log(`[BUNDLE_ENCRYPT]   Error: ${err.message}`);
        }
    }

    console.log('');
    console.log('[BUNDLE_ENCRYPT] Generating bundle file...');

    const passwordHint = generatePasswordHint(password);

    const templatePath = path.join(__dirname, 'bundle.template.js');
    const template = fs.readFileSync(templatePath, 'utf8');

    const bundleContent = template
        .replace('{{SECRETS_DATA}}', JSON.stringify(encryptedFiles, null, 2))
        .replace('{{PASSWORD_HINT}}', passwordHint)
        .replace('{{TOTAL_COUNT}}', encryptedFiles.length);

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, bundleContent);

    console.log('');
    console.log('[BUNDLE_ENCRYPT] ========================================');
    console.log('[BUNDLE_ENCRYPT] Encryption Summary:');
    console.log(`[BUNDLE_ENCRYPT]   Total files: ${inputFiles.length}`);
    console.log(`[BUNDLE_ENCRYPT]   Successful:  ${successCount}`);
    console.log(`[BUNDLE_ENCRYPT]   Failed:      ${inputFiles.length - successCount}`);
    console.log(`[BUNDLE_ENCRYPT]   Output file: ${outputPath}`);
    console.log('[BUNDLE_ENCRYPT] ========================================');
    console.log('');
    console.log(`To decrypt: node ${path.basename(outputPath)} pwd PASSWORD OUTPUT_DIR`);
    console.log(`To show hint: node ${path.basename(outputPath)} show`);
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 3) {
        console.error('Error: bundle_encrypt requires PASSWORD OUTPUT_FILE and at least one input file');
        console.error('Usage: node bundle_encrypt.js PASSWORD OUTPUT_FILE FILE1 [FILE2 ...]');
        console.error('');
        console.error('Example:');
        console.error('  node bundle_encrypt.js mypassword ./secrets_bundle.js file1.txt file2.txt');
        process.exit(1);
    }

    const password = args[0];
    const outputPath = args[1];
    const inputFiles = args.slice(2);

    await bundleEncrypt(inputFiles, password, outputPath);
}

main().catch(console.error);
