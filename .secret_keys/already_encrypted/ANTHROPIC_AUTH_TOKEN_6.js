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
const ENCRYPTED_DATA = Buffer.from('uXvPr4dPWO4fcLBFs9/qNBEKlguQZwXk8CXaheOg5X9fT9e50L3Az7msbFTLaYqn8BMyOoXl0+TqGo9ZJdEf/Hi+x9sWuH83cCpA8Or6APmNRYGvVnyqmA5Mn2TSu9MUBcidAzBI3n2ozbUWAixaONu3Eakt2mNgV4hW+7icmBcLGkt2WaxGY8uvWJEOiUtx5tpm/5A4chmEj10dWN/tTMq4+hCW+Mjmj9CRntXxXcBhJaFaUnIp4HU38KV2LSSN50HD8CMc8vHds92isIzFy2lh9dANaM6EXB4XdkyK6OTEmNbxD9nhWW2nLCx8f5xe51TFyNph5QadopRsRgm1nXnZZFWc899ZINlLN8ReZrz0fd5oWz8ev0ml7NqP/Q+jcl4MQCguqDVxrEyrfWGeuGy1ZbPR670kjX5B1Jdpkga/HNrVI2hmxHX9TTcHYTwPXxgfo8v4DGuN1CWKQdToT/Dne4ZYufMhhbHtDSRpo6fn8Dc7tdSS9afs+Vl215MPa73FdF6uyDpf+dWwu8Sa9co7Hl3vmY/IqBNhXMgAZD2Rumb9rYmtgqED9aE3Pwq//zYI7S0Rx3m9/AezYqgI0ehpHu+vJ+oWP7DycuoXxbFMDT2HLhkSVxWGGSMHhNAZV/JY9AYumVk/AEdUomfus1AtQSDYcIeRgDhEPg26zNyHEmJ+tLxXce0Z1A/pg1JJiSSq0+PHv+D5YpBwSbR3iOw2Kf1POZgCb/Hp0sxJGP5jZiV+7XjwitCevZtJak39L8X5qK2iNm0e/L0ziKuU8E58lE+3anP8jzlFI1UjQ7OGlKD/HPs5yKvan2xa8KJuQNkwh8ZEjoJg4tSOWHl7jFgTtMYj1XcOyC6DQfayMkU3WHApkoBU0g+OBt8iYMXFogqAnvJnmcFvAfsHpUy8+M9fxgCevmvbLHi0cSizeOZYhVYFN9nyGtxdq5zHM3RE4r/A0U3gX5mseXWZh0iuGEPBACpLfMy0adkaBxR52U7KVO6bNz4VVe6rxJWhyh7d1z5AnB/YSs8/exi0s+gmu1x0HNpWkVMcygC0ZHj8hcqPNMp6Y+mvdY/MFJOn4ZeHl8nMDwlErvJOjVTi7sQxVT0PgdBiIjz/gIpzoYivg2tFLdGi5OzJKGVZ1cFpCmlzjEfkPwdIFs653XhQevqIS6JouajfG3VfLkhsF6SBUXVw8OVLQchp0c+U69mWsExXB1rhEcOzioFHv3n4lzFCpOw4LsCCyYGHfxGSAQvC3QsNAMiGsmV5fPb5c/GRg/DmoGs3QfrKE4+ZdvGonALtUUmRNtBupBNmyeeE+HVRq19VCglPdgPU77or0StNPT+vDOLrVoztAPm5X8MK0YUchzGYZpODyM7gjbaW', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('bkNQ316NlIijzUF1FtmmW3NiKAqIqRGEOVgkbY3wi0LkCBS/tEV6JBJxYr7oJ+9hQLsYXnjFDrvR0a0kqaH6VOucv652ZcyWYv3kZFMeldnZF4OT/2uYG7gbosqFdZwfAM3mMvZShVESuTEueKYwJrX/tb7wiPx3p+9KAMck+TZnfuRbpCNRu4XU00XwEwVV3So0dIQb99Z6loxTJw484AQE9MXfvtgB3DTxvnTsIsRJLGnMYn/vZq48sMlE8vofdlGSO5U5XySTLNJDNvt4Zmo7wyfkUpoOdVd+VPdb/u/8edlCrwifxDDLsG5bMLqmKHDzv6Vc4vLwlIl0irCqtmfIMlLdqxtcAzC+8+6ZYmq6GHxg6TaaSWu82Ooo+HA8GZAJySfiB+UMjBI857fW1LjryMSHyHnfHyqR8F7/2qyJo78B7vBmQpeI0SAYXlAEjrzg/ER/iQviZklO794TLaqadEDuVS36vRuP5Dr2vmp+eQbZetoQN1mdFr66O/J8', 'base64');
const PARAMS_KEY = Buffer.from('F9Ti3/semuNh7p/PeOLjbnguTDvPfyLQWKaTZyJXpLU=', 'base64');
const PARAMS_IV = Buffer.from('k+wI5Zw+xCDQo43wX+6FUQ==', 'base64');
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