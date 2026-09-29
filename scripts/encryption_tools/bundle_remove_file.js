// Removes files from a secrets bundle (no password needed); the bundle is written once.
// Thin CLI over secret_crypto.js.
// Usage: node bundle_remove_file.js BUNDLE_PATH FILE_NAME...

const secretCrypto = require('./secret_crypto');

function main() {
    const [bundlePath, ...names] = process.argv.slice(2);
    let results = [];

    if (!bundlePath || names.length === 0) {
        console.error('Usage: node bundle_remove_file.js BUNDLE_PATH FILE_NAME...');
        process.exitCode = 1;
        return;
    }
    results = secretCrypto.bundleRemove(bundlePath, names);
    for (const result of results) {
        console.log(`[BUNDLE_REMOVE] ${result.status === secretCrypto.STATUS.REMOVED ? 'SUCCESS' : 'NOT FOUND'}: ${result.name}`);
    }
    process.exitCode = secretCrypto.hasFailure(results) ? 1 : 0;
}

try {
    main();
} catch (err) {
    console.error(`[BUNDLE_REMOVE] ${err.message}`);
    process.exitCode = 1;
}
