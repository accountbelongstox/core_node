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
    const { gdir, appConfDir } = require('#@global_vars');
    const gconfig = require('#@gconfig');

    const localDir = gconfig.localDir;
    const publicConfigFile = path.join(localDir, 'config.json');
    const appConfigFile = path.join(appConfDir, 'config.json');
    const publicConfigDir = path.join(localDir, '.info');
    const appConfigDir = path.join(appConfDir, '.info');
    function mkdir(dirPath) {
        return fs.mkdirSync(dirPath, { recursive: true });
    }

    class Conf {
        constructor() {
            this.prefix = '';
            mkdir(localDir);
            mkdir(appConfDir);
            this.ensureFileExists(publicConfigFile);
            this.ensureFileExists(appConfigFile);
        }

        ensureFileExists(filePath) {
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, JSON.stringify({}));
            }
        }

        ensureDirExists(dirPath) {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        }

        readConfig(filePath) {
            this.ensureFileExists(filePath);
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        writeConfig(filePath, config) {
            fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
        }

        addConfig(filePath, key, value) {
            const config = this.readConfig(filePath);
            config[key] = value;
            this.writeConfig(filePath, config);
        }

        hasConfig(filePath, key) {
            const config = this.readConfig(filePath);
            return key in config;
        }

        getConfig(filePath, key) {
            const config = this.readConfig(filePath);
            return config[key];
        }

        deleteConfig(filePath, key) {
            const config = this.readConfig(filePath);
            delete config[key];
            this.writeConfig(filePath, config);
        }

        addConfigFile(dirPath, key, value) {
            this.ensureDirExists(dirPath);
            if (!key.startsWith('.')) {
                key = `.${key}`;
            }
            const filePath = path.join(dirPath, key);
            fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
        }

        hasConfigFile(dirPath, key) {
            if (!key.startsWith('.')) {
                key = `.${key}`;
            }
            const filePath = path.join(dirPath, key);
            return fs.existsSync(filePath);
        }

        getConfigFile(dirPath, key) {
            if (!key.startsWith('.')) {
                key = `.${key}`;
            }
            const filePath = path.join(dirPath, key);
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
            return null;
        }

        deleteConfigFile(dirPath, key) {
            if (!key.startsWith('.')) {
                key = `.${key}`;
            }
            const filePath = path.join(dirPath, key);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        addPublicConfig(key, value) {
            this.addConfig(publicConfigFile, key, value);
        }

        hasPublicConfig(key) {
            return this.hasConfig(publicConfigFile, key);
        }

        getPublicConfig(key) {
            return this.getConfig(publicConfigFile, key);
        }

        deletePublicConfig(key) {
            this.deleteConfig(publicConfigFile, key);
        }

        addAppConfig(key, value) {
            this.addConfig(appConfigFile, key, value);
        }

        hasAppConfig(key) {
            return this.hasConfig(appConfigFile, key);
        }

        getAppConfig(key) {
            return this.getConfig(appConfigFile, key);
        }

        deleteAppConfig(key) {
            this.deleteConfig(appConfigFile, key);
        }

        addPublicConfigFile(key, value) {
            this.addConfigFile(publicConfigDir, key, value);
        }

        hasPublicConfigFile(key) {
            return this.hasConfigFile(publicConfigDir, key);
        }

        getPublicConfigFile(key) {
            return this.getConfigFile(publicConfigDir, key);
        }

        deletePublicConfigFile(key) {
            this.deleteConfigFile(publicConfigDir, key);
        }

        addAppConfigFile(key, value) {
            this.addConfigFile(appConfigDir, key, value);
        }

        hasAppConfigFile(key) {
            return this.hasConfigFile(appConfigDir, key);
        }

        getAppConfigFile(key) {
            return this.getConfigFile(appConfigDir, key);
        }

        deleteAppConfigFile(key) {
            this.deleteConfigFile(appConfigDir, key);
        }
    }

    module.exports = new Conf();