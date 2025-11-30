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
const ENCRYPTED_DATA = Buffer.from('HgvvZgnBKkXpc29zg9oHmVRs1RklXv+GFMdtzPBDdspDVMTX7GBPdl0MIDkFyovtqFEV7cScf2u3p0Yv8w9qE3PtT/rw3LaSrsR/vLHnmJvWJmh0uJ+VEDZFUOZ0yHFdeuUyd6GJysX9TQ9JW0DHapaS8O/l6uxXZeuXinGdHYHWOZWvrsNEcHiAVquzCbdq3Nt/lA8/m4lVA+L3VuQ2dUTi8FGXMtaluA9r1nYOAPrCdpdwPpgnvwuoh6+WGxzr/0A1fik3GVx3HIqrOOT6qA9DOqdMwNWwbmZKjI/HXQkKy+HDc61pW+7GQwVfP6xfRr0iyZg0nPw/WQ1/nPCv5X6OBGcbFmv8HfuVcBYVMXSDtFhaOcpkFqCZVFa1CaNZ5PKxZ5a9It/zFUKtYJaVar8QLL57N/TXS7eVY2ZZjXt+ScCOfyY3OE7IP2kh7cD1nb5lx2wtPf+7r90VTOWmRUtSfx1nzNQQ2kjz/h8DpohmCr9pQYjDcCIZPuJD9PCmwR7XCN95AL0uxLjT+nPdyyOVMYc7BW8P9ukrLFoPbtFJJp3q1O9bPurtxUUYTY3C4pH2m0Cswz/aoaKJV6pTJJD4GJzj40LPsM1PSaL97GsuDvy+PWlp0lkOKu7iE2eYXj+lmv8AfGD08SrYoYjUWc7TgvgW9xS3+lDRv6o/5zViX0c+0uMOoOq0TmSpQuSPX453Q/ulT8OyW+EEYt7LBxr2NXSQSQa0tWocJ7o4rYlLP9HhpuZSubJDhyUJs0GgTttNNNm7ybLipoqrVdvNjfZdf3T4M/8i9Bl65TE5Tg7MJ3iNg7Hx/ZcdMMUFkJq66v/vhVyGoYAki7Ki0sJ6iRK/1YttnrUOoMf8CQdaenL5NQySP8kJB/7yt5q8EpfVCrdI5UxNmwpe+WWRsOQkUzDDHFABVBA3I5nSp5DngRRZJTj1P3y/V85Sdzb/yRCXJ7f7769p8qBj/Ov90SRwuKeOk06uhxV9VMYVtNSKlvCihbmiof7Ufjh75uCpQa9suTAevIMIheC7g774+MJvGkec1ERXjcBLsk5/l2NIxsdRTA3eDuFFq9ucW7IwXFaoXYtncDxtnC8pFvOxnUQpHIOn5QMbezeH8sUsj3SImTjzUg8m4AwH8sn0vb6f9IVx5capXEk0JikDNeSXkniYvk1U52ThhxqTwPPjZ/oCZ17uklOw8Voc7rzGLzXVvtGO/XOAtxFc0K63L00T1dQ+80Gp4Uzgtgz2mnpoj8lAIhFeClseqxvf0RGkZcuRiCo867wPzCMCiwcA570ws0fCTlmb2BWAoumivpUodQsxsXiBmgrJE3AaZz5JMOlrjFSEGsvx9zhgPpJMAQe8zj3ChPLAsu4Bo5nxvmyu', 'base64');
const OBFUSCATED_PARAMS = Buffer.from('OrcNad48YNWVd4WpSMmyy097xIPvtCS123RXB1wRtEll/YytFLZIel7GI6cYx25NkasW46tPNp7yEO7G6FOi8xy141nZkLJ+JV25JdVWgkTpJkPX24TsilmFmToevpg4LqG/B2dNyLvzXdnYVshI2fhzQROnA5/fHNH6rTf4KKuRVUaRJSe/ZIFZsxNj+rXAL5l9MU7Nggl2Pg2OULZogZpNC2KhLunLwkHmhGnu4gybcgU5QFL914O/EQlfFmjtmbi+5C6juq+c9lBHWOp4PXXlyyvTyVhyYsb59ZRmAsI+6kb5y2ZK8elJ65GISShtBe2WJXANxG5FnB1Wh/7w3bmyDgTZ5hFr4K0/e11tZFZNbZigNr+89iuZPMOz80lPr1aLiWn0mZaWnUUy6kegybJzA9uFkyJoPkO0tOKhBbZpe7Ce5t0Kb+Qzhx4X7j1/WlnrGF79yRE3GY4g5BG9iqS1IdoOlyfrLqbOubfSocwETPi7wlG20n3wUChhu8H6', 'base64');
const PARAMS_KEY = Buffer.from('rnK7ZK6NrjbWxVmdJggmwWebT15glm6ik2n5RQKQRvo=', 'base64');
const PARAMS_IV = Buffer.from('Sj+LWuIjMne1JfpxjfgCFA==', 'base64');
const ORIGINAL_FILENAME = 'DNS_DNSPOD_EMAILS';

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