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

const os = require('os');
const { execCmd, execCmdResultText } = require('#@commander');
const logger = require('#@logger');

class WindowsRegistry {
    constructor() {
        this.isWindows = os.platform() === 'win32';
    }

    async execRegCommand(command) {
        try {
            return await execCmdResultText(command);
        } catch (error) {
            logger.error(`Registry command failed: ${command}`, error);
            return null;
        }
    }

    validateParams(hive, key, name = '', value = '', type = '') {
        const validHives = ['HKLM', 'HKCU', 'HKCR', 'HKU', 'HKCC'];
        if (!validHives.includes(hive)) {
            logger.warn(`Invalid hive: ${hive}. Must be one of ${validHives.join(', ')}`);
            return false;
        }
        if (!key) {
            logger.warn('Registry key cannot be empty.');
            return false;
        }
        if (value && typeof value !== 'string') {
            logger.warn('Registry value must be a string.');
            return false;
        }
        if (type && !['REG_SZ', 'REG_DWORD', 'REG_QWORD', 'REG_BINARY', 'REG_MULTI_SZ', 'REG_EXPAND_SZ'].includes(type)) {
            logger.warn(`Invalid type: ${type}.`);
            return false;
        }
        return true;
    }

    async getValue(hive, key, name) {
        if (!this.isWindows || !this.validateParams(hive, key, name)) return null;
        const command = `reg query "${hive}\\${key}" /v "${name}"`;
        const output = await this.execRegCommand(command);
        if (!output) return null;
        const match = output.match(/\s{2,}([^\s]+)\s{2,}([^\s]+)\s{2,}(.+)/);
        return match ? match[3] : null;
    }

    async setValue(hive, key, name, value, type = 'REG_SZ') {
        if (!this.isWindows || !this.validateParams(hive, key, name, value, type)) return false;
        const command = `reg add "${hive}\\${key}" /v "${name}" /t ${type} /d "${value}" /f`;
        return (await this.execRegCommand(command)) !== null;
    }

    async deleteValue(hive, key, name) {
        if (!this.isWindows || !this.validateParams(hive, key, name)) return false;
        const command = `reg delete "${hive}\\${key}" /v "${name}" /f`;
        return (await this.execRegCommand(command)) !== null;
    }

    async createKey(hive, key) {
        if (!this.isWindows || !this.validateParams(hive, key)) return false;
        const command = `reg add "${hive}\\${key}" /f`;
        return (await this.execRegCommand(command)) !== null;
    }

    async listValues(hive, key) {
        if (!this.isWindows || !this.validateParams(hive, key)) return [];
        const command = `reg query "${hive}\\${key}"`;
        const output = await this.execRegCommand(command);
        if (!output) return [];
        return output.split('\n').slice(2).map(line => line.trim().split(/\s{2,}/)[0]).filter(Boolean);
    }

    async query(fullPath, valueName = '') {
        if (!this.isWindows) return null;
        const [hive, ...keyParts] = fullPath.split('\\');
        const key = keyParts.join('\\');
        return this.getValue(hive, key, valueName);
    }

    async setEnvironmentVariable(name, value) {
        if (!this.isWindows) return false;
        const key = 'SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment';
        return this.setValue('HKLM', key, name, value, 'REG_SZ');
    }

    async deleteEnvironmentVariable(name) {
        if (!this.isWindows) return false;
        const key = 'SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment';
        return this.deleteValue('HKLM', key, name);
    }
}

module.exports = os.platform() === 'win32' ? new WindowsRegistry() : {};
