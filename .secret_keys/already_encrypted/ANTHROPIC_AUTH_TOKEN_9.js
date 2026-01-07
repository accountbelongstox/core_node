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
const ENCRYPTED_DATA = Buffer.from('h17J8DdwSR0WXYOsvOt+VmkE7Uvrqw9IdZeeufTQpR5PDHoqR884arVioeK10Yj/f7kNerrlH2MW8VSzu4GNHYNZvJOLXpIIury/95bNEeh08VYv+qwH/EBhhPvSOHl2w2duePKnriju4i9zOJ8V6JLqSvQlv11hH41Vzr940gmmocAInF0J9KYhulNBQotmMqlY185lDfoiNjGf1DkLAu+aq9bML+NsHZ+sY4lBI0+j1/8ArPCHXm31pYp3FwAXBl9j8Swle3vMXchRIpgPnvULPI69xzTAFj4070Q0vThT2XLNL7axFKiuHsYDIA9DAjFx6syX9sMegU8WSOisQGJ0hb76LbMMAf/Cu373NX3bqfwoijWGKOtMBiuK+9Duor2HenDfK+N+6JdLLbMu+n9lCQUFO2J9hpbddQsMk+yQj5LWtnRJX1NFqsoeEpvnFBjfpctFxjzY9QjBk0x4eLxNdWxfARjUC98lpdpVz0fc51vqogART/wau+bhKZ+kvV6qenL/dIrm9tZQ7Ew+rDomD0rHWDAgy8OAfH/jLMUFV0LX11CFERHeK5gGcX840BXftfk/xLJmsPC0Sq6rcwQ0yqj3Vp5KM12Y1+dPkJcEosw6fKezzfe5dIi1R2nuQ/aMSkRQBBLXtAVk4cokQPLsmtQFihShgHjOftqYrCj+OM/4byunNPj43IeEX19oUCrJA802h8ugz8VyRYAw3e4lnLdSUUlcJrpmvlZMNv05f4yS58zxBE3ww5mkdwRktE8wPsW8fDVazMdHeu6PQ+o52OW7yqxZ2W7GZhOlnNqZNWmk3QSemjJuWrqM7Xno+9VhEOkIVyTm1hIMMLPjMbD3Eu6Atos9UWx9ui041fArNCjS/EdIaOIf5ncDPKnT3F+dTDTzHJPLjDVNogqJUnodXzFRGflTnAV5gPMQXnzawbp7STKygUJieEkfzOQjS3+Uqwbn88hGXiGhNuvpnLvFbbsQImhj3nxAp8o5PLBcr/7a1bDL5KLATFQAvpAgzxPoZsEOj+z8vslt3G1DdDvmgRSO4qQDsfVNlkeDFcPnAiPWY8lcHc1gAcnk+Q2mnM7khtbKmKgQ+vI7bgY0tZwgiJli4yn+DZhqDUjZTkdRhxuoyHlY/1FG3S51DlElRc6dQr759iK4g2xuMvgIgVVBvQAGxrVMJ2GUi6mwxGV2SygH+NzL7um+LTUpWxjbbskLWiCYQdfqeA2YfzpL9sqPEAFPSplmVS3X6XlioJPJSJCmRkldkrxLN7KXx6StjL7uhtG3YUtVMzlWgMyMcKQTvWHwmHZAWV+vBeC0yoqPjc0K+3vVprCdo6YHT4KD7MHCCYLnOV6BXfry6mZD2U6nVVCo25F+sfzW', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('4CvSuclkdssSzqQPja5qdOkyIe6biPEtNFZ3Y3mOXPH4jZn8RPwI7OpDSLYxkR+btT68wl0Ioqwdewab0SK3N4Glx1O4+Z1fJND+/UxaSi/RzEiEN/dwlDbUSCdqRo+ocjIDWUJ4Ypu5vewwDwPzUnD8YGnID2szalvQAA28Tl69giaTLfuH2/VGJRiTdnptwUGHN+7pEdNRLO+SRHtGxaE7QW0V/a93UDHAiTzeryvQVcWE739zHl4Lxmt4MxEduhyGf2a1oGsMSWhXgXytmW7ce75d2sfuyntSCe7VkqUyFwK2YPzNmWHpkMDwvtLfr92ENkegL3TeTCSebapDb0ZcKe4tH2WuBp3Qqa/hXNuW7huNRC3GQxQT6leeO5558rOWMthqcWDU+/GZoJkiaBAQIwIfC5Xb0iyR92a3WKbEe5aJLlp+YnTzZvzw91U30CANjAGbEf6N8XPxfpGevOIeOrZlW3LIQA5hJ5YIxJKaBLH34Eb4jTtau7EqBt7h', 'base64');
const PARAMS_KEY = Buffer.from('4ge2fQPrNvWPVToP9LHETcvFseH3zHlyjxi7Jt93HDM=', 'base64');
const PARAMS_IV = Buffer.from('bpRwL3W20+/fe9xzXaof5g==', 'base64');
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