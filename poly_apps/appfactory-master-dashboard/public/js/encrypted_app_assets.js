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
 * 
 * Dynamic Decryption:
 * - Extends DynamicDecryptionManager for automatic password change detection
 * - Automatically re-decrypts when URL password parameter changes
 * - Clears cache and reloads images when password changes
 */

class EncryptedAppAssetsManager extends DynamicDecryptionManager {
    constructor(options = {}) {
        super(options);
        
        // Initialize decryptor with current password
        this.password = this.getCurrentPassword();
        this.decryptor = new ImageDecryptor({ password: this.password });
        
        // Store instance globally so React Context can access it
        if (typeof window !== 'undefined') {
            window.__encryptedAssetsManagerInstance = this;
        }

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
    }

    /**
     * Override onPasswordChanged to update decryptor password
     */
    onPasswordChanged(newPassword) {
        console.log(`[EncryptedAppAssetsManager] Password changed, updating decryptor and clearing cache`);
        this.password = newPassword;
        this.decryptor.setPassword(newPassword);
        
        // Call parent to clear cache
        super.onPasswordChanged(newPassword);
    }

    async loadEncryptedFile(filePath) {
        // Check if password has changed (dynamic decryption)
        const currentPassword = this.getCurrentPassword();
        if (currentPassword !== this.password) {
            console.log(`[EncryptedAppAssetsManager] Password changed during load, clearing cache for ${filePath}`);
            this.onPasswordChanged(currentPassword);
        }

        // Create cache key that includes password to prevent using wrong password's cache
        const cacheKey = `${filePath}:${this.password}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        if (this.loading.has(cacheKey)) {
            return this.loading.get(cacheKey);
        }

        const loadPromise = this._loadAndDecrypt(filePath);
        this.loading.set(cacheKey, loadPromise);

        try {
            const result = await loadPromise;
            this.loading.delete(cacheKey);
            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            this.loading.delete(cacheKey);
            throw error;
        }
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
        // Use parent's clearCache which handles blob URL revocation
        this.clearCache();
    }

    setPassword(newPassword) {
        // Use parent's setPassword which handles password change detection
        super.setPassword(newPassword);
    }
}

if (typeof window !== 'undefined') {
    window.EncryptedAppAssetsManager = EncryptedAppAssetsManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EncryptedAppAssetsManager;
}
