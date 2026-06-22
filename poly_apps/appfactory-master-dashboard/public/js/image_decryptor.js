/**
 * Image Decryptor - Frontend Image Decryption Library
 *
 * Logic Pair: This file is the FRONTEND decryption logic.
 * Backend Pair: /scripts/_daemon_tools/image_encryptor.cjs
 *
 * Algorithm: XOR decryption (same as encryption)
 * - XOR encryption is symmetric: encrypt(data, key) = decrypt(data, key)
 * - Any password can decrypt, wrong password produces garbage
 * - Works with encrypted images from backend
 *
 * Usage:
 *   const decryptor = new ImageDecryptor({ password: 'yourpassword' });
 *   const imageBlob = await decryptor.decryptImage(encryptedBase64);
 *   const imageUrl = URL.createObjectURL(imageBlob);
 *
 * Password Sources (priority order):
 *   1. GET parameter: ?password=xxx, ?pwd=xxx, or ?pp=xxx (HashRouter: params in hash)
 *   2. Constructor parameter: new ImageDecryptor({ password: 'xxx' })
 *   3. Constants file: window.DECRYPT_PASSWORD or window.APP_CONFIG.decryptPassword
 *   4. API request: fetch('/api/decrypt-password')
 * 
 * Default Password: Empty string '' (no hardcoded password)
 * Password must be provided via GET parameter for security.
 */

class ImageDecryptor {
    constructor(options = {}) {
        // Default password is empty string, must be provided via GET parameter
        this.password = options.password ?? '';
        this.passwordSource = options.passwordSource || 'default';
    }

    get DEFAULT_PASSWORD() {
        // No hardcoded password, must be provided via GET parameter
        return '';
    }

    async initializePassword() {
        switch (this.passwordSource) {
            case 'url':
                // Get password from URL GET parameter, default to empty string
                this.password = this.getPasswordFromURL() ?? '';
                break;

            case 'api':
                // Get password from API, default to empty string
                this.password = await this.getPasswordFromAPI() ?? '';
                break;

            case 'constants':
                // Get password from constants, default to empty string
                this.password = await this.getPasswordFromConstants() ?? '';
                break;

            default:
                // Default to empty string if no password source specified
                this.password = '';
                break;
        }

        return this.password;
    }

    getPasswordFromURL() {
        // HashRouter: params are in hash after ?
        // Get password from GET parameters: ?password=xxx, ?pwd=xxx, or ?pp=xxx
        // Returns empty string if no password parameter found
        const hashParts = window.location.hash.split('?');
        const queryString = hashParts.length > 1 ? hashParts[1] : '';
        const urlParams = new URLSearchParams(queryString);
        return urlParams.get('password') || urlParams.get('pwd') || urlParams.get('pp') || '';
    }

    async getPasswordFromAPI() {
        const response = await fetch('/api/decrypt-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            return data.password;
        }

        return null;
    }

    async getPasswordFromConstants() {
        if (typeof window.DECRYPT_PASSWORD !== 'undefined') {
            return window.DECRYPT_PASSWORD;
        }

        if (typeof window.APP_CONFIG !== 'undefined' && window.APP_CONFIG.decryptPassword) {
            return window.APP_CONFIG.decryptPassword;
        }

        return null;
    }

    xorDecrypt(data, password) {
        const passwordBytes = new TextEncoder().encode(password);
        const result = new Uint8Array(data.length);

        for (let i = 0; i < data.length; i++) {
            result[i] = data[i] ^ passwordBytes[i % passwordBytes.length];
        }

        return result;
    }

    base64ToUint8Array(base64) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);

        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return bytes;
    }

    async decryptImage(encryptedBase64, mimeType = 'image/png') {
        const encryptedBytes = this.base64ToUint8Array(encryptedBase64);
        const decryptedBytes = this.xorDecrypt(encryptedBytes, this.password);

        return new Blob([decryptedBytes], { type: mimeType });
    }

    async decryptBinaryImage(encryptedArrayBuffer, mimeType = 'image/png') {
        const encryptedBytes = new Uint8Array(encryptedArrayBuffer);
        const decryptedBytes = this.xorDecrypt(encryptedBytes, this.password);

        return new Blob([decryptedBytes], { type: mimeType });
    }

    async loadAndDecryptBinaryFile(filePath, extension = '.png') {
        const response = await fetch(filePath);

        if (!response.ok) {
            throw new Error(`Failed to load encrypted file: ${filePath} (${response.status})`);
        }

        const encryptedData = await response.arrayBuffer();
        const mimeType = this.extensionToMimeType(extension);

        return await this.decryptBinaryImage(encryptedData, mimeType);
    }

    async loadAndDecryptBinaryFileToURL(filePath, extension = '.png') {
        const blob = await this.loadAndDecryptBinaryFile(filePath, extension);
        return URL.createObjectURL(blob);
    }

    async decryptImageToURL(encryptedBase64, mimeType = 'image/png') {
        const blob = await this.decryptImage(encryptedBase64, mimeType);
        return URL.createObjectURL(blob);
    }

    async decryptImageElement(imgElement, encryptedBase64, extension = '.png') {
        const mimeType = this.extensionToMimeType(extension);
        const imageUrl = await this.decryptImageToURL(encryptedBase64, mimeType);

        imgElement.src = imageUrl;

        imgElement.addEventListener('load', () => {
            URL.revokeObjectURL(imageUrl);
        }, { once: true });

        return imgElement;
    }

    extensionToMimeType(extension) {
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

        return mimeTypes[extension.toLowerCase()] || 'image/png';
    }

    async decryptFromEncryptedFile(encryptedFileModule) {
        if (!encryptedFileModule.encrypted) {
            throw new Error('Invalid encrypted file module');
        }

        const mimeType = encryptedFileModule.metadata?.extension
            ? this.extensionToMimeType(encryptedFileModule.metadata.extension)
            : 'image/png';

        return await this.decryptImageToURL(encryptedFileModule.encrypted, mimeType);
    }

    setPassword(newPassword) {
        this.password = newPassword;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageDecryptor;
}

if (typeof window !== 'undefined') {
    window.ImageDecryptor = ImageDecryptor;
}
