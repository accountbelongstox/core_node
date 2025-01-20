const { execSync, spawn, spawnSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const log = {
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


// Track if files are in overflow mode (size > MAX_LOG_SIZE)
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
        console.error(`Failed to write to log file: ${error}`);
    }
}

const initialWorkingDirectory = process.cwd();

// Platform detection
function getPlatformShell() {
    return process.platform === 'win32' ?
        { shell: true, command: 'cmd.exe', args: ['/c'] } :
        { shell: '/bin/sh', command: '/bin/sh', args: ['-c'] };
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
        log.info(stdout);
        log.warn(error);
    }
    return {
        success,
        stdout,
        error,
        code
    };
}


function wrapTextResult(stdout = '', error = ``, info = true) {
    stdout = byteToStr(stdout);
    error = byteToStr(stdout);
    if (info) {
        log.info(stdout);
        log.warn(error);
    }
    return stdout + error
}


function execCmd(command, info = false, cwd = null, logname = null) {
    if (Array.isArray(command)) {
        command = command.join(" ");
    }
    if (info) {
        log.command(`${command}`);
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
        log.error(command);
        log.error(`${e}`);
        resultText = ""
    }

    if (logname) {
        appendToLog(logname, resultText);
    }
    if (info) {
        log.info(resultText);
    }
    if (hasChangedDir) {
        process.chdir(initialWorkingDirectory);
    }
    return resultText;
}

function execCmdResultText(command, info = false, cwd = null, logname = null) {
    return execCmd(command, info, cwd, logname);
}

async function execCommand(command, info = true, cwd = null, logname = null) {
    if (Array.isArray(command)) {
        command = command.join(" ");
    }
    if (info) {
        log.command(`${command}`);
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
            log.info(stdoutData);
            if (stderrData) {
                log.warn(stderrData);
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

async function spawnAsync(command, info = true, cwd = null, logname = null, callback, timeout = 5000, progressCallback = null) {
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
        log.command(`${command}`);
    }
    let timer = null;
    let callbackExecuted = false;

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
                if (!callbackExecuted) {
                    if (callback) callback(wrapEmdResult(true, stdoutData, null, 0, info));
                    callbackExecuted = true;
                }
            }, timeout);
        };

        const handleYesNo = (data) => {
            const output = data.toString();
            if (output.match(/(y\/n|yes\/no)/i)) {
                childProcess.stdin.write('Yes\n');
            }
            resetTimer();
            if (info) {
                log.info(output);
            }
            stdoutData += output + '\n';
            progressCallback?.(stdoutData);
        };

        childProcess.stdout.on('data', handleYesNo);

        childProcess.stderr.on('data', (data) => {
            resetTimer();
            const error = data.toString();
            if (info) {
                log.warn(error);
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
    if (process.platform !== 'win32') {
        return null;
    }

    const standardPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
    const corePath = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';

    if (fs.existsSync(corePath)) {
        return corePath;
    } else if (fs.existsSync(standardPath)) {
        return standardPath;
    }
    log.error('PowerShell not found. Please ensure PowerShell is installed.');
    return null;
}

function execPowerShell(command, info = false, cwd = null, no_std = false, cmdEnv = null) {
    if (process.platform !== 'win32') {
        log.error('PowerShell commands are only supported on Windows');
        return null;
    }

    const powershellPath = findPowerShellPath();
    if (!powershellPath) {
        log.error('PowerShell path is not set.');
        return null;
    }
    if (info) {
        log.command(`${command}`);
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
            log.error(e);
            return null;
        }
    }
    try {
        return execCmd(fullCommand, info, cwd, no_std);
    } catch (e) {
        log.error(e);
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
            log.command(`${command}`);
        }
        return execSync(command, options);
    } catch (error) {
        log.error(`Command execution failed: ${command}`);
        log.error(error);
        return null;
    }
}

function pipeExecCmdAsync(command, useShell = true, cwd = null, inheritIO = true, env = process.env) {
    return spawnAsync(command, useShell, cwd, inheritIO, env);
}

async function execCmdShell(command, ignoreError = false, cwd = null,print = true) {
    command = command.replace(/^cmd\s+\/c\s+/, '');
    const cmdCommand = `cmd /c ${command}`;
    if (print) {
        log.info(cmdCommand);
    }
    return execCmdResultText(cmdCommand, ignoreError, cwd);
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
    execCmdShell
};

