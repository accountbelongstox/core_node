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
const ENCRYPTED_DATA = Buffer.from('nmKo5C2DZG2qXa9YZBL97sqL9jt5sXoCh76aDXpi+SSW6WFVQD5lfiyj3y2tlB2QbLyKdvSeJCbLRQUUVtTD9tWVDOqQ5rQerHLka/9yb3t/DzV7qoN1AdCX4tC5ASih0HNjjLSlzMhnYtKn21VXKCvKidZg3ItAijKnNxZX6dR7pOWsSWvmDE6eupLH3uKdG5JXs2cdT7c/KAvCMJNl+4y/IViE67ruqcPkh2IePglgRKEXNEjaJJlx5RHVRlb4i8togstcST4tMmsYfuWs8przOSQaT1vWZhYRWFXc9pOKmnc/7dXjNd2PpDUovAbgYYdcNZSIcWDFEkVAFnISSevAW82vianH7HPvUBKrC5BJShU6Q716aD3PsMSID1LowSyqsNWMCb70z7iNFvWn1jiPL84LzA+bLfKxus7qVXzt3bbASeS0T6CacrRXJPPZkzlDNw/JoSjZrTGJOoqSOHTH/wabuM7ymKB+gl3qByt37QxbhUvpgSkqq234zbt2okP0uy1BRxHJJav5kUePGa8wJGsXoJN3m2iVkJQDAhZy2D0f+hoAl9YvSYdV2ZDDnOLqFg5q8L7XwdAdFQB6Wevy0MUM689JMtyJPXSRJgW7+pcMCVOmOXi6spuFsQpukbwYL2xJsHJiRy+Bm3vy9yVJ6cv1orCfEiapdq/+rM2TsblW8oOEarYsjNbtli9OG9Ky9XKXlmrAmkEV5IGX2Kvb0f8YCJ+WNAhzbNHiXSOpn8Mvut839OLpJcwezip738ToshRAtb/Slqi5Rz8EkTZ8hk1JUSujiRxVoGfYbSOyGdyATyVV1qWExc58vInIGDb8//jkCLHxO+b0dBSv2k09OoXSjyrK2qNy+xpq2vleQHp131K0hMXoCx758WpCLygJFSR4wZ891RDcjLrmmeNIb6SNwZMwVkXthv/wb2jzDjabn/lix610486JRfwGzKGfstKleHrs/O7cktuLQfiJRH8qnzYmbcswz95/ifgaa1lpRaSC0RTtv5KHI390P3jNQ2A7JlX/HohVygwMUSSab3uzyZs1pLzWpFtzeyZ5aIfH8zYRee4bgJEQbfbYXpVzLAg96eG0ftI1lRvgrhx5Jn8/xBZ55fy8jxMTcqrhh+K7YeLbyq1l+i+6qQTJQ28YR1pTxY+KkDIzvg48IYQoxBdWosVRs5VC+b62qVxDpGNdpFNHL7rnHyNqPepRUqEjBim+dgz1ZIKiPM3PwkXA8loPMajGTCZX+K9cxyXEpv+9tqDZqAxqvWZ09vvFa6Me7SMIuo7nHMqFEUAzEjEEcrRwjJeOmwfqDXZ3s/wYcTWizDY04thzzaukpoNHUycuXrhWmeE9W3+5wMgWYHag4ONDDBFgyMcP', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('k+cKIdjcMdur8ckZT+mWtWsveF8C53U31h8XSDbsd+qKQBKr25hXA8VkJJi6BLSH1ce2I+5COcdn3DN9XS36tzn+i3yylcK6/zIFLFscNiImv+0wlq5d7CXwoJ1UYwdcPZSQcQyqDutuURlFd06U2w/QlY2+Oqu2dK71zGMOuXKzIzWgQ8/WAOY9Tz2/rIicj34mf/o8ucv4tM2ZoSxWfUNPbcoL/bZ8xMQLWWGGMvIHxGfrrspQIEVkegLS2NSvpx2ejju7AgnqzCRd+fPi4TUuAIN8iqvKUjdQQ2JMOSJp+cDH0hOt+TpcNnWNeyAthzx7b2czhKu/9BNONcEYGeNEkothc5HedfN1Onsk7jgIwwEx2tmfSWaonK2gbEUuAtyhfJ5twNzxlEUsEm/e9ye8AStAoVtJ6CMQtXaamBiyBbXQaJt992BcrkzdSNqq5meNvGk3Ym5qdWqdXOwCUkxcGOzd5RuqljJGUZDQHKsKCWpLel65U7BXKxypsiGW', 'base64');
const PARAMS_KEY = Buffer.from('xVxrcrjLXrCCHDz5n8QHOn/DRErDgFjwXGKIEqqhUf0=', 'base64');
const PARAMS_IV = Buffer.from('3NyyYSB4GqjCjZ1Tu44tLQ==', 'base64');
const ORIGINAL_FILENAME = 'ANTHROPIC_API_KEY_9';

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