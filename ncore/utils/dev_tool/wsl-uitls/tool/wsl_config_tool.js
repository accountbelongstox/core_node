const Base = require('#@/ncore/utils/dev_tool/lang_compiler_deploy/libs/base_utils.js');
    const os = require('os');
    const fs = require('fs');
    const path = require('path');

    class WSLConfigTool extends Base {
        constructor() {
            super();
        }

        isWSLConfigExists() {
            if (this.isWindows()) {
                const homeDir = os.homedir();
                const configFilePath = path.join(homeDir, '.wslconfig');

                try {
                    return fs.existsSync(configFilePath);
                } catch (error) {
                    this.error('Error checking WSL config file:', error);
                    return false;
                }
            } else {
                this.warn('WSL config file check is only applicable on Windows.');
                return false;
            }
        }

        isSectionExists(sectionName) {
            if (!this.isWSLConfigExists()) {
                this.warn('.wslconfig file does not exist.');
                return false;
            }

            const homeDir = os.homedir();
            const configFilePath = path.join(homeDir, '.wslconfig');

            try {
                const fileContent = fs.readFileSync(configFilePath, 'utf-8');
                const sectionPattern = new RegExp(`^\\[${sectionName}\\]`, 'm');
                return sectionPattern.test(fileContent);
            } catch (error) {
                this.error('Error reading WSL config file:', error);
                return false;
            }
        }

        isKeyInSection(sectionName, key) {
            if (!this.isSectionExists(sectionName)) {
                this.warn(`Section [${sectionName}] does not exist.`);
                return false;
            }

            const homeDir = os.homedir();
            const configFilePath = path.join(homeDir, '.wslconfig');

            try {
                const fileContent = fs.readFileSync(configFilePath, 'utf-8');
                const sectionPattern = new RegExp(`^\\[${sectionName}\\][\\s\\S]*?^${key}=`, 'm');
                return sectionPattern.test(fileContent);
            } catch (error) {
                this.error(`Error checking key "${key}" in section [${sectionName}]:`, error);
                return false;
            }
        }
    }

    module.exports = new WSLConfigTool();