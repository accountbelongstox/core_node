/**
 * Encrypted App Assets Manager
 *
 * Logic Pair:
 * - Backend Encryption: /scripts/_daemon_tools/image_encryptor.cjs
 * - Frontend Decryption: /public/js/image_decryptor.js
 *
 * 硬编码的 10 个加密图片文件：
 * Icons: app_icon1-5.en.js
 * Splashes: app_splash1-5.en.js
 *
 * 约定目录: /public/encrypted_assets/
 */

class EncryptedAppAssetsManager {
    constructor(options = {}) {
        // 从 URL GET 参数获取密码，默认空字符串
        const urlParams = new URLSearchParams(window.location.search);
        this.password = urlParams.get('password') || urlParams.get('pwd') || urlParams.get('pp') || '';

        this.decryptor = new ImageDecryptor({ password: this.password });

        // Hardcoded file paths (cannot dynamically scan)
        // Files are in encrypted_assets/ directory (mapped from build dist/public)
        this.ENCRYPTED_ASSETS = {
            icons: [
                '/encrypted_assets/app_icon1.en.js',
                '/encrypted_assets/app_icon2.en.js',
                '/encrypted_assets/app_icon3.en.js',
                '/encrypted_assets/app_icon4.en.js',
                '/encrypted_assets/app_icon5.en.js'
            ],
            splashes: [
                '/encrypted_assets/app_splash1.en.js',
                '/encrypted_assets/app_splash2.en.js',
                '/encrypted_assets/app_splash3.en.js',
                '/encrypted_assets/app_splash4.en.js',
                '/encrypted_assets/app_splash5.en.js'
            ]
        };

        this.cache = new Map();
        this.loading = new Map();
    }

    async loadEncryptedFile(filePath) {
        if (this.cache.has(filePath)) {
            return this.cache.get(filePath);
        }

        if (this.loading.has(filePath)) {
            return this.loading.get(filePath);
        }

        const loadPromise = this._loadAndDecrypt(filePath);
        this.loading.set(filePath, loadPromise);

        const result = await loadPromise;
        this.loading.delete(filePath);
        this.cache.set(filePath, result);

        return result;
    }

    async _loadAndDecrypt(filePath) {
        const response = await fetch(filePath);

        if (!response.ok) {
            throw new Error(`Failed to load ${filePath}: ${response.status}`);
        }

        const fileContent = await response.text();

        const encryptedMatch = fileContent.match(/const encrypted = "(.+?)";/);
        if (!encryptedMatch) {
            throw new Error(`Invalid encrypted file format: ${filePath}`);
        }

        const metadataMatch = fileContent.match(/const metadata = (\{[\s\S]+?\});/);
        let extension = '.png';
        if (metadataMatch) {
            const metadata = JSON.parse(metadataMatch[1]);
            extension = metadata.extension || '.png';
        }

        const encryptedData = encryptedMatch[1];
        const imageUrl = await this.decryptor.decryptImageToURL(encryptedData, this.decryptor.extensionToMimeType(extension));

        const originalName = filePath.replace('.en.js', extension);

        return {
            filePath: filePath,
            originalName: originalName,
            blobUrl: imageUrl
        };
    }

    async loadIcon(index) {
        if (index < 1 || index > 5) {
            throw new Error('Icon index must be between 1 and 5');
        }

        return await this.loadEncryptedFile(this.ENCRYPTED_ASSETS.icons[index - 1]);
    }

    async loadSplash(index) {
        if (index < 1 || index > 5) {
            throw new Error('Splash index must be between 1 and 5');
        }

        return await this.loadEncryptedFile(this.ENCRYPTED_ASSETS.splashes[index - 1]);
    }

    async loadAllIcons() {
        const promises = this.ENCRYPTED_ASSETS.icons.map(filePath =>
            this.loadEncryptedFile(filePath)
        );

        return await Promise.all(promises);
    }

    async loadAllSplashes() {
        const promises = this.ENCRYPTED_ASSETS.splashes.map(filePath =>
            this.loadEncryptedFile(filePath)
        );

        return await Promise.all(promises);
    }

    async loadAll() {
        const [icons, splashes] = await Promise.all([
            this.loadAllIcons(),
            this.loadAllSplashes()
        ]);

        return { icons, splashes };
    }

    async applyToImageElement(imgElement, index, type = 'icon') {
        const asset = type === 'icon'
            ? await this.loadIcon(index)
            : await this.loadSplash(index);

        imgElement.src = asset.blobUrl;
        return imgElement;
    }

    revokeAllUrls() {
        for (const asset of this.cache.values()) {
            if (asset.blobUrl) {
                URL.revokeObjectURL(asset.blobUrl);
            }
        }
        this.cache.clear();
    }

    setPassword(newPassword) {
        this.password = newPassword;
        this.decryptor.setPassword(newPassword);
        this.cache.clear();
    }
}

if (typeof window !== 'undefined') {
    window.EncryptedAppAssetsManager = EncryptedAppAssetsManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EncryptedAppAssetsManager;
}
