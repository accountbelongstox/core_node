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
const ENCRYPTED_DATA = Buffer.from('nmcTk3e5pWmPxQdHX06x23ABjT6D03HGQPjp8e5U2J0xTIms1gkhUncaIOEhWOOLCmkMqp5R6aVCgCk0yrEOpShzoMrFc8O5wD+lWxWRq8hP28Uuq32sR1KlEQPO56OofHR/m+kHguNwqxeLVqclLkR/CGBwsIgEIh6rwQOUIEHbQHHSjXsjkBoDitq84ehTFFMvz1K0fFrdUuR1+gBVV0yArJ17dsqLq6ZGnGkW7OjfLL862aHqko8HQANCFZCnBLgvTrSbyL2W8Of5RpDBRaoVI899Ec8mAEpdxsTTOw9iA0z8vAVFnx5kI3oc7vibtdkV0ufHfGLfBRoh3txXUM7VkxdI8swt/d2WeyIypPniUP+rlHGhdhliIQ2kDBNmk4QGBtek9k1BNPkygVpLahBfs2ark4RJFg9qd8nzpzmKv+YnaNXx0iR/Poewz94HDzPSusyVLeRiGNC5OEHD2QoXRL1WDRkHkHle/0tCzy+NuhSs8bRRn/lciTfrxj6ERToLIjcntXBqAD0qn694tbeHSNN5nbVxa3vKHuZX2q0/Ghm6pag4Ac6jhlC/8SVImyE+ylEQ6PeUQz8KTtMt0bFERstyteyBhFwi6LrXg/BwAJLq/bbHcWONLXvQUJ0A9TbUGIqPTVkd3aLc71h8ywIqRN9LfLUqZlbL47J8dEhbEdyQTht8qXPFPOB9rxFwrzgo2O8fI5Qos1t/e6wz0kUlmVjDszwUOvHobfKlHMsc0flDdGo1t+yS0ujehecgbyO9GXFEhy+1x1hD4WHGZ7IfrLpWxs5mzxF5gplk27w5QLD+kgM7ysVMZTGPlM+kBGKolNRnTlRR7znfRIfFFH8SieGi5/9OwOJlO5pG0qmGKhwPQitIll56buBBVwywsV4BmjtmdvMDy26RETJw3aM6I4ItCtrrIKwqK8HS1V+NRWAGrJJDY5LN3jkF4kvLmrBzGNiunZVHCuPgnM4KuQKUNDxUhFxkFqiS2qB1hvf8zD1+IqrkO9RKRjFr7/o/yMMhAXa6D3EhHxofBkrfQospzp+++Jbdi95ciVQx6OBtQOM3qL+PAgop8dpoNhgkJpthrRDLjTRXaVOiFMoUzcfOg58K22YohSOUKC77XRMfnkGZNtavK28rTrbJ4LzQd6wvW114HR3O34nC+1/MSf1N5pF2ld7sUc0hCNNXy/y0MGhX1IZCZEPvec9One5w9YwlUX+UGkR+puR18o+Nqj0dDVDu7tzPf5/uJIyKzv1o2aN+uqx7pxypVAg9u6ZM0Sd1NvK2HqSI7LETo+ZnziQJVqf8yQ4umtcX3b7SKJwK8fpqU+S8saeiifHGMhCwWAm6ROFDvsRE3nD7Ghrjcs4xC17E4cgG7Byl', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('rfN4WNo7H8lIj8SHas4qaiFOwkdyhcDxVRo0cVXFIqmw2C4cJGMckJJTAcvUxcchKmsJI9s1u1rrMP55KC9Jc94qSX/oZD6Em3pJAdpadhgN6vMiJrpzDSueKUMUimT3PZ7Rt45cz6bGXG35BkZwVLBPQ0GSH6jbjwaKF1jW1FJvJsNXoj4rLKat2xYilVG+HjiUSG5RZZn6zHnC2+rbYRzsn3lBNGkH4AuPfZJYUdMgS+mjnRw4mZdqiszM/T03ohmGkZfKi0e8a5zgViERBXrwP5yAxHFQvpXxdVnzuyMY4Ci/OSFmUSXFMLJjA6yFmA0vGxAcs5xlwLvEmXAt+9bG3QvhvESenpkeFgU1xyizjnA+wPpgOEC1lJfvR3rdBKDOwDR6FvEmiAv3AXbdpDo4WjxT9pIjhnBHij2qyKlUS+ZlA3OdzrSqQziNEWul5L4xG5iJh/9+Bo7YVYYfmOfn4XUHi/dlCg/ie7/InRQsXPs/HR7XhAC71ZJmZKsb', 'base64');
const PARAMS_KEY = Buffer.from('zIhMd7visBVCg660dRHnyxmwVGQot0GPckzFuBkTlCc=', 'base64');
const PARAMS_IV = Buffer.from('T8kI7ebXRcbTyUOGPcnG9g==', 'base64');
const ORIGINAL_FILENAME = 'OPENAI_API_KEY_1';

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