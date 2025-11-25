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
const ENCRYPTED_DATA = Buffer.from('SoxcuiGp1AfrMr4uFJCKrNBTLsMP0PKIVUVSC08Ptx9C25ZC2W5bHIMSSVIaES6rkpygGVIFqD6HxTIkLg90JQ4diUj/xujnc/MbTbjew9/E3QGO7NuX3POtAVp4uRk6rNZsB86N0F2MIlSIq0XjIXEii2BwPTf8g9uyPVoqc0voAYi5p6e7tzieJnMh0oIq7COT6f1SKGdpFArlB/fzzL7rVK64n+u3WsU8LNroKSinCUOh35FMcYdmQqOzpYXjQSuwEAc21dG4zekwnPo8ihpNXa5I3/GoPYz01uQK1wN0W3c8mPtnW9lLHcZJ/3X8Ox+2yAbKKgMTSQXpYtjPwvEZ8q5sPG2N6sK6ei4uIRLfg7Jhz6WRWB8ONbVs0A3ldoBg5+Ut9km5c1xsOAufX9r0NWVuiJabI1MW6Bd/vCWzLYtlXP5lBta5xU4sVAea1pFQz+tGLTAo7pYhVo/DxnngypP5juZWfQWRuz69Txnrk2YCvpWv7j/o3sYD2L8ZPH62m71QXzokUV2WVYTFj70kQWFOo2Ve/aoBcv7TYbH9eS+Qmv3a/MqFTLhx/ZZrBPREtuKfLbTON08h7oB7RaSrPWKkYXKHWYj0PrJbJST2Uej8Bb8fjL1u3of5KU3AKbM6rMCGFOJJHL51NUYmv2/7rRg4hr7Z2f72TYQE6RSREAZolkOxmQLLUQHZGJbX37gjHPRemO2bRkgchtfK7EJSV5t6OBtYK88pn/EziB5ShZ8g5nTcBL/xbydsgjJU/lEL5qbYvXwz45gl4gZkU6U+zUA2Tj6uN3h2gMxhrEocXrkUNRYDicETV4LFeXzy9WhWRbnw85ykNkBCxTnmfElx6WxpmQM92mvGS7NCuEuNg9eLVuq7xCbIUTIYL1Cnqb5D8sYySohwXVfUS+l81eBHq2YGFaVQt870DSI0A4N6dtQsaA+Zu2vQ/t0AJSCv8Of2uLQFGbhYtbgw9FyaW2G+63xp73F6Qc6QKOV7JHd4f+CfUydd2BQvJbKfNerdZVALpOSVtn7xhtLcv/gc6EGvgMMlR1bg63a4VY7LdA4fKwg1S67woTi+bQJnvCMWCNM/5T3Ebc3pR4K0MCuhNhAJoa0XECt7FAX0ioI938FbCxpRNP8qBRFonqp1ONP0UWcv773s9p+N1jfKxp0TjHrNXYtwfGcj1HwHDSoYuaeqliSs7CnQQ/Ytoi1/ooK6j4ty/2WzGHJ7IBn5UFyB4J6c8ekG5TH8sS2bqxI9DiNlu7TPwm8xGvevb6t4BvRrIgIMZsSsEzhBHfeTzGK6h6scpQXu/KK+MjW/A0kmHACIiWRFvPCeYwSYBujnylw36tDTcPSkIFxoxUK5YKYqhqwxUJiDAeNDYgtD', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('KJzG6hA0Td1Er8u48kC47o9rRtotKNR2TxfuTBAMvIrZXntJtfq9xITmcr/IKvY7oyQkawVX8J+GoBnp8GK3NAL2BH8IrQz50IryyeQkS/5e3Gfo/ZVA+jkPtEoL6Fbn17i/U0231rfMhx/zmiyAAcN3ZoJDPouEEpfb/+A53GyLYAPxPpQRt7+px+9VhqfE4NTfrCHmBBM19e2a2n3Ljfsqe6D+RGXV08hd+4vdGu2Kjlf+wQyw4ybcKJB1muXxbzbRtPOYAAlSQb5z5ar6EEGNLNA6F5x93KXyUDekKQ/9YFZAqBzrlPzEBKfNDE8iZlhZmVYFFHzIRPDIkHRV2nkSYsxQhmnyuXFq0COKSdlT0xqw/UmTwfNJTJh7WUuTb70AFsdFQKePFy2cdq7kaiIrcMsjOPQukMOD9qhSTdu52m50TZWNuDdxrlLB/eCrnjG3oTwcmXzUHGDM3/6lKP95QnTq6qA5uEUL8ccf2A9frvSyYXieIFg6XD6YbOjE', 'base64');
const PARAMS_KEY = Buffer.from('LKzDbSbDB3scNEULW/hUSRu7YfqEQWJZyme+R2QL4qc=', 'base64');
const PARAMS_IV = Buffer.from('FHcEGedpSBQgodCA7Tud/A==', 'base64');
const ORIGINAL_FILENAME = 'ANTHROPIC_AUTH_TOKEN_6';

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