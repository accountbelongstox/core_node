/**
 * Image Encryptor - High-Performance Image Encryption
 *
 * Logic Pair: This file is the BACKEND encryption logic.
 * Frontend Pair: /poly_apps/appfactory-master-dashboard/public/js/image_decryptor.js
 *
 * Algorithm: XOR encryption without compression (images are already compressed)
 * - Images are NOT gzip compressed (already optimized)
 * - XOR encryption allows any password to decrypt (wrong password = garbage)
 * - Encrypted files keep original extension for format identification
 *
 * Output Format: originalname.en.ext (e.g., photo.en.jpg, logo.en.png)
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_PASSWORD = "BuildFactoryEncryptionKey2025";

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];

function isImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
}

function xorEncrypt(data, password) {
    const passwordBuffer = Buffer.from(password, 'utf8');
    const result = Buffer.alloc(data.length);

    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ passwordBuffer[i % passwordBuffer.length];
    }

    return result;
}

function xorDecrypt(data, password) {
    return xorEncrypt(data, password);
}

async function encryptImage(inputPath, password = DEFAULT_PASSWORD) {
    if (!fs.existsSync(inputPath)) {
        throw new Error(`File not found: ${inputPath}`);
    }

    const content = await fs.promises.readFile(inputPath);
    const encrypted = xorEncrypt(content, password);
    const base64 = encrypted.toString('base64');

    const originalName = path.basename(inputPath);
    const ext = path.extname(inputPath);
    const nameWithoutExt = path.basename(inputPath, ext);

    return {
        success: true,
        encrypted: base64,
        originalPath: inputPath,
        originalName: originalName,
        extension: ext,
        encryptedName: `${nameWithoutExt}.en.js`,
        size: content.length,
        encryptedSize: encrypted.length
    };
}

async function generateEncryptedImage(encryptedData, originalName, extension, outputDir) {
    const nameWithoutExt = path.basename(originalName, extension);
    const encryptedFileName = `${nameWithoutExt}.en.js`;
    const outputPath = path.join(outputDir, encryptedFileName);

    const metadata = {
        original: originalName,
        extension: extension,
        encrypted: new Date().toISOString()
    };

    const fileContent = `// Encrypted Image - Build Factory
// Original: ${originalName}
// Extension: ${extension}
// Generated: ${metadata.encrypted}
// Logic Pair: /public/js/image_decryptor.js

const encrypted = "${encryptedData}";
const metadata = ${JSON.stringify(metadata, null, 2)};

// Backend decryption (Node.js)
function decrypt(password = "${DEFAULT_PASSWORD}") {
    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    const passwordBuffer = Buffer.from(password, 'utf8');
    const result = Buffer.alloc(encryptedBuffer.length);

    for (let i = 0; i < encryptedBuffer.length; i++) {
        result[i] = encryptedBuffer[i] ^ passwordBuffer[i % passwordBuffer.length];
    }

    return result;
}

module.exports = { encrypted, metadata, decrypt };
`;

    await fs.promises.writeFile(outputPath, fileContent, 'utf8');

    return {
        success: true,
        outputPath,
        encryptedFileName
    };
}

async function processImageEncryption(filePaths, outputDir, password = DEFAULT_PASSWORD) {
    const results = [];
    const startTime = Date.now();

    for (const filePath of filePaths) {
        if (!isImageFile(filePath)) {
            results.push({
                success: false,
                originalPath: filePath,
                error: 'Not an image file'
            });
            continue;
        }

        const encryptResult = await encryptImage(filePath, password);

        if (encryptResult.success) {
            const outputResult = await generateEncryptedImage(
                encryptResult.encrypted,
                encryptResult.originalName,
                encryptResult.extension,
                outputDir
            );

            results.push({
                ...encryptResult,
                ...outputResult
            });
        } else {
            results.push(encryptResult);
        }
    }

    const endTime = Date.now();
    const successful = results.filter(r => r.success).length;

    return {
        results,
        total: filePaths.length,
        successful,
        failed: filePaths.length - successful,
        duration: endTime - startTime
    };
}

function decryptImageBuffer(encryptedBuffer, password = DEFAULT_PASSWORD) {
    return xorDecrypt(encryptedBuffer, password);
}

module.exports = {
    xorEncrypt,
    xorDecrypt,
    encryptImage,
    generateEncryptedImage,
    processImageEncryption,
    decryptImageBuffer,
    isImageFile,
    DEFAULT_PASSWORD,
    IMAGE_EXTENSIONS
};
