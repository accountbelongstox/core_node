/**
 * Dynamic Decryption Manager - Base Class for Dynamic Password-Based Decryption
 * 
 * This class provides dynamic decryption capabilities that automatically
 * re-decrypts data when the password changes in the URL.
 * 
 * Features:
 * - Monitors URL hash changes for password parameters
 * - Automatically clears cache and re-decrypts when password changes
 * - Supports multiple password parameter names: password, pwd, pp
 * - HashRouter compatible (parameters in hash after ?)
 * 
 * Usage:
 *   class MyDecryptor extends DynamicDecryptionManager {
 *     async decryptData(data, password) {
 *       // Your decryption logic
 *     }
 *   }
 */

class DynamicDecryptionManager {
    constructor(options = {}) {
        this.cache = new Map();
        this.loading = new Map();
        this.currentPassword = this.getPasswordFromURL();
        this.passwordChangeCallbacks = new Set();
        
        // Note: Password change detection is now handled by React Context (PasswordContext)
        // React Router's useLocation hook automatically triggers re-renders when route changes
        // No need for manual event listeners or intervals
    }

    /**
     * Get password from URL GET parameters
     * Supports: ?password=xxx, ?pwd=xxx, ?pp=xxx
     * HashRouter: parameters are in hash after ?
     */
    getPasswordFromURL() {
        if (typeof window === 'undefined') {
            return '';
        }

        const hashParts = window.location.hash.split('?');
        const queryString = hashParts.length > 1 ? hashParts[1] : '';
        const urlParams = new URLSearchParams(queryString);
        
        return urlParams.get('password') || urlParams.get('pwd') || urlParams.get('pp') || '';
    }

    /**
     * Check if password has changed and handle it
     * Called by React Context when password changes (no manual event listeners needed)
     */
    handlePasswordChange() {
        const newPassword = this.getPasswordFromURL();
        
        if (newPassword !== this.currentPassword) {
            console.log(`[DynamicDecryptionManager] Password changed: "${this.currentPassword}" -> "${newPassword}"`);
            this.currentPassword = newPassword;
            this.onPasswordChanged(newPassword);
        }
    }

    /**
     * Called when password changes - override in subclasses
     */
    onPasswordChanged(newPassword) {
        // Clear cache when password changes
        this.clearCache();
        
        // Notify registered callbacks
        this.passwordChangeCallbacks.forEach(callback => {
            try {
                callback(newPassword);
            } catch (error) {
                console.error('[DynamicDecryptionManager] Error in password change callback:', error);
            }
        });
    }

    /**
     * Register a callback for password changes
     */
    onPasswordChange(callback) {
        this.passwordChangeCallbacks.add(callback);
        
        // Return unsubscribe function
        return () => {
            this.passwordChangeCallbacks.delete(callback);
        };
    }

    /**
     * Clear all cached decrypted data
     */
    clearCache() {
        // Revoke all blob URLs before clearing
        for (const asset of this.cache.values()) {
            if (asset && asset.blobUrl && typeof URL !== 'undefined') {
                try {
                    URL.revokeObjectURL(asset.blobUrl);
                } catch (error) {
                    console.warn('[DynamicDecryptionManager] Error revoking blob URL:', error);
                }
            }
        }
        
        this.cache.clear();
        this.loading.clear();
    }

    /**
     * Get current password
     */
    getCurrentPassword() {
        return this.currentPassword;
    }

    /**
     * Manually set password (will trigger cache clear)
     */
    setPassword(newPassword) {
        if (newPassword !== this.currentPassword) {
            this.currentPassword = newPassword;
            this.onPasswordChanged(newPassword);
        }
    }

    /**
     * Cleanup - call this when destroying the instance
     * Note: No event listeners to clean up - React Context handles password changes
     */
    destroy() {
        this.clearCache();
        this.passwordChangeCallbacks.clear();
    }
}

if (typeof window !== 'undefined') {
    window.DynamicDecryptionManager = DynamicDecryptionManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DynamicDecryptionManager;
}

