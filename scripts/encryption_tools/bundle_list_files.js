// Lists the file names stored in a secrets bundle (no password needed).
// Thin CLI over secret_crypto.js.
// Usage: node bundle_list_files.js BUNDLE_PATH

const secretCrypto = require('./secret_crypto');

function main() {
    const bundlePath = process.argv[2];
    let results = [];

    if (!bundlePath) {
        console.error('Usage: node bundle_list_files.js BUNDLE_PATH');
        process.exitCode = 1;
        return;
    }
    results = secretCrypto.bundleList(bundlePath);
    console.log(`[BUNDLE_LIST] ${results.length} file(s) in ${bundlePath}`);
    for (const result of results) {
        console.log(`[BUNDLE_LIST]   ${result.name}`);
    }
}

try {
    main();
} catch (err) {
    console.error(`[BUNDLE_LIST] ${err.message}`);
    process.exitCode = 1;
}
