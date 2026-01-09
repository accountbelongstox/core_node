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

function loadBundleData(bundlePath) {
    try {
        const content = fs.readFileSync(bundlePath, 'utf8');
        const dataMatch = content.match(/const SECRETS_BUNDLE = (\[[\s\S]*?\]);/);
        const hintMatch = content.match(/const PASSWORD_HINT = '([^']*)';/);
        const countMatch = content.match(/const TOTAL_COUNT = (\d+);/);

        if (!dataMatch) {
            throw new Error('Invalid bundle format: SECRETS_BUNDLE not found');
        }

        const bundleData = JSON.parse(dataMatch[1]);
        const passwordHint = hintMatch ? hintMatch[1] : '';
        const totalCount = countMatch ? parseInt(countMatch[1]) : bundleData.length;

        return { bundleData, passwordHint, totalCount };
    } catch (err) {
        throw new Error(`Failed to load bundle: ${err.message}`);
    }
}

function listBundleFiles(bundlePath) {
    console.log('');
    console.log('[BUNDLE_LIST] ========================================');
    console.log('[BUNDLE_LIST] Bundle File Contents');
    console.log('[BUNDLE_LIST] ========================================');
    console.log('');

    if (!fs.existsSync(bundlePath)) {
        console.error(`[BUNDLE_LIST] Error: Bundle not found: ${bundlePath}`);
        process.exit(1);
    }

    const { bundleData, passwordHint, totalCount } = loadBundleData(bundlePath);

    console.log(`[BUNDLE_LIST] Bundle: ${path.basename(bundlePath)}`);
    console.log(`[BUNDLE_LIST] Full path: ${bundlePath}`);
    console.log(`[BUNDLE_LIST] Password hint: ${passwordHint}`);
    console.log(`[BUNDLE_LIST] Total files: ${totalCount}`);
    console.log('');
    console.log('[BUNDLE_LIST] Files in bundle:');
    console.log('');

    bundleData.forEach((entry, index) => {
        const encryptedSize = Buffer.from(entry.encryptedData, 'base64').length;
        const sizeMB = (encryptedSize / 1024 / 1024).toFixed(2);
        const sizeKB = (encryptedSize / 1024).toFixed(2);
        const displaySize = encryptedSize > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

        console.log(`[BUNDLE_LIST]   ${(index + 1).toString().padStart(3, ' ')}. ${entry.filename}`);
        console.log(`[BUNDLE_LIST]        Algorithm: ${entry.algorithm}`);
        console.log(`[BUNDLE_LIST]        Iterations: ${entry.iterations.toLocaleString()}`);
        console.log(`[BUNDLE_LIST]        Encrypted size: ${displaySize}`);
        console.log('');
    });

    console.log('[BUNDLE_LIST] ========================================');
    console.log('');
}

function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.error('Error: bundle_list_files requires BUNDLE_PATH');
        console.error('Usage: node bundle_list_files.js BUNDLE_PATH');
        console.error('');
        console.error('Example:');
        console.error('  node bundle_list_files.js ./secrets_bundle.js');
        process.exit(1);
    }

    const bundlePath = args[0];

    listBundleFiles(bundlePath);
}

main();
