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

// disguised.template.js
// This is a template for encrypted files - DO NOT MODIFY

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

// Embedded encrypted data and parameters
const ENCRYPTED_DATA = Buffer.from('6kKQqRdfH+6Sot71XNfToSMofIAOm6YsEXm0S4EDMPcU0sDmJVgh9zJUrtMRdAHm0bmMNIryq0Jw+rSZI/zg0q2gGSHWONbabH5vZXH8JnBbzfs1dzmwIBoXNkpE+tn6z+2qE0mfjPQ7hVTqMxxWSY5TX+pROOOPi1RKDdYXFro3Zs/pm8jhwCxoUNJSk+9WuEsfdECh3Stbc4FD5TmQcyB5h8FvYXxCnRyAqTsj7Ps3oo1G2a0u3eJ+cQYflTE4Ua+n3AM/LyRWEMIY2Dov4EGXw7IFd3htJJxgGKZQf9FhnPYTYHieNpDWxPD6FmA3GU+lhfU3P2F+Nf0bUEJNQoZRsfqdV9CzAmx0dOJ53FSToSxDrf+PR7Givnhwf2K67+pcjSEsgclZCn/k/NVrIImuyIvQkeqvwdODpbfUgjWrliyUxyKf81dfAsVi3kT7FRYhc1U5ak0n0aUbxE/NbNb1q65z99lmutVbNyFL8pF8FZFqhHedyRR5mXs73B6ZXp1XQe4CnyTaJmglE3TSVYMujfBmXbOI4SadSHTarRL+fwTBDLcUaReL7QaV4HPWiDDrNtt+52kql/MP2utFncBBpCX5qoJKKwijVNOJlwPsJdbETSzrxz4jPmKT9z6FbuPrjMNImJ/SNThahkixrjM4rV/aiFuzxNSB/ixmJa/E8EoF7juB53rnhl6xn4Jkk8okCNju02q1n5s4bpqB1lRaS9Y9QGttG3POkJhkTLl+1vF9240YWhFhaTKEbbHJbN6Epb3xwZ5Y8aNcQuo50RDKxyiBXkwSEEWmaolO2CJR7FPop1rB/r80TneNTnzoMB/rfRVLUBGHZufdvPC/tJiq2Dk0qiKo2kmDVxQkcAPSEbHjhdWznV6p0PMAVmsxLJ7crQ3Rvi39uzptssTgjje1NGl20Tk3nPwv3h5E+NsnRRpZ8r3bW16WYBN8Z0QqfEGgMcNtbZxSP0NiTSnUdEwSufqnYm7iHJvlwd1WVziKEyvn77szU79qHcRZROj3WUG1l6r1LvC7zhyqLkqlDum6m5gCAPduQdoFPKs0NkV3qugNcjOQVjSFW3NHF/+U2dYXBcAdufzrsNSVhpZBVYS+L3gRECP4prHvnTyuRH1iRzCIz4U6CYTIAEOM/PWicR11PLbHIAPKq9P9bfEdyH5ftNNoKEUWYEq9ZdhQ1tmE1yy1U2zVIOWfq7RzYEdJBDD9/bHo4ehUGzAegdZcBhC+RwJ7llnCYpDl5iOD4Cl7CNieEBWoMUzGYJ+7ws45gkDDpIsf35sMfnhWitMLKMk2CIidfyH47Mm6sITzPfMcEX6/3XeLjU6390Jg3Uwomh2rOTO14f9O93XiB4/PzWgkHlG8RNFB11G0', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('D1vnehdAa+9YjGvATeDkUWdvs05PCAFLnnNbbvyK4Mn1fXUoi13Db0u5FDCUJBvsds6i9qHDR32OKLVSWqTAJGUjsxOhkFdOeueiAiBZbO7HM5kuhH0wqMnMLQSjHmBTJ5jnboDWj7Juoa7rceqEissdhqUOoL7qO9vO2FrJiB7NrmphAC1EfwAW5n0taE+EDMRbplUlVVblKDId7iLYmjw/OQRD6Dp1xXI3OS3FYaFUQtQEVH+TWIUwPufmF+VBrPxnzGhb7AavNaDEc9M5KhcV8ZdUtys/3ARGDlGysd2OU968Ewytk9B5sb4Nip5lkGMz7GJhZ1OAE2FBtn3SlAeAngnADn+kb91U01gIS+jR9oDsqGndWutIWlYUWQFx3Vl17q6pXAA81Ks/EHHhxuUINniBzetsvegzHpEuBMtG/9KFfWBuYOc/cJjvj19wJO/1ifLUqvDLDjcQ8GLO6JPxpMRzFr94l0weIcFFDWNvLethoQQvV59pdS7IJ/Dz', 'base64');
const PARAMS_KEY = Buffer.from('tFGW9UMIlPQ9Id+Xh0OF6ywshdOzd+OLkxBKI5V5rGo=', 'base64');
const PARAMS_IV = Buffer.from('aNv9Q1PUim9latZ0xxu/kw==', 'base64');
const ORIGINAL_FILENAME = 'ANTHROPIC_BASE_URL_6';

// Function to deobfuscate parameters
function deobfuscateParams() {
    const decipher = crypto.createDecipheriv('aes-256-cbc', PARAMS_KEY, PARAMS_IV);
    const decrypted = Buffer.concat([
        decipher.update(OBFUSCATED_PARAMS),
        decipher.final()
    ]);
    return JSON.parse(decrypted.toString());
}

// Function to derive key with pepper
async function deriveKey(password, salt, pepper, params) {
    // Combine password with pepper
    const pepperedPassword = Buffer.concat([
        Buffer.from(password),
        pepper
    ]);
    
    // First round of key derivation
    const key1 = crypto.pbkdf2Sync(
        pepperedPassword,
        salt,
        params.iterations,
        params.keyLength,
        'sha512'
    );
    
    // Second round of key derivation using the first key as salt
    return crypto.pbkdf2Sync(
        key1,
        salt,
        params.iterations / 2,
        params.keyLength,
        'sha512'
    );
}

// Function to verify HMAC
function verifyHMAC(key, encrypted, authTag, params) {
    const hmac = crypto.createHmac('sha512', key);
    hmac.update(encrypted);
    hmac.update(authTag);
    const calculatedDigest = hmac.digest();
    return crypto.timingSafeEqual(calculatedDigest, Buffer.from(params.hmacDigest, 'base64'));
}

// Function to generate fake data
function generateFakeData() {
    const fakeData = Buffer.alloc(1024); // 1KB of random data
    crypto.randomFillSync(fakeData);
    return fakeData;
}

async function decrypt(password, outputDir = '.', options = {}) {
    try {
        // Validate password
        if (!password) {
            console.error('Error: Password is required');
            process.exit(1);
        }

        // Deobfuscate parameters
        const params = deobfuscateParams();
        
        // Convert string parameters to buffers
        const salt = Buffer.from(params.salt, 'base64');
        const iv = Buffer.from(params.iv, 'base64');
        const authTag = Buffer.from(params.authTag, 'base64');
        const pepper = Buffer.from(params.pepper, 'base64');

        // Derive key with pepper
        const key = await deriveKey(password, salt, pepper, params);

        // Verify HMAC before decryption
        const isValid = verifyHMAC(key, ENCRYPTED_DATA, authTag, params);
        
        let decrypted;
        try {
            // Decrypt data
            const decipher = crypto.createDecipheriv(params.algorithm, key, iv);
            decipher.setAuthTag(authTag);
            
            decrypted = Buffer.concat([
                decipher.update(ENCRYPTED_DATA),
                decipher.final()
            ]);
            
            // Decompress data
            decrypted = zlib.inflateSync(decrypted);
        } catch (err) {
            // If decryption fails, use fake data
            decrypted = generateFakeData();
        }
        
        // Prepare output path
        const outputPath = path.join(outputDir, ORIGINAL_FILENAME);
        
        // Check if file already exists
        if (fs.existsSync(outputPath)) {
            if (!options.force) {
                console.log(`Skipping: File already exists (${outputPath})`);
                console.log('Use --force to overwrite existing file');
                return outputPath;
            }
        }
        
        // Write decrypted file
        fs.writeFileSync(outputPath, decrypted);
        
        if (isValid) {
            console.log(`File decrypted successfully to: ${outputPath}`);
            console.log('Note: Always verify the decrypted file content to ensure the password is correct.');
        } else {
            console.log(`File written to: ${outputPath}`);
            console.log('Warning: The password may be incorrect. Please verify the file content.');
        }
        
        return outputPath;
    } catch (err) {
        console.error('Decryption failed:', err.message);
        process.exit(1);
    }
}

// Function to show password hint
function showPasswordHint() {
    try {
        const params = deobfuscateParams();
        console.log(`Password hint: ${params.passwordHint}`);
    } catch (err) {
        console.error('Failed to show password hint:', err.message);
        process.exit(1);
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (!command) {
        console.log(`
Usage: node ${path.basename(__filename)} [COMMAND] [ARGUMENTS]

Commands:
  show                    Show password hint
  pwd [PASSWORD] [OUTPUT_DIR] Decrypt file

Options:
  --force                 Overwrite existing file

Examples:
  Show hint: node ${path.basename(__filename)} show
  Decrypt: node ${path.basename(__filename)} pwd mypassword ./output
  Force overwrite: node ${path.basename(__filename)} pwd mypassword ./output --force
`);
        process.exit(1);
    }
    
    if (command === 'show') {
        showPasswordHint();
    } else if (command === 'pwd') {
        const password = args[1];
        const outputDir = args[2] || '.';
        const options = {
            force: args.includes('--force')
        };
        if (!password) {
            console.error('Error: Password is required after pwd command');
            process.exit(1);
        }
        decrypt(password, outputDir, options).catch(err => {
            console.error('Decryption failed:', err.message);
            process.exit(1);
        });
    } else {
        console.error('Invalid command. Use "show" or "pwd"');
        process.exit(1);
    }
}

module.exports = { decrypt, showPasswordHint };