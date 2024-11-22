import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ConfigManager {
    constructor(configName = "mainconf", configSpace = "dd_electron_userdata") {
        this.userDataDir = path.join(os.homedir(), 'AppData', 'Local', configSpace);
        this.ensureDirectoryExists(this.userDataDir);
        
        this.tempPrefix = 'temp_conf_';
        this.configFile = path.join(this.userDataDir, `${configName}.json`);
        this.config = this.loadConfig();
    }

    loadConfig(filePath = null) {
        filePath = filePath || this.configFile;
        this.ensureConfigFile(filePath);
        
        try {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Failed to read config:', error.message);
            return {};
        }
    }

    saveConfig(filePath = null) {
        filePath = filePath || this.configFile;
        const baseDir = path.dirname(filePath);
        this.ensureDirectoryExists(baseDir);

        try {
            const data = JSON.stringify(this.config, null, 2);
            fs.writeFileSync(filePath, data, 'utf-8');
            return true;
        } catch (error) {
            console.error('Failed to save config:', error.message);
            return false;
        }
    }

    getValue(key, defaultConfigFile = null) {
        if (defaultConfigFile) {
            const defaultConfig = this.loadConfig(defaultConfigFile);
            return defaultConfig[key] ?? null;
        }
        return this.config[key] ?? null;
    }

    setValue(key, value, configFile = null) {
        if (configFile) {
            const config = this.loadConfig(configFile);
            config[key] = value;
            this.saveConfig(configFile);
        } else {
            this.config[key] = value;
            this.saveConfig();
        }
    }

    deleteValue(key) {
        if (key in this.config) {
            delete this.config[key];
            this.saveConfig();
            return true;
        }
        return false;
    }

    getNestedValue(keyPath, defaultValue = null) {
        let current = this.config;
        for (const key of keyPath) {
            if (!(key in current)) return defaultValue;
            current = current[key];
        }
        return current;
    }

    setNestedValue(keyPath, value) {
        let current = this.config;
        for (let i = 0; i < keyPath.length - 1; i++) {
            const key = keyPath[i];
            if (!(key in current)) current[key] = {};
            current = current[key];
        }
        current[keyPath[keyPath.length - 1]] = value;
        this.saveConfig();
    }

    createTempConfig() {
        const timestamp = Date.now();
        const randomStr = crypto.randomBytes(4).toString('hex');
        const tempFileName = `${this.tempPrefix}${timestamp}_${randomStr}.json`;
        const tempFilePath = path.join(this.userDataDir, tempFileName);
        
        fs.writeFileSync(tempFilePath, '{}', 'utf-8');
        return tempFilePath;
    }

    cleanupTempConfigs(maxAgeHours = 1) {
        const files = fs.readdirSync(this.userDataDir);
        const now = Date.now();
        const maxAge = maxAgeHours * 60 * 60 * 1000;

        files.filter(file => file.startsWith(this.tempPrefix))
             .forEach(file => {
                 const filePath = path.join(this.userDataDir, file);
                 const stats = fs.statSync(filePath);
                 if (now - stats.birthtimeMs > maxAge) {
                     fs.unlinkSync(filePath);
                 }
             });
    }

    mergeConfig(newConfig) {
        const merge = (target, source) => {
            for (const key in source) {
                if (typeof source[key] === 'object' && source[key] !== null) {
                    if (!(key in target)) target[key] = {};
                    merge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        };
        merge(this.config, newConfig);
        this.saveConfig();
    }

    ensureDirectoryExists(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    ensureConfigFile(filePath) {
        if (!fs.existsSync(filePath)) {
            this.ensureDirectoryExists(path.dirname(filePath));
            fs.writeFileSync(filePath, '{}', 'utf-8');
        }
    }

    getConfigPath() {
        return this.configFile;
    }

    getUserDataPath() {
        return this.userDataDir;
    }
}

const configManager = new ConfigManager();
export default configManager;
