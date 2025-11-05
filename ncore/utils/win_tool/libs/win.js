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
const fs = require('fs');
const os = require('os')
const path = require('path');
const regedit = require('regedit').promisified;
const { execSync, exec } = require('child_process');
const { gdir } = require('#@global_vars');
const { Shell } = require('node-windows');
const { execCmd, execCmdResultText, pipeExecCmd } = require('#@commander');
// const windows_shortcuts = require('windows-shortcuts');
const logger = require('#@logger');
const registry = require('./registry.js');
const winpath = require('./winpath.js');
const sysinfo = require('./sysinfo.js');

class Win {
    pathKey = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'
    install_queue = []
    userDataFile = 'userData.json';

    parsedArgs = null

    async createShortcut(name, exePath, iconPath = exePath) {
        const desktopPath = path.join(os.homedir(), 'Desktop');
        const shortcutPath = path.join(desktopPath, `${name}.lnk`);

        if (await this.fileExists(shortcutPath)) {
            console.log(`Shortcut "${name}" already exists. Removing it before creating a new one.`);
            await this.deleteFile(shortcutPath);
        }

        try {
            const shell = new Shell();
            await shell.createShortcut({
                target: exePath,
                workingDirectory: path.dirname(exePath),
                description: name,
                icon: iconPath,
                hotkey: '',
                args: '',
                desktop: true,
                filename: name
            });
            console.log(`Shortcut "${name}" created successfully.`);
        } catch (error) {
            console.error(`Failed to create shortcut "${name}":`, error);
        }
    }

    isWindows() {
        return os.platform() === 'win32';
    }

    kill(process = "chrome") {
        const cmd = `pkill ${process}`;
        return cmd;
    }

    isAppInLoginItems() {
        const settings = app.getLoginItemSettings()
        return settings.openAtLogin === true
    }


    checkVersionByTail(inputText, version) {
        const lines = inputText.split(/[\n\r]+/);
        for (let line of lines) {
            line = line.replaceAll(/\s+$/g, ``)
            if (line.endsWith(version)) {
                return true;
            }
        }
        return false;
    }

    async killProcessByPort(port) {
        return new Promise((resolve, reject) => {
            const netstatCommand = `netstat -ano | findstr :${port}`;
            exec(netstatCommand, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                const lines = stdout.trim().split('\n');
                const pidRegex = /(\d+)$/; // Regular expression to match PID at the end of each line
                const pids = lines.map(line => {
                    const match = line.match(pidRegex);
                    return match ? match[1] : null;
                }).filter(pid => pid); // Filter out null values

                if (pids.length === 0) {
                    resolve(`No processes found using port ${port}`);
                    return;
                }

                const forceOption = pids.length > 1 ? '/F' : '';
                const taskkillCommand = `taskkill ${forceOption} /PID ${pids.join(' /PID ')}`;
                exec(taskkillCommand, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(stdout.trim());
                });
            });
        });
    }

    const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const FILE_PATH = path.join(__dirname, 'boot_time.txt');
const RESET_SCRIPT = path.join(__dirname, 'reset_script.js'); // 你可以改成你的重置脚本

/**
 * 获取系统启动时间
 * @returns {string|null} YYYYMMDDHHMMSS 格式的启动时间
 */
function getBootTime() {
    try {
        let output = '';

        if (process.platform === 'win32') {
            // **方法 1：使用 WMIC**
            try {
                output = execSync('wmic os get lastbootuptime', { encoding: 'utf8' });
                const match = output.match(/\d{14}/);
                if (match) return match[0]; // YYYYMMDDHHMMSS
            } catch (e) {
                console.warn('WMIC 不可用，尝试 PowerShell...');
            }

            // **方法 2：使用 PowerShell**
            try {
                output = execSync(
                    'powershell -command "(gcim Win32_OperatingSystem).LastBootUpTime.ToString(\'yyyyMMddHHmmss\')"',
                    { encoding: 'utf8' }
                ).trim();
                if (output) return output;
            } catch (e) {
                console.warn('PowerShell 方法失败，尝试 systeminfo...');
            }

            // **方法 3：使用 systeminfo**
            try {
                output = execSync('systeminfo', { encoding: 'utf8' });
                const match = output.match(/系统启动时间:\s*(.+)/);
                if (match) {
                    const bootTime = new Date(match[1].trim());
                    return bootTime.toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
                }
            } catch (e) {
                console.error('无法获取启动时间，请检查系统环境！');
            }
        } else {
            // **Linux/macOS 获取 uptime**
            try {
                output = execSync('uptime -s', { encoding: 'utf8' }).trim();
                return output.replace(/[-: ]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
            } catch (e) {
                console.warn('uptime -s 失败，尝试 /proc/uptime...');
            }

            // **备用：/proc/uptime**
            try {
                const uptimeSeconds = fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0];
                const bootTime = new Date(Date.now() - uptimeSeconds * 1000);
                return bootTime.toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
            } catch (e) {
                console.error('无法获取启动时间，系统可能不支持。');
            }
        }
    } catch (err) {
        console.error('获取启动时间失败:', err);
    }
    return null;
}

