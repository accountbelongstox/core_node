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

const Base = require('#@/ncore/utils/dev_tool/lang_deploy/libs/base_utils.js');
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