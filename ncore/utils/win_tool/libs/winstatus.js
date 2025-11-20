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
const os = require('os');
const path = require('path');
const { execCmd, execPowerShell } = require('#@commander');
const logger = require('#@logger');

class WindowsStatus {
    constructor() {
        this.isWindows = os.platform() === 'win32';
        if (!this.isWindows) {
            logger.warn('WindowsStatus is only available on Windows platforms');
            return;
        }

        this.bootTimeFile = path.join(__dirname, 'boot_time.txt');
        this.resetScript = path.join(__dirname, 'reset_script.js');
        this.wmicPath = 'C:\\Windows\\System32\\wbem\\wmic.exe';

        // 预检测 `wmic` 是否存在
        this.wmicAvailable = fs.existsSync(this.wmicPath);
    }

    /**
     * 获取系统启动时间
     * @private
     */
    async getBootTime() {
        try {
            let output = '';

            if (this.wmicAvailable) {
                // **方法 1：使用 WMIC**
                output = await execCmd('wmic os get lastbootuptime');
                const match = output.match(/\d{14}/);
                if (match) return match[0]; // YYYYMMDDHHMMSS
            }

            // **方法 2：使用 PowerShell**
            try {
                output = await execPowerShell(
                    '(Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToString("yyyyMMddHHmmss")'
                );
                if (output) return output.trim();
            } catch (err) {
                logger.warn('PowerShell 获取启动时间失败，尝试 systeminfo...');
            }

            // **方法 3：使用 systeminfo**
            try {
                output = await execCmd('systeminfo');
                const match = output.match(/系统启动时间:\s*(.+)/);
                if (match) {
                    const bootTime = new Date(match[1].trim());
                    return bootTime.toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
                }
            } catch (err) {
                logger.error('无法获取系统启动时间:', err);
            }
        } catch (error) {
            logger.error('Error getting boot time:', error);
        }
        return null;
    }

    /**
     * 记录当前启动时间（仅记录一次）
     */
    async recordBootTime() {
        if (!this.isWindows) return;

        if (fs.existsSync(this.bootTimeFile)) {
            logger.info('Boot time already recorded');
            return;
        }

        const bootTime = await this.getBootTime();
        if (bootTime) {
            fs.writeFileSync(this.bootTimeFile, bootTime, 'utf8');
            logger.info(`Boot time recorded: ${bootTime}`);
        } else {
            logger.error('Failed to record boot time');
        }
    }

    /**
     * 检查系统是否重启
     * @param {boolean} [autoReset=false] - 重启后是否自动执行重置脚本
     * @returns {Promise<boolean>} 是否已重启
     */
    async checkReboot(autoReset = false) {
        if (!this.isWindows) return false;

        if (!fs.existsSync(this.bootTimeFile)) {
            logger.warn('No recorded boot time found');
            return false;
        }

        const recordedBootTime = fs.readFileSync(this.bootTimeFile, 'utf8').trim();
        const currentBootTime = await this.getBootTime();

        if (!currentBootTime) {
            logger.error('Failed to get current boot time');
            return false;
        }

        const hasRebooted = recordedBootTime !== currentBootTime;

        if (hasRebooted) {
            logger.info('System has been rebooted');

            if (autoReset && fs.existsSync(this.resetScript)) {
                logger.info('Executing reset script...');
                await execCmd(`node "${this.resetScript}"`);
            }

            fs.writeFileSync(this.bootTimeFile, currentBootTime, 'utf8');
            logger.info(`New boot time recorded: ${currentBootTime}`);
        } else {
            logger.info('System has not been rebooted');
        }

        return hasRebooted;
    }

    toString() {
        return '[class WindowsStatus]';
    }
}

// 仅在 Windows 平台导出实例
module.exports = os.platform() === 'win32' ? new WindowsStatus() : {};
