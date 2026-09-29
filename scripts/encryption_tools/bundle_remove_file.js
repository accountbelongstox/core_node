const fs = require('fs');
const path = require('path');

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

function removeFileFromBundle(bundlePath, fileNameToRemove) {
    console.log('[BUNDLE_REMOVE] Starting remove file operation...');
    console.log(`[BUNDLE_REMOVE] Bundle: ${path.basename(bundlePath)}`);
    console.log(`[BUNDLE_REMOVE] File to remove: ${fileNameToRemove}`);
    console.log('');

    if (!fs.existsSync(bundlePath)) {
        console.error(`[BUNDLE_REMOVE] Error: Bundle not found: ${bundlePath}`);
        process.exit(1);
    }

    const { bundleData, passwordHint } = loadBundleData(bundlePath);

    const initialCount = bundleData.length;
    const existingIndex = bundleData.findIndex(entry => entry.filename === fileNameToRemove);

    if (existingIndex < 0) {
        console.error(`[BUNDLE_REMOVE] Error: File not found in bundle: ${fileNameToRemove}`);
        console.log('');
        console.log('[BUNDLE_REMOVE] Available files in bundle:');
        bundleData.forEach((entry, index) => {
            console.log(`[BUNDLE_REMOVE]   ${index + 1}. ${entry.filename}`);
        });
        console.log('');
        process.exit(1);
    }

    console.log(`[BUNDLE_REMOVE] Found file at index ${existingIndex + 1} of ${initialCount}`);
    bundleData.splice(existingIndex, 1);
    console.log(`[BUNDLE_REMOVE]   REMOVED`);
    console.log('');

    console.log('[BUNDLE_REMOVE] Updating bundle file...');
    saveBundleData(bundlePath, bundleData, passwordHint);
    console.log('[BUNDLE_REMOVE]   SUCCESS');
    console.log('');

    console.log('[BUNDLE_REMOVE] ========================================');
    console.log('[BUNDLE_REMOVE] Operation Summary:');
    console.log(`[BUNDLE_REMOVE]   Action: Remove`);
    console.log(`[BUNDLE_REMOVE]   File: ${fileNameToRemove}`);
    console.log(`[BUNDLE_REMOVE]   Files before: ${initialCount}`);
    console.log(`[BUNDLE_REMOVE]   Files after: ${bundleData.length}`);
    console.log(`[BUNDLE_REMOVE]   Bundle: ${bundlePath}`);
    console.log('[BUNDLE_REMOVE] ========================================');
    console.log('');
}

function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Error: bundle_remove_file requires BUNDLE_PATH FILE_NAME');
        console.error('Usage: node bundle_remove_file.js BUNDLE_PATH FILE_NAME');
        console.error('');
        console.error('Example:');
        console.error('  node bundle_remove_file.js ./secrets_bundle.js API_KEY_1');
        console.error('');
        console.error('Note: FILE_NAME should be the filename without path (e.g., "API_KEY_1" not "/path/to/API_KEY_1")');
        process.exit(1);
    }

    const bundlePath = args[0];
    const fileNameToRemove = args[1];

    removeFileFromBundle(bundlePath, fileNameToRemove);
}

main();
