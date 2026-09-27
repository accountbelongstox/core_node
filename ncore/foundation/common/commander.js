const { execSync, spawn, spawnSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { getSystemCacheDir, getAppLogsDir } = require('./system_paths');
const username = process.env.USERNAME || process.env.USER || 'default';
const coceCacheDir = getSystemCacheDir();
const commandLogDir = path.join(getAppLogsDir(), 'command');
try {
    fs.mkdirSync(coceCacheDir, { recursive: true });
} catch (error) {
    console.warn(`[commander] Cannot create cache directory ${coceCacheDir}: ${error.code || error.message}`);
}
const cacheFilePath = path.join(coceCacheDir, '.shell_cache.json');
const cachePowerShellFile = path.join(coceCacheDir, '.powershell_path_cache.json');
const MAX_OUTPUT_BUFFER = 64 * 1024 * 1024;
const POWERSHELL_ARGS = ['-NoProfile', '-NonInteractive', '-EncodedCommand'];
const POWERSHELL_ENCODING = 'utf16le';

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
        [commandLogDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
        const logPath = path.join(commandLogDir, `${type}.log`);
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
    error = error === null || error === undefined ? null : byteToStr(error);
    if (info) {
        logger.info(stdout);
        if (error) {
            logger.warn(error);
        }
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
    error = error === null || error === undefined ? '' : byteToStr(error);
    if (info) {
        logger.info(stdout);
        if (error) {
            logger.warn(error);
        }
    }
    return stdout + error
}

function shellOption() {
    const platformShell = getPlatformShell();
    return platformShell.shell === true ? true : platformShell.shell;
}

// Structured runner: a string runs through the platform shell, an array runs [file, ...args] without a shell
function runCommand(command, options = {}) {
    let file, args, result, stdout, stderr, success;
    const spawnOptions = {
        cwd: options.cwd || undefined,
        env: options.env ? { ...process.env, ...options.env } : process.env,
        encoding: 'utf-8',
        input: options.input,
        stdio: options.inherit ? 'inherit' : 'pipe',
        windowsHide: true,
        maxBuffer: MAX_OUTPUT_BUFFER
    };

    if (Array.isArray(command)) {
        file = String(command[0]);
        args = command.slice(1).map(String);
    } else {
        file = String(command);
        args = [];
        spawnOptions.shell = shellOption();
    }
    if (options.info) {
        logger.command(Array.isArray(command) ? command.join(' ') : file);
    }

    result = spawnSync(file, args, spawnOptions);
    stdout = result.stdout ? byteToStr(result.stdout) : '';
    stderr = result.stderr ? byteToStr(result.stderr) : (result.error ? String(result.error.message) : '');
    success = !result.error && result.status === 0;

    return { success, code: result.error ? -1 : result.status, stdout, stderr };
}

// An array command runs as argv without a shell (spaced paths stay one argument)
function execCmd(command, info = false, cwd = null, logname = null) {
    const result = runCommand(command, { cwd, info });
    const resultText = result.success ? result.stdout : "";

    if (!result.success) {
        logger.error(Array.isArray(command) ? command.join(' ') : command);
        logger.error(`exit ${result.code}: ${result.stderr.trim()}`);
    }
    if (logname) {
        appendToLog(logname, resultText);
    }
    if (info) {
        logger.info(resultText);
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
    const result = runCommand(command, { cwd, info });

    if (logname) {
        appendToLog(logname, result.stdout);
    }

    return wrapEmdResult(result.success, result.stdout, result.success ? null : result.stderr, result.code, info);
}

async function spawnAsync(command, info = true, cwd = null,  callback, timeout = 5000, progressCallback = null, env = null) {
    let cmd = '';
    let args = [];
    const options = {
        stdio: 'pipe',
        cwd: cwd || undefined,
        env: env ? { ...process.env, ...env } : process.env,
        windowsHide: true
    };

    if (typeof command === 'string') {
        cmd = command;
        options.shell = shellOption();
    } else if (Array.isArray(command)) {
        cmd = String(command[0]);
        args = command.slice(1).map(String);
    }

    if (info) {
        logger.command(`${Array.isArray(command) ? command.join(' ') : command}`);
    }
    let timer = null;
    let finished = false;

    return new Promise((resolve) => {
        const childProcess = spawn(cmd, args, options);
        let stdoutData = '';
        let stderrData = '';

        const clearTimer = () => {
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
        };

        const finish = (result) => {
            if (finished) {
                return;
            }
            finished = true;
            clearTimer();
            resolve(result);
        };

        const resetTimer = () => {
            clearTimer();
            if (finished || typeof callback !== 'function') {
                return;
            }
            timer = setTimeout(() => {
                timer = null;
                if (!finished) callback(wrapEmdResult(true, stdoutData, null, 0, info));
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
            progressCallback?.(output);
        };

        childProcess.stdout.on('data', handleYesNo);

        childProcess.stderr.on('data', (data) => {
            resetTimer();
            const error = data.toString();
            if (info) {
                logger.warn(error);
            }
            stderrData += error + '\n';
            progressCallback?.(error);
        });

        childProcess.on('close', (code) => {
            if (code === 0) {
                finish(wrapEmdResult(true, stdoutData, null, 0, info));
            } else {
                finish(wrapEmdResult(false, stdoutData, stderrData, code, info));
            }
        });

        childProcess.on('error', (err) => {
            finish(wrapEmdResult(false, stdoutData, err, -1, info));
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

    const encodedCommand = Buffer.from(command, POWERSHELL_ENCODING).toString('base64');
    const result = runCommand([powershellPath, ...POWERSHELL_ARGS, encodedCommand], { cwd, env: cmdEnv });

    if (!result.success) {
        logger.error(`PowerShell exit ${result.code}: ${result.stderr.trim()}`);
        return "";
    }
    if (info && !no_std) {
        logger.info(result.stdout);
    }
    return result.stdout;
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
        const output = execSync(command, options);
        return output === null || output === undefined ? '' : output;
    } catch (error) {
        logger.error(`Command execution failed: ${command}`);
        logger.error(error);
        return null;
    }
}

function pipeExecCmdAsync(command, useShell = true, cwd = null, inheritIO = true, env = process.env) {
    return spawnAsync(command, true, cwd, null, undefined, null, env);
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
            const options = {
                detached: true,
                stdio: 'ignore',
                shell: shellOption(),
                windowsHide: true
            };

            if (cwd) {
                options.cwd = cwd;
            }

            const childProcess = spawn(command, [], options);

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
    runCommand
};
