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

class Logger {
    constructor(options = {}) {
        this.level = options.level || 'info';
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        this.enabled = options.enabled !== false;
        this.prefix = options.prefix || '';
    }

    log(level, message, ...args) {
        if (!this.enabled || this.levels[level] > this.levels[this.level]) {
            return;
        }

        const timestamp = new Date().toISOString();
        const prefix = this.prefix ? `[${this.prefix}]` : '';
        const logMessage = `${timestamp} ${prefix} [${level.toUpperCase()}] ${message}`;
        
        console.log(logMessage, ...args);
    }

    error(message, ...args) {
        this.log('error', message, ...args);
    }

    warn(message, ...args) {
        this.log('warn', message, ...args);
    }

    info(message, ...args) {
        this.log('info', message, ...args);
    }

    debug(message, ...args) {
        this.log('debug', message, ...args);
    }

    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.level = level;
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    setPrefix(prefix) {
        this.prefix = prefix;
    }
}

class Validator {
    static isString(value) {
        return typeof value === 'string';
    }

    static isNumber(value) {
        return typeof value === 'number' && !isNaN(value);
    }

    static isBoolean(value) {
        return typeof value === 'boolean';
    }

    static isObject(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    static isArray(value) {
        return Array.isArray(value);
    }

    static isFunction(value) {
        return typeof value === 'function';
    }

    static isUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static isEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static isNotEmpty(value) {
        if (typeof value === 'string') {
            return value.trim().length > 0;
        }
        if (Array.isArray(value)) {
            return value.length > 0;
        }
        if (typeof value === 'object' && value !== null) {
            return Object.keys(value).length > 0;
        }
        return value != null;
    }

    static validateConfig(config, schema) {
        const errors = [];
        
        for (const [key, rules] of Object.entries(schema)) {
            const value = config[key];
            
            if (rules.required && (value === undefined || value === null)) {
                errors.push(`Required field '${key}' is missing`);
                continue;
            }
            
            if (value !== undefined && value !== null) {
                if (rules.type && typeof value !== rules.type) {
                    errors.push(`Field '${key}' must be of type ${rules.type}`);
                }
                
                if (rules.min && value < rules.min) {
                    errors.push(`Field '${key}' must be at least ${rules.min}`);
                }
                
                if (rules.max && value > rules.max) {
                    errors.push(`Field '${key}' must be at most ${rules.max}`);
                }
                
                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`Field '${key}' does not match required pattern`);
                }
                
                if (rules.validator && !rules.validator(value)) {
                    errors.push(`Field '${key}' failed custom validation`);
                }
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
}

class RetryHandler {
    constructor(options = {}) {
        this.maxAttempts = options.maxAttempts || 3;
        this.delay = options.delay || 1000;
        this.backoff = options.backoff || 1.5;
        this.maxDelay = options.maxDelay || 10000;
        this.retryCondition = options.retryCondition || (() => true);
    }

    async execute(fn, ...args) {
        let lastError;
        let currentDelay = this.delay;
        
        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            try {
                const result = await fn(...args);
                return result;
            } catch (error) {
                lastError = error;
                
                if (attempt === this.maxAttempts || !this.retryCondition(error)) {
                    throw error;
                }
                
                logger.warn(`Attempt ${attempt} failed, retrying in ${currentDelay}ms:`, error.message);
                await this.sleep(currentDelay);
                
                currentDelay = Math.min(currentDelay * this.backoff, this.maxDelay);
            }
        }
        
        throw lastError;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static create(options = {}) {
        return new RetryHandler(options);
    }
}

class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.timers = new Map();
    }

    startTimer(name) {
        this.timers.set(name, Date.now());
    }

    endTimer(name) {
        const startTime = this.timers.get(name);
        if (startTime) {
            const duration = Date.now() - startTime;
            this.timers.delete(name);
            this.recordMetric(name, duration);
            return duration;
        }
        return null;
    }

    recordMetric(name, value) {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }
        this.metrics.get(name).push({
            value: value,
            timestamp: Date.now()
        });
    }

    getMetric(name) {
        const values = this.metrics.get(name) || [];
        if (values.length === 0) {
            return null;
        }
        
        const numbers = values.map(v => v.value);
        return {
            count: numbers.length,
            min: Math.min(...numbers),
            max: Math.max(...numbers),
            avg: numbers.reduce((a, b) => a + b, 0) / numbers.length,
            latest: numbers[numbers.length - 1]
        };
    }

    getAllMetrics() {
        const result = {};
        for (const [name] of this.metrics) {
            result[name] = this.getMetric(name);
        }
        return result;
    }

    clearMetrics() {
        this.metrics.clear();
        this.timers.clear();
    }
}

module.exports = {
    Logger,
    Validator,
    RetryHandler,
    PerformanceMonitor
};
