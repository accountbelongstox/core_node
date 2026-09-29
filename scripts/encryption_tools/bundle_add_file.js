// Adds (or with --replace, replaces) files in a secrets bundle with one password.
// Thin CLI over secret_crypto.js: all files encrypt in parallel, the bundle is written once.
// Usage: node bundle_add_file.js BUNDLE_PATH NEW_FILE... PASSWORD [--replace]

const secretCrypto = require('./secret_crypto');

const REPLACE_FLAG = '--replace';

async function main() {
    const args = process.argv.slice(2).filter((arg) => arg !== REPLACE_FLAG);
    const replace = process.argv.includes(REPLACE_FLAG);
    const bundlePath = args[0];
    const password = args[args.length - 1];
    const files = args.slice(1, -1);
    let results = [];

    if (!bundlePath || files.length === 0 || !password) {
        console.error('Usage: node bundle_add_file.js BUNDLE_PATH NEW_FILE... PASSWORD [--replace]');
        process.exitCode = 1;
        return;
    }
    results = await secretCrypto.bundleAddFiles(password, bundlePath, files, { replace });
    for (const result of results) {
        console.log(`[BUNDLE_ADD] ${result.status === secretCrypto.STATUS.ENCRYPTED ? 'SUCCESS' : 'FAILED'}: ${result.name} (${result.status})`);
    }
    secretCrypto.printResults(results);
    process.exitCode = secretCrypto.hasFailure(results) ? 1 : 0;
}

main().catch((err) => {
    console.error(`[BUNDLE_ADD] ${err.message}`);
    process.exitCode = 1;
});
