/**
 * Utility Functions
 * Common utility functions used across the application
 */

window.Utils = (function() {
    'use strict';

    /**
     * Format number with thousands separator
     * @param {number} num - Number to format
     * @param {number} decimals - Decimal places
     * @returns {string} Formatted number
     */
    function formatNumber(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) {
            return '-';
        }

        return num.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    /**
     * Format price value
     * @param {number} price - Price value
     * @param {number} decimals - Decimal places
     * @returns {string} Formatted price
     */
    function formatPrice(price, decimals = 6) {
        if (price === null || price === undefined || isNaN(price)) {
            return '-';
        }

        // Auto-adjust decimals based on price magnitude
        if (price >= 1000) {
            decimals = 2;
        } else if (price >= 1) {
            decimals = 4;
        } else {
            decimals = 8;
        }

        return formatNumber(price, decimals);
    }

    /**
     * Format percentage change
     * @param {number} change - Change percentage
     * @param {boolean} includeSign - Include + sign for positive values
     * @returns {string} Formatted percentage
     */
    function formatPercent(change, includeSign = true) {
        if (change === null || change === undefined || isNaN(change)) {
            return '-';
        }

        const formatted = change.toFixed(2) + '%';

        if (includeSign && change > 0) {
            return '+' + formatted;
        }

        return formatted;
    }

    /**
     * Get color class for price change
     * @param {number} change - Change value
     * @returns {string} CSS class name
     */
    function getPriceChangeClass(change) {
        if (change === null || change === undefined || isNaN(change)) {
            return 'text-muted';
        }

        if (change > 0) {
            return 'price-up';
        } else if (change < 0) {
            return 'price-down';
        } else {
            return 'price-neutral';
        }
    }

    /**
     * Format timestamp to readable date/time
     * @param {number} timestamp - Unix timestamp (ms)
     * @returns {string} Formatted date/time
     */
    function formatTimestamp(timestamp) {
        if (!timestamp) {
            return '-';
        }

        const date = new Date(timestamp);

        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    /**
     * Format relative time (e.g., "2 minutes ago")
     * @param {number} timestamp - Unix timestamp (ms)
     * @returns {string} Relative time string
     */
    function formatRelativeTime(timestamp) {
        if (!timestamp) {
            return 'Never';
        }

        const now = Date.now();
        const diff = now - timestamp;

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
        }
    }

    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(func, wait) {
        let timeout;

        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };

            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    function throttle(func, limit) {
        let inThrottle;

        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Deep clone object
     * @param {object} obj - Object to clone
     * @returns {object} Cloned object
     */
    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    function generateId() {
        return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Check if value is empty
     * @param {*} value - Value to check
     * @returns {boolean} True if empty
     */
    function isEmpty(value) {
        return value === null ||
               value === undefined ||
               value === '' ||
               (Array.isArray(value) && value.length === 0) ||
               (typeof value === 'object' && Object.keys(value).length === 0);
    }

    /**
     * Safe JSON parse
     * @param {string} jsonString - JSON string
     * @param {*} defaultValue - Default value if parse fails
     * @returns {*} Parsed value or default
     */
    function safeJsonParse(jsonString, defaultValue = null) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('[Utils] JSON parse error:', error);
            return defaultValue;
        }
    }

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} Success status
     */
    async function copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            }
        } catch (error) {
            console.error('[Utils] Copy to clipboard error:', error);
            return false;
        }
    }

    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, warning, info)
     * @param {number} duration - Duration in milliseconds
     */
    function showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 15px 20px;
            background: var(--bg-secondary);
            border-left: 4px solid var(--accent-${type === 'error' ? 'danger' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'info'});
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, duration);
    }

    /**
     * Download data as file
     * @param {string} content - File content
     * @param {string} filename - File name
     * @param {string} mimeType - MIME type
     */
    function downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Public API
    return {
        formatNumber,
        formatPrice,
        formatPercent,
        getPriceChangeClass,
        formatTimestamp,
        formatRelativeTime,
        debounce,
        throttle,
        deepClone,
        escapeHtml,
        generateId,
        isEmpty,
        safeJsonParse,
        copyToClipboard,
        showNotification,
        downloadFile
    };
})();

console.log('[Utils] Utility functions loaded');
