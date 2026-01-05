/**
 * Image Decryption API Service
 *
 * Logic Pair: Works with image_encryptor.cjs and image_decryptor.js
 * Backend Encryption: /scripts/_daemon_tools/image_encryptor.cjs
 * Frontend Decryption: /public/js/image_decryptor.js
 *
 * Endpoints:
 *   GET  /api/image/decrypt/:filename?password=xxx
 *   POST /api/image/decrypt
 *   GET  /api/decrypt-password
 *
 * Usage:
 *   // Get decrypted image
 *   fetch('/api/image/decrypt/photo.en.jpg?password=xxx')
 *
 *   // Get decrypted image (POST)
 *   fetch('/api/image/decrypt', {
 *     method: 'POST',
 *     body: JSON.stringify({ filename: 'photo.en.jpg', password: 'xxx' })
 *   })
 *
 *   // Get password from server
 *   fetch('/api/decrypt-password')
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { decryptImageBuffer, DEFAULT_PASSWORD } = require('../scripts/_daemon_tools/image_encryptor.cjs');

const router = express.Router();

const ENCRYPTED_IMAGE_DIR = path.join(__dirname, '../dist/public');

function getPasswordFromRequest(req) {
    return req.query.password || req.body?.password || DEFAULT_PASSWORD;
}

function extensionToMimeType(extension) {
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp',
        '.ico': 'image/x-icon'
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

router.get('/image/decrypt/:filename', async (req, res) => {
    const { filename } = req.params;
    const password = getPasswordFromRequest(req);

    const filePath = path.join(ENCRYPTED_IMAGE_DIR, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Encrypted image not found' });
    }

    const fileContent = await fs.promises.readFile(filePath, 'utf8');

    const encryptedMatch = fileContent.match(/const encrypted = "(.+?)";/);
    if (!encryptedMatch) {
        return res.status(400).json({ error: 'Invalid encrypted file format' });
    }

    const encryptedBase64 = encryptedMatch[1];

    const decryptedBuffer = decryptImageBuffer(encryptedBase64, password);

    const ext = path.extname(filename.replace('.en', ''));
    const mimeType = extensionToMimeType(ext);

    res.set('Content-Type', mimeType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(decryptedBuffer);
});

router.post('/image/decrypt', async (req, res) => {
    const { filename, encryptedData } = req.body;
    const password = getPasswordFromRequest(req);

    if (!filename && !encryptedData) {
        return res.status(400).json({ error: 'filename or encryptedData required' });
    }

    let encryptedBase64;

    if (encryptedData) {
        encryptedBase64 = encryptedData;
    } else {
        const filePath = path.join(ENCRYPTED_IMAGE_DIR, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Encrypted image not found' });
        }

        const fileContent = await fs.promises.readFile(filePath, 'utf8');
        const encryptedMatch = fileContent.match(/const encrypted = "(.+?)";/);

        if (!encryptedMatch) {
            return res.status(400).json({ error: 'Invalid encrypted file format' });
        }

        encryptedBase64 = encryptedMatch[1];
    }

    const decryptedBuffer = decryptImageBuffer(encryptedBase64, password);

    const ext = filename ? path.extname(filename.replace('.en', '')) : '.png';
    const mimeType = extensionToMimeType(ext);

    res.set('Content-Type', mimeType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(decryptedBuffer);
});

router.get('/decrypt-password', (req, res) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    res.json({ password: DEFAULT_PASSWORD });
});

router.post('/decrypt-password', (req, res) => {
    const apiKey = req.headers['x-api-key'] || req.body?.apiKey;

    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    res.json({ password: DEFAULT_PASSWORD });
});

module.exports = router;
