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

'use strict';

const logger = require('#@logger');

class BaseUtils {
    constructor() {
        this.defaultTimeout = 30000;
        this.defaultRetries = 3;
        this.defaultDelay = 1000;
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async safeExecute(page, operation, options = {}) {
        const retries = options.retries || this.defaultRetries;
        const timeout = options.timeout || this.defaultTimeout;
        const delay = options.delay || this.defaultDelay;

        for (let i = 0; i < retries; i++) {
            try {
                const result = await Promise.race([
                    operation(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Operation timeout')), timeout)
                    )
                ]);
                return result;
            } catch (error) {
                logger.warn(`Operation attempt ${i + 1} failed:`, error.message);
                if (i < retries - 1) {
                    await this.wait(delay);
                }
            }
        }
        throw new Error(`Operation failed after ${retries} attempts`);
    }

    async retry(operation, options = {}) {
        const retries = options.retries || this.defaultRetries;
        const delay = options.delay || this.defaultDelay;
        const backoff = options.backoff || 1;

        for (let i = 0; i < retries; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === retries - 1) {
                    throw error;
                }
                const waitTime = delay * Math.pow(backoff, i);
                await this.wait(waitTime);
            }
        }
    }

    async timeout(operation, ms) {
        return Promise.race([
            operation(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Operation timeout')), ms)
            )
        ]);
    }

    createTimeoutPromise(ms, message = 'Timeout') {
        return new Promise((_, reject) => 
            setTimeout(() => reject(new Error(message)), ms)
        );
    }

    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    sanitizeSelector(selector) {
        if (typeof selector !== 'string') {
            throw new Error('Selector must be a string');
        }
        return selector.trim();
    }

    generateRandomId() {
        return Math.random().toString(36).substr(2, 9);
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    debounce(func, wait) {
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

    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

module.exports = BaseUtils;