/**
 * 记录启动时间（仅记录一次）
 */
function recordBootTime() {
    if (fs.existsSync(FILE_PATH)) {
        console.log('已记录启动时间，不重复记录。');
        return;
    }

    const bootTime = getBootTime();
    if (bootTime) {
        fs.writeFileSync(FILE_PATH, bootTime, 'utf8');
        console.log(`启动时间已记录: ${bootTime}`);
    } else {
        console.error('无法记录启动时间');
    }
}

/**
 * 检查是否重启
 */
function checkReboot() {
    if (!fs.existsSync(FILE_PATH)) {
        console.log('没有找到记录的启动时间，请先运行记录脚本。');
        return;
    }

    const recordedBootTime = fs.readFileSync(FILE_PATH, 'utf8').trim();
    const currentBootTime = getBootTime();

    if (!currentBootTime) {
        console.error('无法获取当前启动时间');
        return;
    }

    if (recordedBootTime === currentBootTime) {
        console.log('系统未重启');
    } else {
        console.log('系统已重启');

        // 如果传入 --reset 参数，调用重置脚本
        if (process.argv.includes('--reset')) {
            console.log('执行重置脚本...');
            spawn('node', [RESET_SCRIPT], { stdio: 'inherit' });
        }

        // 重新记录新的启动时间
        fs.writeFileSync(FILE_PATH, currentBootTime, 'utf8');
        console.log(`新启动时间已记录: ${currentBootTime}`);
    }
}

// 主逻辑
if (process.argv.includes('--check')) {
    checkReboot();
} else {
    recordBootTime();
}

}

Win.toString = () => '[class Win Api]';
module.exports = new Win();

