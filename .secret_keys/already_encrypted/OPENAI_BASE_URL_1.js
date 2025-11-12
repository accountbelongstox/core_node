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
const ENCRYPTED_DATA = Buffer.from('uIYjsTDgt+Ri85vOkv83NlNBES9kB1UkJliXpb6GutbJvmTrWkLEXyyBqg1NCf4vllUm/FvusSA3Ky0x27n2FRN4vG9xflnrY/n1+igv3iCoHSdkpDtmPlrlrCEZ0ZBo9/iR1YcEn6tZ0xej+QoqXp+QIfUbYG1tPI5/jLKaychAjutYl60SfSXQkuQqgr6jFxCnuYr6+rd6Xv7nD97COSMpDfJKNBdErVRs1jGNIQ0Dgr+KUUJtsHuKccCGhNgdqZO42il/4vER0offO9NdUPqVaZx4S818BJ3jHNhUYcTE9cfonB5OSOM4j/6Y7VrP3wXCMS1Cz2wG1bEMLSHyZ7XoZFACFYgrwpmSF2Yd9VbnU79u3I18W17+7IMWxnx7QyB/OcOQILxiTvtiquqNjtOFxQsaEA8cPNXmGxDf1uBqovOsAqG7sCXQrW3vqP6CGgHe79lZ7JPaJTJOBgrwTxxQVB7pFWsGQGiZDVDn449uNolp2EZLuvjoAGwy3tN5mZeQuwxY25RbP1QNLzgpWZyl4Jmeq4PI9uxln4mnwwC4ebDtRrOqvBFM9zWEbvAVXVchZR/tpGMsREIrbId0wMPBZofi0X3gNbwvrJPcigY6aP+nxZ9VVa9lu0uUUoQ2xLhsOZfE5yJ29hEUyOSnjTJnFl2+6EHuKqYAD31W5C0rw0BCCgaW9R0kzfCLlWj/05u6w1bntQalIcwATA/qEKk7q2+PEV5jC9fATR7eFJGVrXtKH/u6dAqNsjiIq43o7MKkRFD6IVkHx/oQSAfiMGy9FH2aKQLBmji5xoH0sC6dVmCB0G1akhQmTk626WyJO/d+nisc/FRagInY5YnhsrjHqNS1kH4dj0nu/6npqNi17IqsN7LH1tYu6tgkk2JWEbq4l5O+l6ffDYJ4k14fXqsHzQJ+0eVd0bAL98Bxxdo1DrzgtB+k+H1yOXCQDCbCwFOFhep80KzYbr3/MSWK3sD9PEvIeK5kNaCTRZxxaQwCGe9SyKfMn3YH+gc6GeEvfca0hcN7JzHWJL7k+PiDg3xsWwoH0yY2XBoBi9sBFx1YNylCJxRvDCCCERdQ2nPXu9KmxM9oKyAHz+LgIoftIdo5hAuU5Nh4661rQOly7y+GL2fVw290L3dlrbY7S9K+hpMxvqEjF3/eKbo61RciEMRqWkFrReIsMtC+Lz9hrQygoWnVNSd4olhTROblGH+NN7RwHlaNzRP2NnNiCq6QsmxGdERKZ8ESmJJrQQuuGchK1JJtDc7/K/nQp5/RAW62fKpTsqR7wtYqUfzHmt9JSSbLww5bGrnraCcVo7NlWzGEyOJDA7cRqT9NgiYitIrmPQ4SdB00srUQoko17rMPnDHwPEPxybVCDhDF', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('95GiJnTfjID4VUAKe5WLzJ3hCHLKh96IYDKJrS9n8oG0zmuPvf8CQxsLBAmq6jj4FaAn0VSLp1B5zfhvLFhzrCJkBxX+wL9V12DOKmOJoF2si1DmDs/eRRGqMOtEb50qYsDM6nxE3LgFDc12oPpX/eGSW0b2BEz363dMkMllEIjxbYhel9QtY4hVqz8YjnE5aX7TExWOJzzfiH0hQdmFWWBru8T6gveiaWHPbu9F+10LXEURWforu7i70/BPeRp4dgPHpUx3LYKlNgNbhW7EPHiNWVXfVOGKLo3uMDnw1b2xVNjxAtDui+uFn4pD4u+wWl4Tr2uU10u+zlX/Nyj2dklGFRt9Ntqu0pZvettJnXQulO9IXCl0lswekpoTeSdO63CAy1E2Qmp0/iyDwtsNTPwTuRoGCBZ05MXxHcWSENmx7JJaiNb8Ti2MFa+KO4HlZywgmyqRWvN+MdPyAbYmkESpvpYJ2WXzU12S2XEMn4og67D5ExyL00nXoY4b3BOi', 'base64');
const PARAMS_KEY = Buffer.from('2Rc9TcV6WXsrvwN8bVv549ZPtHntMEPFEx7A8ZblfQs=', 'base64');
const PARAMS_IV = Buffer.from('yiM62YFlEZk7RbAAtZBqSw==', 'base64');
const ORIGINAL_FILENAME = 'OPENAI_BASE_URL_1';

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