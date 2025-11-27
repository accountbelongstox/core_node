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
const ENCRYPTED_DATA = Buffer.from('qqpKAyHmuhlPchys9InNwLZfPAzEXmzHef8DkgGXf+tGzGpz9B+z4KgoQPExVizUR7mEJo4kInDXnngKBU/9OqVzydS/t/Mdf9H7r3WaCZvh4oXDMiLRyVZToJOF/gejkJIgeoy6VfCT7qDFndCmpsqBhqbUTPpsW0QAecS5imtW2OIY4dJggwrRZrbhaDdwl+ne2C/+8kI71TUdx97Ft/dCIwJ8QmjPVZ4g/qodByQKky6ZMlJqaWoTidRpvIF/EHYkY1GtmA2QNrpcMM+AGRI9zhvILOjZPExK0qPOPksSjRsOfb9S+Y7VUZlhACfPnvxfbApgm/IAAZdRMB3+jQljD5OV2Ii3pR7ewcIZZgtyiWmnTufhWJ786FNzDN8mV5uT6xxeuHcCO9D2zclRTKjSKJMyzOSAFyvXJaQQq903byrmn2wA0pQ8kGyZyvtYR1Zt55Ia+u88RDr6I8UIZn4di6+Whb02gAFzkEHja8iVLEfX/eAjAg0x2USQp5BIUY4pO10ga1ymuQAD6u6/Pi46YYSb70obWapB/lFVgQW3SmtHtxzZA2o2STcnlEVBheh2jkw7rSjRLkdZb4aA+ZuxaHLBIaCTOsHUlhYFPSVGnQs3iVCanFzzPZwPuzC3vzeQsdjVCei51k7d/QA75whxf1e5EMFsJupy458DLjkfoQSyLKz0fpWKdRvrzPwWTJihNu+XthsfSMxIeOGBpgJN8g6cibfdZFbfJmwBferuPPz30JMq7zHi1Xb8iBAJfE+SXH8nHAjAxjzc1BPi3CEQ5IetdzbtKK26cRRA/6E5MFjMwm06b8idw8n2rdu/p++tk2h18fxJXCR1aLI8XYnpYtVdYYJ9lpPNuWEUP59+2CCoDi7ALA9qs26N5SVlszsWjk4QmdndrGLsBIWEMI3JDTPTqb9d4EjXukQyPvk46cJ/E07Ps4kzv6QKnLZTReuwfuL/LIla0aKjNCxRt/fJei5auc+O5NR3Ha5dIi2Xogx4cju7xZGbOKyCH2QJDy5f/uk046fGc50YKX1A8H0Wsa9jtnIyqDA74p9zCcd5wAp6nNKDIhucLUyrrFhNK+vKsB2kfcRhgtJIfjkZtq9fx77WgqPxB5Q1F3llv/jJXzozaMqfUbxErJtD0im5c4ssxgDotGwkUmsF7eDvV0E0Rx13vappxz+y+EAtGbuTPJzOeRdg2KPlA/zk+ChggZZimrZJmS2E3c/n71CSl0OL0lPsDhfvW8C9i3yvcDRz3Zo9kjArUYbmhqZICwThHwctylXuls3iNYWDOv0Xpkx1scLa87K3/7XiNw6rnzrPLAQkdF6yPYQVQE394ZX4tGgN5ZPkct6Ws/fJg84IIZEU2imo4im14Vz9', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('MQWvhquzzdye99tcp8ZdNe1y4jAQu2omAI0b7XUQtbwf5suNA/xT40Vp39cSN5jhVHIOWxyjasIQLZumQ4kgVldAmPezsXbuWYEeDlD5NTEBb7Dpz+S0VIAnh3utKNleGylSr2LzGdu8Ib+bbZxkMy/ajgl87e5AlOMiWCezRHc3yEwOrqmibilLnwJfcrJLx3e3g8vO1jpwFA0G4/pj50Cqt4KSXduM99TgOZAPnA8sIMJqYcob/K57uSrqKsbgd5KfnrFXeVtKFMGEBBQDK+Uv0kO4DQGhHaC57gtDRM9q/x7EPdcMkFXiZ9flif3QT4wOaj4oz+I1U+AG2rQ5bLOvk/bLhBXhc92P+/u5Wl/rZM2LLE4Znm384xD70LHAUZS+LMWSHzk+/2Grb0jAwQbA392ZTxHt3tVCRwyjDaftxv5GH27lkSUpkvzVXkrzaWbAS6xmOu+jNVyaKo3xnSSYIFLln+u5LbJNTjszBTovj0yO6B8nX6gun9I9cs6y', 'base64');
const PARAMS_KEY = Buffer.from('m8a8LWUtTL/3hEm1Lc/ghq2iT7fSlzmoipECRPFlDEc=', 'base64');
const PARAMS_IV = Buffer.from('jLxcPINP6SsMMgBCGdQagw==', 'base64');
const ORIGINAL_FILENAME = 'ANTHROPIC_API_KEY_6';

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