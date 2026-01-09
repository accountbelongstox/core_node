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

function loadBundleData(bundlePath) {
    try {
        const content = fs.readFileSync(bundlePath, 'utf8');
        const dataMatch = content.match(/const SECRETS_BUNDLE = (\[[\s\S]*?\]);/);
        const hintMatch = content.match(/const PASSWORD_HINT = '([^']*)';/);

        if (!dataMatch) {
            throw new Error('Invalid bundle format: SECRETS_BUNDLE not found');
        }

        const bundleData = JSON.parse(dataMatch[1]);
        const passwordHint = hintMatch ? hintMatch[1] : '';

        return { bundleData, passwordHint };
    } catch (err) {
        throw new Error(`Failed to load bundle: ${err.message}`);
    }
}

function saveBundleData(bundlePath, bundleData, passwordHint) {
    const templatePath = path.join(__dirname, 'bundle.template.js');
    const template = fs.readFileSync(templatePath, 'utf8');

    const bundleContent = template
        .replace('{{SECRETS_DATA}}', JSON.stringify(bundleData, null, 2))
        .replace('{{PASSWORD_HINT}}', passwordHint)
        .replace('{{TOTAL_COUNT}}', bundleData.length);

    fs.writeFileSync(bundlePath, bundleContent);
}

async function addFileToBundle(bundlePath, newFilePath, password, replaceIfExists = false) {
    console.log('[BUNDLE_ADD] Starting add file operation...');
    console.log(`[BUNDLE_ADD] Bundle: ${path.basename(bundlePath)}`);
    console.log(`[BUNDLE_ADD] New file: ${path.basename(newFilePath)}`);
    console.log('');

    if (!fs.existsSync(bundlePath)) {
        console.error(`[BUNDLE_ADD] Error: Bundle not found: ${bundlePath}`);
        process.exit(1);
    }

    if (!fs.existsSync(newFilePath)) {
        console.error(`[BUNDLE_ADD] Error: File not found: ${newFilePath}`);
        process.exit(1);
    }

    const { bundleData, passwordHint: existingHint } = loadBundleData(bundlePath);
    const newFileName = path.basename(newFilePath);

    const existingIndex = bundleData.findIndex(entry => entry.filename === newFileName);

    if (existingIndex >= 0) {
        if (!replaceIfExists) {
            console.error(`[BUNDLE_ADD] Error: File already exists in bundle: ${newFileName}`);
            console.error(`[BUNDLE_ADD] Use --replace flag to replace the existing file`);
            process.exit(1);
        }
        console.log(`[BUNDLE_ADD] Replacing existing file: ${newFileName}`);
    } else {
        console.log(`[BUNDLE_ADD] Adding new file: ${newFileName}`);
    }

    console.log(`[BUNDLE_ADD] Encrypting file...`);
    const encryptedEntry = await encryptFile(newFilePath, password);
    console.log(`[BUNDLE_ADD]   SUCCESS`);
    console.log('');

    if (existingIndex >= 0) {
        bundleData[existingIndex] = encryptedEntry;
    } else {
        bundleData.push(encryptedEntry);
    }

    const newPasswordHint = generatePasswordHint(password);

    console.log('[BUNDLE_ADD] Updating bundle file...');
    saveBundleData(bundlePath, bundleData, newPasswordHint);
    console.log('[BUNDLE_ADD]   SUCCESS');
    console.log('');

    console.log('[BUNDLE_ADD] ========================================');
    console.log('[BUNDLE_ADD] Operation Summary:');
    console.log(`[BUNDLE_ADD]   Action: ${existingIndex >= 0 ? 'Replace' : 'Add'}`);
    console.log(`[BUNDLE_ADD]   File: ${newFileName}`);
    console.log(`[BUNDLE_ADD]   Total files in bundle: ${bundleData.length}`);
    console.log(`[BUNDLE_ADD]   Bundle: ${bundlePath}`);
    console.log('[BUNDLE_ADD] ========================================');
    console.log('');
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 3) {
        console.error('Error: bundle_add_file requires BUNDLE_PATH NEW_FILE PASSWORD [--replace]');
        console.error('Usage: node bundle_add_file.js BUNDLE_PATH NEW_FILE PASSWORD [--replace]');
        console.error('');
        console.error('Example:');
        console.error('  node bundle_add_file.js ./secrets_bundle.js ./new_key.txt mypassword');
        console.error('  node bundle_add_file.js ./secrets_bundle.js ./api_key.txt mypassword --replace');
        console.error('');
        console.error('Options:');
        console.error('  --replace    Replace existing file if it already exists in bundle');
        process.exit(1);
    }

    const bundlePath = args[0];
    const newFilePath = args[1];
    const password = args[2];
    const replaceIfExists = args.includes('--replace');

    await addFileToBundle(bundlePath, newFilePath, password, replaceIfExists);
}

main().catch(console.error);
