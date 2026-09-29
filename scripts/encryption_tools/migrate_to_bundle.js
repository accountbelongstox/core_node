// Migrates single encrypted files into one secrets bundle with the same password:
// decrypted in memory (never written), re-encrypted in parallel, bundle written once.
// Thin CLI over secret_crypto.js.
// Usage: node migrate_to_bundle.js ENCRYPTED_DIR PASSWORD OUTPUT_FILE

const secretCrypto = require('./secret_crypto');

async function main() {
    const [encryptedDir, password, outputPath] = process.argv.slice(2);
    let results = [];

    if (!encryptedDir || !password || !outputPath) {
        console.error('Usage: node migrate_to_bundle.js ENCRYPTED_DIR PASSWORD OUTPUT_FILE');
        process.exitCode = 1;
        return;
    }
    results = await secretCrypto.migrateToBundle(password, outputPath, [encryptedDir]);
    console.log(`[MIGRATE] ${results.filter((result) => result.status === secretCrypto.STATUS.ENCRYPTED).length}/${results.length} file(s) -> ${outputPath}`);
    secretCrypto.printResults(results);
    process.exitCode = secretCrypto.hasFailure(results) ? 1 : 0;
}

main().catch((err) => {
    console.error(`[MIGRATE] ${err.message}`);
    process.exitCode = 1;
});
