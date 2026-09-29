// Encrypts files into self-decrypting <NAME>.js files (scripts/disguised.template.js).
// Thin CLI over encryption_tools/secret_crypto.js; several inputs share one password
// and derive their keys in parallel.
// Usage: node disguise.js INPUT_FILE PASSWORD [OUTPUT_DIR]
//        node disguise.js --batch PASSWORD OUTPUT_DIR INPUT_FILE...

const path = require('path');
const secretCrypto = require('./encryption_tools/secret_crypto');

const BATCH_FLAG = '--batch';

async function main() {
    const args = process.argv.slice(2);
    let password = '';
    let outputDir = '';
    let inputs = [];
    let results = [];

    if (args[0] === BATCH_FLAG) {
        [, password, outputDir, ...inputs] = args;
    } else {
        [inputs[0], password, outputDir] = args;
        outputDir = outputDir || (inputs[0] ? path.dirname(inputs[0]) : '');
    }
    if (!password || !outputDir || inputs.length === 0 || !inputs[0]) {
        console.log('Usage: node disguise.js INPUT_FILE PASSWORD [OUTPUT_DIR]');
        console.log('       node disguise.js --batch PASSWORD OUTPUT_DIR INPUT_FILE...');
        process.exitCode = 1;
        return;
    }
    results = await secretCrypto.encryptFiles(password, outputDir, inputs);
    for (const result of results) {
        if (result.status === secretCrypto.STATUS.ENCRYPTED) {
            console.log(`File encrypted: ${path.join(outputDir, `${result.name}.js`)}`);
        } else {
            console.error(`Encryption failed: ${result.name}: ${result.error || result.status}`);
        }
    }
    process.exitCode = secretCrypto.hasFailure(results) ? 1 : 0;
}

main().catch((err) => {
    console.error('Encryption failed:', err.message);
    process.exitCode = 1;
});
