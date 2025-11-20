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
const ENCRYPTED_DATA = Buffer.from('CtQz9tFTpDVzVq24hmaO/sbrA4uLVaupn07vdtaaNeZCo568NTYJd7NOKEZomYTwZmf8S88t4WadZHoqWToPPqzpXMbiY68hYCe5RnLqyRnkSmiRXXLyLegV6hMjW7g9iYFnVGb4oNOHTyxps1pfeXZ7zx0TFUA+7jhlo7RM+ixgbFKpvIUlRtaMbeWd8bGiAo1PrMbyChs7RDJKa8NE24RM1VO/8x6W+pkgvSorqDeD5E/8sy2KywIHsUat61in3nvYQIBVN9XjmRYYLBc6nQfGASzUxKlVOJpk2bqy6MRr7AfNpAfxYih32LCFddhdpx7BeS0aXGU3OHgaQRD9QyNdMf9oUn9wxM/4/jBaQlctUxc97uGe241MppH1sbtlypaLczDzcMDcUptijsI3oOOS2mvw2Lf0C2+KBfokDh1IcHG0i5oj2/b/9nKNESFZuPGHefrvLLnEBzkzjIw/F8c00jezSp83QhyRMhjhFJhYtcKou9mjI+IpEYAozTOaT/GUMSjvYFOhpoR93KSsbF1FEXi0o+Vo5JLyKmXRvdRT+kNk9owno5Oft7XSvb712Ef0u024bQtsKhAWE83WaFYyh1tDqnxbv7KGS7GVuUglMPzQYGI8bgUHySDT2ER2cde0Lb2X72KMW5XYg4fSBA2nvTd8GeEEaGGEmJtxLwDmshGStU/cHqrFnsk+1uHSsSWaEYITxpOKquNFZ+y74K0CUXdFKYUcSXh0nUscJcYX+xMKl0NuV7ofBk6afpN1gclTzWTkULCt2awtOkEV6QiAnEISyE21X+yBfrneq5U6aH1gsT7vBmQpGybXcGmZMrze2lwFCTh/DtdaVa49d4dJcjZ4l8kjx3iEcJHXOTF5E/biEwIl8Kf0LXKCDDISChC+dZOaLP9Fr1YmKsMPx4kw8fQWryxRr/6DwlnhKF3mlw2fRyes5Srx/UkyoMnFFPw05k4TiXO8kIl7jiGsgY7hLjPjj5K0X1uNHRgHgtQIdgPQX0Xlfkd34vPZLiMJyh9dihIlQtQ8PNKU1I9dHEVtC5r4AQwLBxxYTyP9xCaGoyKvCnAMaqoCCrX91ggBL/NFEP9LDA1vsP0Eu/xKUsDwoJL1OjNxnp3mS+XFM7YWOcT38F5R3Hq72sgB6fJdrvF/aaXIiT96AQCMSJgTo5UJ3tKhXLULeGbIjnW6qxSAug2dTvsEqWO/5FPt7kueI+pd4+k/Zu55xSysuQ5grov8ZTGufE10JBEEuV2dFaLw0uSafqhA/nZXaml14aKZKi8YeOuIxQAZ3FD8JYEkFMXzsT6g2w2YwkutaMCpTuXSwr2ZtjCQAiwSVCUkqrb54Q62f0Udt3JCB5aaNAZv7eTAVrO4qXcH+7cZ', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('hf3LuQroQuKpdoSVAjw8oA+o5gy73zBeX96zUS9YzzqMc/AavTtRQvqTehHzG8/2wqubVYMI7V7mK7xKbwGkcUoqeMIv0tAExl9xEimxfBhJ9o5tS0jjssIKzf05qn9zDpnfBvOAvixCTybVxSt8g3bOBigWULLc3B4qXtabcBmVwrknAmxV5IOOm5E3d4pYkPArhPxjb+1mRLWOvdNWDWl3cthgeSsJciQ2GDdpxDCeOmSzvJC5errXudlxqa6Pg6XOFwPnUPl3xtScN4NGWSW3qTSvh65SQL4nIa5xWSHpoUCJkO5A9wUy4DotlRPd9B09FgObns4lP5nuHdtJwTxKn6EbgTpXWdeOhvNaJNBejWTSA6ahJfsesjmjtQK+Sgb7ukrid9lCLaIXY9CzQTVj/Drizx6qC48wCdsT42NP8PexDvg1czU274ra8tRJpUsNUbM8FT81qslcgv2pqPWkXcPt99kiuj0bIx4x+9ZbrOn0UXX2lLjQzfEY/bPZ', 'base64');
const PARAMS_KEY = Buffer.from('ZMATjZYwUOJozAQJjZlHO0hKvEn1ZJl2vKmqqavwSng=', 'base64');
const PARAMS_IV = Buffer.from('HjHAJWTiReX5segn3stO4Q==', 'base64');
const ORIGINAL_FILENAME = 'DOMAINS_LISTS';

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