class WindowsTools {
    constructor() {
        this.isWindows = os.platform() === 'win32';
        if (!this.isWindows) {
            logger.warn('WindowsTools is only available on Windows platforms');
            return;
        }

        // 系统路径
        this.systemRoot = process.env.SystemRoot || 'C:\\Windows';
        this.systemDrive = process.env.SystemDrive || 'C:';
        this.programFiles = process.env['ProgramFiles'];
        this.programFilesX86 = process.env['ProgramFiles(x86)'];

        // 工具路径
        this.powershellPath = path.join(this.systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
        this.cmdPath = path.join(this.systemRoot, 'System32', 'cmd.exe');
        this.regPath = path.join(this.systemRoot, 'System32', 'reg.exe');
    }

    /**
     * 获取系统启动时间
     * @private
     */
    getBootTime() {
        try {
            const output = execSync('wmic os get lastbootuptime').toString();
            const match = output.match(/\d{14}/);
            return match ? match[0] : null;
        } catch (error) {
            logger.error('Error getting boot time:', error);
            return null;
        }
    }

    /**
     * 记录启动时间
     */
    recordBootTime() {
        if (!this.isWindows) return;

        if (fs.existsSync(this.bootTimeFile)) {
            logger.info('Boot time already recorded');
            return;
        }

        const bootTime = this.getBootTime();
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
     */
    async checkReboot(autoReset = false) {
        if (!this.isWindows) return false;

        if (!fs.existsSync(this.bootTimeFile)) {
            logger.warn('No recorded boot time found');
            return false;
        }

        const recordedBootTime = fs.readFileSync(this.bootTimeFile, 'utf8').trim();
        const currentBootTime = this.getBootTime();

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

    /**
     * 检查管理员权限
     */
    async checkAdminPrivileges() {
        if (!this.isWindows) return false;
        
        try {
            await execCmd('fsutil dirty query %systemdrive%');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取 Windows 版本信息
     */
    async getWindowsVersion() {
        if (!this.isWindows) return null;

        try {
            const versionInfo = await execCmdResultText('ver');
            const match = versionInfo.match(/\d+\.\d+\.\d+/);
            if (match) {
                const [major, minor, build] = match[0].split('.').map(Number);
                return {
                    version: match[0],
                    major,
                    minor,
                    build,
                    name: this.getWindowsName(major, minor)
                };
            }
            return null;
        } catch (error) {
            logger.error('Error getting Windows version:', error);
            return null;
        }
    }

    /**
     * 获取 Windows 名称
     * @private
     */
    getWindowsName(major, minor) {
        const versions = {
            '10.0': 'Windows 10/11',
            '6.3': 'Windows 8.1',
            '6.2': 'Windows 8',
            '6.1': 'Windows 7',
            '6.0': 'Windows Vista'
        };
        return versions[`${major}.${minor}`] || 'Unknown Windows Version';
    }

    /**
     * 获取完整的系统信息
     */
    async getSystemInfo() {
        if (!this.isWindows) return null;

        try {
            const systemInfo = await sysinfo.getSystemInfo();
            const windowsVersion = await this.getWindowsVersion();
            
            return {
                ...systemInfo,
                windowsVersion,
                isAdmin: await this.checkAdminPrivileges(),
                paths: {
                    system: this.systemRoot,
                    programFiles: this.programFiles,
                    programFilesX86: this.programFilesX86
                }
            };
        } catch (error) {
            logger.error('Error getting system info:', error);
            return null;
        }
    }

    /**
     * 执行 PowerShell 命令
     */
    async executePowerShell(command, elevated = false) {
        if (!this.isWindows) return null;

        try {
            const psCommand = elevated ? 
                `Start-Process PowerShell -Verb RunAs -ArgumentList '-Command "${command}"'` :
                command;

            return await execCmdResultText(`"${this.powershellPath}" -Command "${psCommand}"`);
        } catch (error) {
            logger.error('Error executing PowerShell command:', error);
            throw error;
        }
    }

    /**
     * 创建快捷方式
     */
    async createShortcut(targetPath, shortcutPath, options = {}) {
        if (!this.isWindows) return false;

        try {
            const wsScript = `
                Set-StrictMode -Version Latest
                $WshShell = New-Object -ComObject WScript.Shell
                $Shortcut = $WshShell.CreateShortcut("${shortcutPath}")
                $Shortcut.TargetPath = "${targetPath}"
                ${options.arguments ? `$Shortcut.Arguments = "${options.arguments}"` : ''}
                ${options.description ? `$Shortcut.Description = "${options.description}"` : ''}
                ${options.workingDirectory ? `$Shortcut.WorkingDirectory = "${options.workingDirectory}"` : ''}
                ${options.iconLocation ? `$Shortcut.IconLocation = "${options.iconLocation}"` : ''}
                $Shortcut.Save()
            `;

            await this.executePowerShell(wsScript);
            return true;
        } catch (error) {
            logger.error('Error creating shortcut:', error);
            return false;
        }
    }

    /**
     * 获取已安装的应用程序列表
     */
    async getInstalledApps() {
        if (!this.isWindows) return [];

        try {
            const uninstallKeys = [
                'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
                'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
            ];

            const apps = [];
            for (const key of uninstallKeys) {
                const values = await registry.listValues(key);
                if (values) {
                    for (const value of values) {
                        const displayName = await registry.getValue(key, value.key, 'DisplayName');
                        if (displayName) {
                            apps.push({
                                name: displayName,
                                version: await registry.getValue(key, value.key, 'DisplayVersion'),
                                publisher: await registry.getValue(key, value.key, 'Publisher'),
                                installLocation: await registry.getValue(key, value.key, 'InstallLocation')
                            });
                        }
                    }
                }
            }
            return apps;
        } catch (error) {
            logger.error('Error getting installed apps:', error);
            return [];
        }
    }

}

// 仅在 Windows 平台导出实例
module.exports = os.platform() === 'win32' ? new WindowsTools() : {};

