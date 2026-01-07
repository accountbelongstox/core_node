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

async function batchDecryptFiles(password, outputDir, encryptedFiles) {
    const results = {
        success: [],
        failed: []
    };

    for (const encryptedFile of encryptedFiles) {
        try {
            if (!fs.existsSync(encryptedFile)) {
                results.failed.push({ file: encryptedFile, error: 'File not found' });
                continue;
            }

            const encryptedFilePath = path.resolve(encryptedFile);
            const fileName = path.basename(encryptedFile);
            const originalFileName = path.basename(encryptedFile, '.js');
            const outputPath = path.join(outputDir, originalFileName);

            console.log(`[SECRET_DECRYPT_ALL] Decrypting: ${fileName} -> ${originalFileName}`);

            delete require.cache[require.resolve(encryptedFilePath)];
            const decryptModule = require(encryptedFilePath);

            if (!decryptModule || typeof decryptModule.decrypt !== 'function') {
                results.failed.push({ file: encryptedFile, error: 'Invalid encrypted file format' });
                console.log(`[SECRET_DECRYPT_ALL]    FAILED: ${originalFileName}`);
                continue;
            }

            const originalLog = console.log;
            const originalError = console.error;

            console.log = function(...args) {
                // Suppress individual file decryption output
            };
            console.error = function(...args) {
                // Suppress individual file decryption errors
            };

            try {
                await decryptModule.decrypt(password, outputDir, { force: true });

                console.log = originalLog;
                console.error = originalError;

                if (fs.existsSync(outputPath)) {
                    console.log(`[SECRET_DECRYPT_ALL]    SUCCESS: ${originalFileName}`);
                    results.success.push(encryptedFile);
                } else {
                    console.log(`[SECRET_DECRYPT_ALL]    FAILED: ${originalFileName}`);
                    results.failed.push({ file: encryptedFile, error: 'Output file not created' });
                }
            } catch (decryptErr) {
                console.log = originalLog;
                console.error = originalError;
                console.log(`[SECRET_DECRYPT_ALL]    FAILED: ${originalFileName}`);
                console.log(`[SECRET_DECRYPT_ALL]   Error: ${decryptErr.message}`);
                results.failed.push({ file: encryptedFile, error: decryptErr.message });
            }
        } catch (err) {
            const keyName = path.basename(encryptedFile, '.js');
            console.log(`[SECRET_DECRYPT_ALL]    FAILED: ${keyName}`);
            console.log(`[SECRET_DECRYPT_ALL]   Error: ${err.message}`);
            results.failed.push({ file: encryptedFile, error: err.message });
        }
    }

    return results;
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.error('Error: batch_decrypt requires PASSWORD OUTPUT_DIR and at least one encrypted file');
        console.error('Usage: node batch_decrypt.js PASSWORD OUTPUT_DIR FILE1.js [FILE2.js ...]');
        process.exit(1);
    }

    const password = args[0];
    const outputDir = args[1];
    const encryptedFiles = args.slice(2);

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const results = await batchDecryptFiles(password, outputDir, encryptedFiles);

    console.log(`\n[SECRET_DECRYPT_ALL] ========================================`);
    console.log(`[SECRET_DECRYPT_ALL] Decryption Summary:`);
    console.log(`[SECRET_DECRYPT_ALL]   Total files: ${encryptedFiles.length}`);
    console.log(`[SECRET_DECRYPT_ALL]   Successful:  ${results.success.length}`);
    console.log(`[SECRET_DECRYPT_ALL]   Failed:      ${results.failed.length}`);
    console.log(`[SECRET_DECRYPT_ALL]   Output dir:  ${outputDir}`);
    console.log(`[SECRET_DECRYPT_ALL] ========================================`);

    if (results.failed.length > 0) {
        console.log(`\n[SECRET_DECRYPT_ALL] Failed files:`);
        results.failed.forEach(item => {
            const keyName = path.basename(item.file, '.js');
            console.log(`[SECRET_DECRYPT_ALL]    FAILED: ${keyName}`);
            console.log(`[SECRET_DECRYPT_ALL]   Error: ${item.error}`);
        });
    }

    process.exit(results.failed.length > 0 ? 1 : 0);
}

main().catch(console.error);

