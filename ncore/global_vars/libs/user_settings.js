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

const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('#@logger');

class UserSettings {
    constructor() {
        // Determine OS and set appropriate paths
        this.isWindows = process.platform === 'win32';
        
        if (this.isWindows) {
            this.configDir = path.join(os.homedir(), '.core_node');
            this.configFile = path.join(this.configDir, 'settings.json');
            this.syncDir = path.join(this.configDir, '.sync');
        } else {
            this.configDir = path.join(os.homedir(), '.core_node');
            this.configFile = path.join(this.configDir, 'settings.json');
            this.syncDir = path.join(this.configDir, '.sync');
        }

        this.ensureDirectories();
    }

    // Ensure required directories exist
    ensureDirectories() {
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
        if (!fs.existsSync(this.syncDir)) {
            fs.mkdirSync(this.syncDir, { recursive: true });
        }
    }

    // Load settings from JSON file
    loadSettings() {
        try {
            if (fs.existsSync(this.configFile)) {
                return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
            }
            return {};
        } catch (error) {
            logger.error('Error loading settings:', error);
            return {};
        }
    }

    /**
     * Save settings to JSON file
     * @param {Object} settings - Settings object to save
     */
    saveSettings(settings) {
        try {
            fs.writeFileSync(this.configFile, JSON.stringify(settings, null, 2));
        } catch (error) {
            logger.error('Error saving settings:', error);
        }
    }

    // Sync key-value to file system
    syncToFile(key, value) {
        try {
            const filePath = path.join(this.syncDir, key);
            if (value === undefined) {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } else {
                fs.writeFileSync(filePath, String(value), 'utf8');
            }
        } catch (error) {
            logger.error(`Error syncing key ${key}:`, error);
        }
    }

    // Check if a key exists
    hasKey(key) {
        const settings = this.loadSettings();
        return key in settings;
    }

    // Set a key (add if not exists, default value is TRUE)
    setKey(key, value = true) {
        const settings = this.loadSettings();
        settings[key] = value;
        this.saveSettings(settings);
        this.syncToFile(key, value);
    }

    // Delete a key
    deleteKey(key) {
        const settings = this.loadSettings();
        if (key in settings) {
            delete settings[key];
            this.saveSettings(settings);
            this.syncToFile(key);
            return true;
        }
        return false;
    }

    // Check and add key if not exists (returns false if key didn't exist)
    checkAndAddKey(key, value = true) {
        const exists = this.hasKey(key);
        if (!exists) {
            this.setKey(key, value);
        }
        return exists;
    }

    // Check and delete key (returns true if key existed and was deleted)
    checkAndDeleteKey(key) {
        return this.deleteKey(key);
    }

    // Get value of a key
    getValue(key) {
        const settings = this.loadSettings();
        return settings[key];
    }

    /**
     * Check and append a value to an array, create array if key doesn't exist
     * @param {string} key - Key to check
     * @param {any} value - Value to append
     * @param {boolean} [unique=true] - Ensure value uniqueness (default true)
     * @returns {boolean} - Returns true if value was appended, false if value already exists
     */
    checkAndAppendValue(key, value, unique = true) {
        try {
            const settings = this.loadSettings();
            let currentValue = settings[key];
            
            // Create new array if key doesn't exist or value is not an array
            if (!currentValue || !Array.isArray(currentValue)) {
                currentValue = [];
            }

            // Check if we need to ensure uniqueness
            if (unique && currentValue.includes(value)) {
                return false;
            }

            // Append new value
            currentValue.push(value);
            settings[key] = currentValue;
            this.saveSettings(settings);
            return true;
        } catch (error) {
            logger.error(`Error in checkAndAppendValue for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Check and append multiple values to an array
     * @param {string} key - Key to check
     * @param {Array} values - Array of values to append
     * @param {boolean} [unique=true] - Ensure value uniqueness (default true)
     * @returns {number} - Returns number of successfully appended values
     */
    checkAndAppendValues(key, values, unique = true) {
        if (!Array.isArray(values)) {
            logger.error('Values parameter must be an array');
            return 0;
        }

        let appendedCount = 0;
        try {
            const settings = this.loadSettings();
            let currentValue = settings[key];
            
            // Create new array if key doesn't exist or value is not an array
            if (!currentValue || !Array.isArray(currentValue)) {
                currentValue = [];
            }

            // Process each value
            values.forEach(value => {
                // Check if we need to ensure uniqueness
                if (!unique || !currentValue.includes(value)) {
                    currentValue.push(value);
                    appendedCount++;
                }
            });

            // Only update if new values were appended
            if (appendedCount > 0) {
                settings[key] = currentValue;
                this.saveSettings(settings);
            }

            return appendedCount;
        } catch (error) {
            logger.error(`Error in checkAndAppendValues for key ${key}:`, error);
            return appendedCount;
        }
    }

    /**
     * Replace or create a value for a key in settings
     * @param {string} key - The key to replace or create
     * @param {any} value - The new value
     * @returns {boolean} - Returns true if successful
     */
    replace(key, value) {
        try {
            const settings = this.loadSettings();
            
            // Create nested objects if key contains dots
            const keys = key.split('.');
            let current = settings;
            
            // Navigate to the parent object
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }

            // Set the value at the final key
            const finalKey = keys[keys.length - 1];
            current[finalKey] = value;

            // Save the updated settings
            fs.writeFileSync(this.configFile, JSON.stringify(settings, null, 2));
            
            return true;
        } catch (error) {
            logger.error(`Failed to replace value for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Show settings for a specific key or all settings
     * @param {string} [key] - Optional key to show specific settings
     */
    show(key = null) {
        try {
            const settings = this.loadSettings();
            
            if (key) {
                // Show specific key
                const keys = key.split('.');
                let value = settings;
                
                // Navigate through nested objects
                for (const k of keys) {
                    if (value === undefined || value === null) {
                        logger.warn(`Key not found: ${key}`);
                        return;
                    }
                    value = value[k];
                }

                if (value === undefined || value === null) {
                    logger.warn(`No value found for key: ${key}`);
                    return;
                }

                logger.info(`\nSettings for ${key}:`);
                if (Array.isArray(value)) {
                    value.forEach((item, index) => {
                        logger.info(`  ${index + 1}. ${item}`);
                    });
                } else if (typeof value === 'object') {
                    logger.info(JSON.stringify(value, null, 2).split('\n').map(line => '  ' + line).join('\n'));
                } else {
                    logger.info(`  ${value}`);
                }
            } else {
                // Show all settings
                logger.info('\nAll Settings:');
                logger.info(JSON.stringify(settings, null, 2).split('\n').map(line => '  ' + line).join('\n'));
            }
        } catch (error) {
            logger.error('Error showing settings:', error);
        }
    }
}

module.exports = new UserSettings(); 