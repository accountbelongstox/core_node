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
const ENCRYPTED_DATA = Buffer.from('iNcFuklel0rjnyDoXbYWMDHtN86prLCfHi8Sr42E3x6qv5qwvvzlNjjSR5DhNW+bNJBgNk0OXZbzVTwC0psLsg+Z+rD7s9Cn06zDifRu/aoaxCuXhdAXAFUCCDmACNC0fQYFnqebmUrYFStbHe+/yjgkWvC3rdqh2ENVq8x47srxhhzb6fuXy8WggVwKi4QlcUfzD2EbfnzsuhEEAG6U5CryEt6hyjUm7yOk4l0sJL7ZDpdGhD8wKcVU1+vCMul60m1xB2UU33Adprz1KvqmLyNHfBERKUsIg1hZQkHHIXuuIFwnzDzFPI4U7CzEetLnaUsBgGOfkJXusq3aBdalRJk8mIjfYOCoGPYfq+1jutsIB22iFdh1T6mpxC43cKV3RH/hCUN3dkMEQWy37EFnJOQHCWJTbMCi1HRs8ZaA0mHLDDfFQg+uwN+HupMtCWgRzI/9CgjQcj9ZSCnowmHqd04i1rklt0e3fHCWjNLLFrMpK1r5jaCk0wqwTTc9sy7m73Y516Ju2KGTVTE75jRkFJMlg6KPu2zDlSpTNMJK4TAqonIv5lY7lgM/BZMhiM6uL0h3dxgFXRz+F5EdBYkze57bTe+dJdX7U9gIPh3OKVBsG4Xi8/rNoyWBqyAWPUKWNEz5DUeXk1f7e29OQNSGnX03Dl+hvH5kw+dZJcVtJ0SK3HzS//9DLG6YgK+9ERZTw7/1NQMrMgfTqn2Ff4sjyVgRpuGkI8YvUagAaqCURNYS1ijlxFnPlDU7HlZTajZXrJz6ttHcBsrQs9VpN0dG8qmLNrQfDuyKgXhBZEYvFpmOfgBDjUgVvaKeM3sBN1p/uTZkxm4/tqineHxcYZMnmNI2iBMQXDGSxpyGnGU4BqbIEySahjajcmzlRLHoOR6FBSlT23QJKTfcgjFsUQHb/vzBXSzx3DYK+qTVB7Lv4s8JjTZc8JMaLy+ZfbofkM4dySU/HXgfCHr8IHFAjds70Zr64tK4SuRQb2zbvmXoMwvr9J/Tg4nVuW2++M0YqTRa6m4j8ILfBfz5NI1wMPWNVmiVa/Xh4gOnpO+VQfmbuc32bRxvrhQdZs5hJejIR3Bcogd2NHPKHrzaIKXAUTvfHacDCqHPDNe5s82MDoMssGg1Md2qF2avqsqIp2d5wFbOXgJnSkAIHhHa3d0xG1WRzpHJh1h7b5RRXoKE9Ms0iZhlMO4/tf1EqEHgu3PO4uDrtvYtNpsS3eglATU0ttPltwVk+ifIiJRWKb5IxV6MmeHldJ2JCf6eAfMFkXbofe9TbuE/P3eeY2tZBslgR9zFSmmvxZLAALXO6DHihzrL+cG72dUKVgI5v8tIRVqeVsvkyfA5S3GhBgI/3IhZ7aoo2tgo5gHGU27rwGrq', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('4sE3KyLw/6HkLuihBnOrbi5aTwFTlq8aMPzQy8HS4M0fMaw9YfMdGe3HiTvOxHu54v8dpdts2PyS6jLZitykcE7bHXhJGjt+Pgf4aWNY6ANYPptriEA64xpwJj7wyGbu1dTyx33wZKKjnxmfZ97d8rN3B/Lpb3+SjFgZ4Ifqr9AJYGyo/vlSW068eLKktx8KhirhtZ/dEdr8puRHGUge6EkTOnw1tFKKveQbvJoCIVoT456cX9SWSSyYl2x4VXfvIUFtvqEi74Yjv6arKpeZ5C4C7igFnO7G+8N1J7PQW6O88Y6vGD6rP3SSWHrTWdP4+XyeRR4ynQMsYAjO2vr6GwAJejgtXCxzGFXaNjreH3o1RYh2B8+8U8XvT6cF0R4ReVPyHsed3d+IjKTrGT4vuRGw1QZJLUZXFqCtl3fQxlWhg5gaAKsoPFrVrkqL08gNFs4lRl+jNcO0GG4zndAU8P7Is69ifjAkt00zIbesf+4m3L48JUj+xTASHADXE9hA', 'base64');
const PARAMS_KEY = Buffer.from('BOJ/DlLqKFTGV2WQ3jJlN8oy2+yjg2TN43Sn20ufumk=', 'base64');
const PARAMS_IV = Buffer.from('pY6nWiSUWsqREygf880hYg==', 'base64');
const ORIGINAL_FILENAME = 'ANTHROPIC_AUTH_TOKEN_9';

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