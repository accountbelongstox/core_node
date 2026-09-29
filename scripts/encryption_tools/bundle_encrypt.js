// Creates a new secrets bundle from files with one password (parallel key derivation).
// Thin CLI over secret_crypto.js.
// Usage: node bundle_encrypt.js PASSWORD OUTPUT_FILE FILE1 [FILE2 ...]

const secretCrypto = require('./secret_crypto');

async function main() {
    const [password, outputPath, ...files] = process.argv.slice(2);
    let results = [];

    if (!password || !outputPath || files.length === 0) {
        console.error('Usage: node bundle_encrypt.js PASSWORD OUTPUT_FILE FILE1 [FILE2 ...]');
        process.exitCode = 1;
        return;
    }
    results = await secretCrypto.bundleAddFiles(password, outputPath, files, { fresh: true });
    console.log(`[BUNDLE_ENCRYPT] ${results.filter((result) => result.status === secretCrypto.STATUS.ENCRYPTED).length}/${files.length} file(s) -> ${outputPath}`);
    secretCrypto.printResults(results);
    process.exitCode = secretCrypto.hasFailure(results) ? 1 : 0;
}

main().catch((err) => {
    console.error(`[BUNDLE_ENCRYPT] ${err.message}`);
    process.exitCode = 1;
});
