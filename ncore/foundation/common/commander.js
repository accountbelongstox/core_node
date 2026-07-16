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

const { execSync, spawn, spawnSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { getSystemCacheDir } = require('./system_paths');
const homeDir = os.homedir();
const username = process.env.USERNAME || process.env.USER || 'default';
const coceCacheDir = getSystemCacheDir();
fs.mkdirSync(coceCacheDir, { recursive: true });
const cacheFilePath = path.join(coceCacheDir, '.shell_cache.json');
const cachePowerShellFile = path.join(coceCacheDir, '.powershell_path_cache.json');

const logger = {
    colors: {
        reset: '\x1b[0m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        brightRed: '\x1b[91m',
        brightGreen: '\x1b[92m',
        brightYellow: '\x1b[93m',
        brightBlue: '\x1b[94m',
        brightMagenta: '\x1b[95m',
        brightCyan: '\x1b[96m',
        brightWhite: '\x1b[97m',
    },

    info: function (...args) {
        console.log(this.colors.cyan + '[INFO]' + this.colors.reset, ...args);
    },
    warn: function (...args) {
        console.warn(this.colors.yellow + '[WARN]' + this.colors.reset, ...args);
    },
    error: function (...args) {
        console.error(this.colors.red + '[ERROR]' + this.colors.reset, ...args);
    },
    success: function (...args) {
        console.log(this.colors.green + '[SUCCESS]' + this.colors.reset, ...args);
    },
    debug: function (...args) {
        console.log(this.colors.magenta + '[DEBUG]' + this.colors.reset, ...args);
    },
    command: function (...args) {
        console.log(this.colors.brightBlue + '[COMMAND]' + this.colors.reset, ...args);
    }
};

const fileOverflowMode = {};

function appendToLog(type, message) {
    const MAX_LOG_SIZE = 50 * 1024 * 1024;
    function getLogFilePath(type) {
        const homeDir = os.homedir();
        const SCRIPT_NAME = 'core_node';
        const LOCAL_DIR = os.platform() === 'win32' ? path.join(homeDir, `.${SCRIPT_NAME}`) : `/usr/${SCRIPT_NAME}`;
        const COMMON_CACHE_DIR = path.join(LOCAL_DIR, '.cache');
        const LOG_DIR = path.join(COMMON_CACHE_DIR, '.command_logs');
        [LOCAL_DIR, COMMON_CACHE_DIR, LOG_DIR].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
        const logPath = path.join(LOG_DIR, `${type}.log`);
        if (!fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, '', 'utf8');
        }
        if (fileOverflowMode[logPath] === undefined) {
            fileOverflowMode[logPath] = false;
        }
        return logPath;
    }
    try {
        const logFile = getLogFilePath(type);
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        const stats = fs.statSync(logFile);
        if (stats.size + Buffer.byteLength(logMessage) > MAX_LOG_SIZE) {
            fileOverflowMode[logFile] = true;
        }
        if (fileOverflowMode[logFile]) {
            const lines = fs.readFileSync(logFile, 'utf8').split('\n');
            let currentSize = stats.size;
            while (currentSize > MAX_LOG_SIZE * 0.8) { // Keep 20% buffer
                const removedLine = lines.shift();
                if (!removedLine) break;
                currentSize -= Buffer.byteLength(removedLine + '\n');
            }
            lines.push(logMessage.trim());
            fs.writeFileSync(logFile, lines.join('\n') + '\n', 'utf8');
            const newStats = fs.statSync(logFile);
            if (newStats.size < MAX_LOG_SIZE * 0.8) {
                fileOverflowMode[logFile] = false;
            }
        } else {
            fs.appendFileSync(logFile, logMessage);
            if (stats.size + Buffer.byteLength(logMessage) > MAX_LOG_SIZE) {
                fileOverflowMode[logFile] = true;
            }
        }
    } catch (error) {
        logger.error(`Failed to write to log file: ${error}`);
    }
}

const initialWorkingDirectory = process.cwd();

// Platform detection
function getPlatformShell() {
    return process.platform === 'win32' ?
        getWindowsShell() :
        getLinuxShell();
}
function getWindowsShell() {
    return { shell: true, command: 'cmd.exe', args: ['/c'] };
}
function getLinuxShell() {
    try {
        if (fs.existsSync(cacheFilePath)) {
            const cachedData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
            if (cachedData.shell && cachedData.command && cachedData.args) {
                return cachedData;
            }
        }
        const homeDir = os.homedir();
        const shell = process.env.SHELL || '/bin/sh';
        const bashrcPath = path.join(homeDir, '.bashrc');
        const zshrcPath = path.join(homeDir, '.zshrc');
        let result;
        if (shell.includes('bash') && fs.existsSync(bashrcPath)) {
            result = { shell: shell, command: shell, args: ['-c'] };
        } else if (shell.includes('zsh') && fs.existsSync(zshrcPath)) {
            result = { shell: shell, command: shell, args: ['-c'] };
        } else {
            result = { shell: '/bin/sh', command: '/bin/sh', args: ['-c'] };
        }
        fs.writeFileSync(cacheFilePath, JSON.stringify(result, null, 2), 'utf-8');
        return result;
    } catch (error) {
        logger.error("Error detecting shell:", error);
        return { shell: '/bin/sh', command: '/bin/sh', args: ['-c'] };
    }
}

function isLinux() {
    return process.platform === 'linux';
}

function byteToStr(astr) {
    try {
        return astr.toString('utf-8');
    } catch (e) {
        astr = String(astr);
        if (/^b\'{0,1}/.test(astr)) {
            astr = astr.replace(/^b\'{0,1}/, '').replace(/\'{0,1}$/, '');
        }
        return astr;
    }
}

function wrapEmdResult(success = true, stdout = '', error = null, code = 0, info = true) {
    stdout = byteToStr(stdout);
    error = byteToStr(stdout);
    if (info) {
        logger.info(stdout);
        logger.warn(error);
    }
    return {
        success,
        stdout,
        error,
        code
    };
}

function commandResultToString(obj, indent = 2) {
    if (typeof obj == 'string' || typeof obj == 'number') {
        obj = "" + obj
        obj = obj.replace(/\\/g, '/');
        obj = obj.replace(/`/g, '"');
        obj = obj.replace(/\x00/g, '')
        return obj;
    } else {
        if (obj === null) {
            return `null`;
        }
        else if (obj === false) {
            return `false`;
        }
        else if (obj === true) {
            return `true`;
        } else if (Array.isArray(obj)) {
            const formattedArray = obj.map(item => this.toString(item, indent));
            return `[${formattedArray.join(', ')}]`;
        } else {
            try {
                let str = JSON.stringify(obj);
                return str;
            } catch (error) {
                let str = obj.toString()
                return str;
            }
        }
    }
}

function wrapTextResult(stdout = '', error = ``, info = true) {
    stdout = byteToStr(stdout);
    error = byteToStr(stdout);
    if (info) {
        logger.info(stdout);
        logger.warn(error);
    }
    return stdout + error
}

function execCmd(command, info = false, cwd = null, logname = null) {
    if (Array.isArray(command)) {
        command = command.join(" ");
    }
    if (info) {
        logger.command(`${command}`);
    }

    const platformShell = getPlatformShell();
    const options = {
        shell: typeof platformShell.shell === 'boolean' ? 'cmd.exe' : platformShell.shell,
        encoding: 'utf-8'
    };

    let hasChangedDir = false;
    if (cwd) {
        hasChangedDir = true;
        options.cwd = cwd;
        process.chdir(cwd);
    }
    let resultText = "";
    try {
        const result = execSync(command, options);
        resultText = byteToStr(result);
    } catch (e) {
        resultText = extraErrorStr(e);
        if (!checkCmdSuccess(e)) {
            logger.error(command);
            logger.error(`${e}`);
            resultText = ""
        } else {
            logger.success(resultText);
        }
    }

    if (logname) {
        appendToLog(logname, resultText);
    }
    if (info) {
        logger.info(resultText);
    }
    if (hasChangedDir) {
        process.chdir(initialWorkingDirectory);
    }
    return resultText;
}

function extraError(e) {
    const result = {
        stdout: '',
        stderr: '',
        status: e.status || null
    };

    // Process stdout
    if (e.stdout) {
        if (typeof e.stdout === 'string') {
            try {
                result.stdout = Buffer.from(e.stdout).toString('utf8');
            } catch (err) {
                result.stdout = String(e.stdout);
            }
        } else if (Array.isArray(e.stdout)) {
            result.stdout = e.stdout
                .map(item => {
                    if (item === null) return '';
                    try {
                        return Buffer.from(item).toString('utf8');
                    } catch (err) {
                        return String(item);
                    }
                })
                .filter(item => item !== null)
                .join('');
        }
    }
    if (e.stderr) {
        if (typeof e.stderr === 'string') {
            try {
                result.stderr = Buffer.from(e.stderr).toString('utf8');
            } catch (err) {
                result.stderr = String(e.stderr);
            }
        } else if (Array.isArray(e.stderr)) {
            result.stderr = e.stderr
                .map(item => {
                    if (item === null) return '';
                    try {
                        return Buffer.from(item).toString('utf8');
                    } catch (err) {
                        return String(item);
                    }
                })
                .filter(item => item !== null)
                .join('');
        }
    }

    return result;
}

function execCmdResultText(command, info = false, cwd = null, logname = null) {
    return execCmd(command, info, cwd, logname);
}

async function execCommand(command, info = true, cwd = null, logname = null) {
    if (Array.isArray(command)) {
        command = command.join(" ");
    }
    if (info) {
        logger.command(`${command}`);
    }

    return new Promise((resolve, reject) => {
        const platformShell = getPlatformShell();
        const options = { stdio: 'pipe' };

        if (cwd) {
            options.cwd = cwd;
            process.chdir(cwd);
        }

        const childProcess = spawnSync(platformShell.command, [...platformShell.args, command], options);
        const stdoutData = childProcess.stdout.toString();
        const stderrData = childProcess.stderr.toString();

        if (info) {
            logger.info(stdoutData);
            if (stderrData) {
                logger.warn(stderrData);
            }
        }

        process.chdir(initialWorkingDirectory);

        if (logname) {
            appendToLog(`info`, stdoutData);
        }

        if (childProcess.error) {
            resolve(wrapEmdResult(false, stdoutData, stderrData, -1, info));
        } else if (childProcess.status === 0) {
            resolve(wrapEmdResult(true, stdoutData, null, 0, info));
        } else {
            resolve(wrapEmdResult(false, stdoutData, stderrData, childProcess.status, info));
        }
    });
}

async function spawnAsync(command, info = true, cwd = null,  callback, timeout = 5000, progressCallback = null) {
    let cmd = '';
    let args = [];

    if (typeof command === 'string') {
        const platformShell = getPlatformShell();
        cmd = platformShell.command;
        args = [...platformShell.args, command];
    } else if (Array.isArray(command)) {
        cmd = command[0];
        args = command.slice(1);
    }

    if (info) {
        logger.command(`${command}`);
    }
    let timer = null;

    return new Promise((resolve) => {
        const options = { stdio: 'pipe' };
        if (cwd) {
            options.cwd = cwd;
            process.chdir(cwd);
        }

        const childProcess = spawn(cmd, args, options);
        let stdoutData = '';
        let stderrData = '';

        const resetTimer = () => {
            if (timer !== null) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                if (callback) callback(wrapEmdResult(true, stdoutData, null, 0, info));
            }, timeout);
        };

        const handleYesNo = (data) => {
            const output = data.toString();
            if (output.match(/(y\/n|yes\/no)/i)) {
                childProcess.stdin.write('Yes\n');
            }
            resetTimer();
            if (info) {
                logger.info(output);
            }
            stdoutData += output + '\n';
            progressCallback?.(stdoutData);
        };

        childProcess.stdout.on('data', handleYesNo);

        childProcess.stderr.on('data', (data) => {
            resetTimer();
            const error = data.toString();
            if (info) {
                logger.warn(error);
            }
            stderrData += error + '\n';
            progressCallback?.(stdoutData);
        });

        childProcess.on('close', (code) => {
            process.chdir(initialWorkingDirectory);
            if (code === 0) {
                resolve(wrapEmdResult(true, stdoutData, null, 0, info));
            } else {
                resolve(wrapEmdResult(false, stdoutData, stderrData, code, info));
            }
        });

        childProcess.on('error', (err) => {
            process.chdir(initialWorkingDirectory);
            resolve(wrapEmdResult(false, stdoutData, err, -1, info));
        });
    });
}


function findPowerShellPath() {
    try {
        if (fs.existsSync(cachePowerShellFile)) {
            const cachedData = JSON.parse(fs.readFileSync(cachePowerShellFile, 'utf-8'));
            if (fs.existsSync(cachedData.path)) {
                return cachedData.path;
            }
        }
        let psPath = null;
        if (process.platform === 'win32') {
            const standardPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
            const corePath = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';

            if (fs.existsSync(corePath)) {
                psPath = corePath;
            } else if (fs.existsSync(standardPath)) {
                psPath = standardPath;
            }
        } else {
            try {
                psPath = execSync('which pwsh').toString().trim();
                if (!fs.existsSync(psPath)) psPath = null;
            } catch (err) {
                logger.error('PowerShell (pwsh) not found on Linux/macOS.');
            }
        }
        if (!psPath) {
            logger.error('PowerShell not found. Please ensure it is installed.');
            return null;
        }
        fs.writeFileSync(cachePowerShellFile, JSON.stringify({ path: psPath }, null, 2), 'utf-8');
        return psPath;
    } catch (error) {
        logger.error('Error finding PowerShell path:', error);
        return null;
    }
}

function execPowerShell(command, info = false, cwd = null, no_std = false, cmdEnv = null) {
    if (process.platform !== 'win32') {
        logger.error('PowerShell commands are only supported on Windows');
        return null;
    }

    const powershellPath = findPowerShellPath();
    if (!powershellPath) {
        logger.error('PowerShell path is not set.');
        return null;
    }
    if (info) {
        logger.command(`${command}`);
    }

    if (Array.isArray(command)) {
        command = command.join(" ");
    }
    command = command.trim();
    const options = {
        encoding: 'utf-8'
    };
    const fullCommand = `${powershellPath} -Command "${command}"`;
    if (cmdEnv) {
        try {
            return execCmd(fullCommand, info, cwd, no_std, cmdEnv);
        } catch (e) {
            logger.error(e);
            return null;
        }
    }
    try {
        return execCmd(fullCommand, info, cwd, no_std);
    } catch (e) {
        logger.error(e);
        return null;
    }
}

function pipeExecCmd(command, useShell = true, cwd = null, inheritIO = true, env = process.env, info = true) {
    try {
        const platformShell = getPlatformShell();
        const options = {
            shell: useShell ? platformShell.shell : false,
            cwd: cwd || process.cwd(),
            stdio: inheritIO ? 'inherit' : 'pipe',
            env: env
        };

        if (Array.isArray(command)) {
            command = command.join(' ');
        }
        if (info) {
            logger.command(`${command}`);
        }
        return execSync(command, options);
    } catch (error) {
        logger.error(`Command execution failed: ${command}`);
        logger.error(error);
        return null;
    }
}

function pipeExecCmdAsync(command, useShell = true, cwd = null, inheritIO = true, env = process.env) {
    return spawnAsync(command, useShell, cwd, inheritIO, env);
}

async function execCmdShell(command, ignoreError = false, cwd = null, print = true) {
    command = command.replace(/^cmd\s+\/c\s+/, '');
    const cmdCommand = `cmd /c ${command}`;
    if (print) {
        logger.info(cmdCommand);
    }
    return execCmdResultText(cmdCommand, ignoreError, cwd);
}

async function execDetached(command, cwd = null) {
    return new Promise((resolve, reject) => {
        try {
            const platformShell = getPlatformShell();
            const options = {
                detached: true,
                stdio: 'ignore'
            };

            if (cwd) {
                options.cwd = cwd;
            }

            const childProcess = spawn(platformShell.command, [...platformShell.args, command], options);

            // Unref the child process so the parent can exit independently
            childProcess.unref();

            logger.info(`Detached process started with PID: ${childProcess.pid}`);
            resolve({ success: true, pid: childProcess.pid });
        } catch (error) {
            logger.error(`Failed to start detached process: ${error.message}`);
            reject(error);
        }
    });
}

function extraErrorStr(e) {
    const { stdout, stderr } = extraError(e);
    return (stdout + stderr).trim();
}

function isSuccessOutput(output) {
    if (!output) return false;

    const normalizedOutput = output.toLowerCase().trim();

    const successPatterns = [
        /success/,
        /completed/,
        /done/,
        /installed/,
        /updated/,
        /created/,
        /enabled/,
        /activated/,
        /ok\b/,

        /成功/,
        /完成/,
        /已安装/,
        /已更新/,
        /已创建/,
        /已启用/,
        /已激活/,
        /正常/
    ];

    const failurePatterns = [
        /error/,
        /failed/,
        /failure/,
        /cannot/,
        /unable to/,
        /not found/,
        /denied/,
        /invalid/,
        /exception/,

        /错误/,
        /失败/,
        /未找到/,
        /不存在/,
        /无效/,
        /异常/,
        /拒绝/,
        /无法/
    ];

    const hasFailure = failurePatterns.some(pattern =>
        pattern.test(normalizedOutput)
    );

    if (hasFailure) return false;

    const hasSuccess = successPatterns.some(pattern =>
        pattern.test(normalizedOutput)
    );

    return hasSuccess || !hasFailure;
}

function checkCmdSuccess(e) {
    return isSuccessOutput(extraErrorStr(e));
}

module.exports = {
    getPlatformShell,
    isLinux,
    byteToStr,
    wrapEmdResult,
    execCmdResultText,
    execCmd,
    execCommand,
    spawnAsync,
    findPowerShellPath,
    execPowerShell,
    pipeExecCmd,
    pipeExecCmdAsync,
    execCmdShell,
    execDetached,
    extraError,
    extraErrorStr,
    isSuccessOutput,
    checkCmdSuccess
};

