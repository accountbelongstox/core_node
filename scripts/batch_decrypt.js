// Decrypts many encrypted secret files with one password in one process.
// Thin CLI over encryption_tools/secret_crypto.js: parallel key derivation, and a
// wrong password writes nothing (reported per file).
// Usage: node batch_decrypt.js PASSWORD OUTPUT_DIR FILE_OR_DIR...

const secretCrypto = require('./encryption_tools/secret_crypto');

const LOG_PREFIX = '[SECRET_DECRYPT_ALL]';

async function main() {
    const [password, outputDir, ...sources] = process.argv.slice(2);
    let results = [];
    let failed = [];

    if (!password || !outputDir || sources.length === 0) {
        console.error('Usage: node batch_decrypt.js PASSWORD OUTPUT_DIR FILE_OR_DIR...');
        process.exitCode = 1;
        return;
    }
    results = await secretCrypto.decryptSources(password, outputDir, sources, { force: true });
    failed = results.filter((result) => result.status !== secretCrypto.STATUS.DECRYPTED);
    for (const result of results) {
        console.log(`${LOG_PREFIX}    ${result.status.toUpperCase()}: ${result.name}${result.error ? ` (${result.error})` : ''}`);
    }
    console.log(`${LOG_PREFIX} Decryption Summary: ${results.length} total, ${results.length - failed.length} successful, ${failed.length} failed, output ${outputDir}`);
    secretCrypto.printResults(results);
    process.exitCode = failed.length > 0 ? 1 : 0;
}

main().catch((err) => {
    console.error(`${LOG_PREFIX} ${err.message}`);
    process.exitCode = 1;
});
