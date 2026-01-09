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

function extractEncryptedData(jsFilePath) {
    try {
        const content = fs.readFileSync(jsFilePath, 'utf8');

        const encryptedDataMatch = content.match(/const ENCRYPTED_DATA = Buffer\.from\('([^']+)',\s*'base64'\);/);
        const obfuscatedParamsMatch = content.match(/const OBFUSCATED_PARAMS = Buffer\.from\('([^']+)',\s*'base64'\);/);
        const paramsKeyMatch = content.match(/const PARAMS_KEY = Buffer\.from\('([^']+)',\s*'base64'\);/);
        const paramsIVMatch = content.match(/const PARAMS_IV = Buffer\.from\('([^']+)',\s*'base64'\);/);
        const filenameMatch = content.match(/const ORIGINAL_FILENAME = '([^']+)';/);

        if (!encryptedDataMatch || !obfuscatedParamsMatch || !paramsKeyMatch || !paramsIVMatch || !filenameMatch) {
            throw new Error('Invalid encrypted file format');
        }

        const paramsKey = Buffer.from(paramsKeyMatch[1], 'base64');
        const paramsIV = Buffer.from(paramsIVMatch[1], 'base64');
        const obfuscatedParams = Buffer.from(obfuscatedParamsMatch[1], 'base64');

        const decipher = crypto.createDecipheriv('aes-256-cbc', paramsKey, paramsIV);
        const decrypted = Buffer.concat([
            decipher.update(obfuscatedParams),
            decipher.final()
        ]);
        const params = JSON.parse(decrypted.toString());

        return {
            filename: filenameMatch[1],
            encryptedData: encryptedDataMatch[1],
            salt: params.salt,
            iv: params.iv,
            authTag: params.authTag,
            pepper: params.pepper,
            hmacDigest: params.hmacDigest,
            algorithm: params.algorithm,
            iterations: params.iterations,
            keyLength: params.keyLength,
            tagLength: params.tagLength
        };
    } catch (err) {
        throw new Error(`Failed to extract data from ${path.basename(jsFilePath)}: ${err.message}`);
    }
}

function generatePasswordHint(password) {
    if (password.length === 1) {
        return password[0];
    }
    return password[0] + password[password.length - 1];
}

async function migrateToBundle(encryptedDir, password, outputPath) {
    console.log('[MIGRATE_TO_BUNDLE] Starting migration...');
    console.log(`[MIGRATE_TO_BUNDLE] Source directory: ${encryptedDir}`);
    console.log('');

    if (!fs.existsSync(encryptedDir)) {
        console.error(`[MIGRATE_TO_BUNDLE] Error: Directory not found: ${encryptedDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(encryptedDir).filter(f => f.endsWith('.js'));

    console.log(`[MIGRATE_TO_BUNDLE] Found ${files.length} encrypted files`);
    console.log('');

    const bundleData = [];
    let successCount = 0;

    for (const file of files) {
        const filePath = path.join(encryptedDir, file);
        console.log(`[MIGRATE_TO_BUNDLE] Processing: ${file}`);

        try {
            const data = extractEncryptedData(filePath);
            bundleData.push(data);
            successCount++;
            console.log(`[MIGRATE_TO_BUNDLE]   SUCCESS: ${data.filename}`);
        } catch (err) {
            console.log(`[MIGRATE_TO_BUNDLE]   FAILED: ${file}`);
            console.log(`[MIGRATE_TO_BUNDLE]   Error: ${err.message}`);
        }
    }

    console.log('');
    console.log('[MIGRATE_TO_BUNDLE] Generating bundle file...');

    const passwordHint = generatePasswordHint(password);

    const templatePath = path.join(__dirname, 'bundle.template.js');
    const template = fs.readFileSync(templatePath, 'utf8');

    const bundleContent = template
        .replace('{{SECRETS_DATA}}', JSON.stringify(bundleData, null, 2))
        .replace('{{PASSWORD_HINT}}', passwordHint)
        .replace('{{TOTAL_COUNT}}', bundleData.length);

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, bundleContent);

    console.log('');
    console.log('[MIGRATE_TO_BUNDLE] ========================================');
    console.log('[MIGRATE_TO_BUNDLE] Migration Summary:');
    console.log(`[MIGRATE_TO_BUNDLE]   Total files: ${files.length}`);
    console.log(`[MIGRATE_TO_BUNDLE]   Successful:  ${successCount}`);
    console.log(`[MIGRATE_TO_BUNDLE]   Failed:      ${files.length - successCount}`);
    console.log(`[MIGRATE_TO_BUNDLE]   Output file: ${outputPath}`);
    console.log('[MIGRATE_TO_BUNDLE] ========================================');
    console.log('');
    console.log(`To decrypt: node ${path.basename(outputPath)} pwd PASSWORD OUTPUT_DIR`);
    console.log(`To show hint: node ${path.basename(outputPath)} show`);
    console.log('');
    console.log('[MIGRATE_TO_BUNDLE] NOTE: Original encrypted files are preserved.');
    console.log('[MIGRATE_TO_BUNDLE] You can safely delete them after verifying the bundle works.');
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 3) {
        console.error('Error: migrate_to_bundle requires ENCRYPTED_DIR PASSWORD OUTPUT_FILE');
        console.error('Usage: node migrate_to_bundle.js ENCRYPTED_DIR PASSWORD OUTPUT_FILE');
        console.error('');
        console.error('Example:');
        console.error('  node migrate_to_bundle.js ./.secret_keys/already_encrypted mypassword ./secrets_bundle.js');
        console.error('');
        console.error('This tool migrates existing individual encrypted .js files to a single bundle file.');
        process.exit(1);
    }

    const encryptedDir = args[0];
    const password = args[1];
    const outputPath = args[2];

    await migrateToBundle(encryptedDir, password, outputPath);
}

main().catch(console.error);
