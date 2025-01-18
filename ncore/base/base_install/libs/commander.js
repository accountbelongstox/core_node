const { execSync, spawn, spawnSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const initialWorkingDirectory = process.cwd();

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

exports.isLinux = function () {
    return process.platform === 'linux';
}

exports.byteToStr = function (astr) {
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

exports.wrapEmdResult = function (success = true, stdout = '', error = null, code = 0, info = true) {
    stdout = exports.byteToStr(stdout);
    error = exports.byteToStr(stdout);
    if (info) {
        console.info(stdout);
        if (stdout) appendToLog('info', stdout);
        if (error) {
            console.warn(error);
            appendToLog('warn', error);
        }
    }
    return {
        success,
        stdout,
        error,
        code
    };
}

exports.execCmd = function (command, info = false, cwd = null, logname = null) {
    if (Array.isArray(command)) {
        command = command.join(" ");
    }
    if (info) {
        const logMessage = `command\t: ${command}\ncwd\t: ${cwd}`;
        console.log(logMessage);
        appendToLog('info', logMessage);
    }
    const options = { stdio: [0, 1, 2] };
    let is_changed_dir = false;
    if (cwd) {
        is_changed_dir = true;
        options.cwd = cwd;
        process.chdir(cwd);
    }
    try {
        const result = exports.isLinux()
            ? execSync(command, { shell: '/bin/bash', ...options })
            : execSync(command, options);
        const resultText = exports.byteToStr(result);
        if (info) {
            console.log(resultText);
            appendToLog('info', resultText);
        }
        if (is_changed_dir) {
            process.chdir(initialWorkingDirectory);
        }
        return resultText;
    } catch (error) {
        const errorMessage = error.toString();
        console.error(errorMessage);
        appendToLog('error', errorMessage);
        if (is_changed_dir) {
            process.chdir(initialWorkingDirectory);
        }
        throw error;
    }
}

exports.execCommand = async function (command, info = true, cwd = null, logname = null) {
    if (Array.isArray(command)) {
        command = command.join(" ");
    }
    if (info) {
        console.log(command);
        appendToLog('info', command);
    }
    return new Promise((resolve, reject) => {
        const options = { stdio: [0, 'pipe', 'pipe'] };
        if (cwd) {
            options.cwd = cwd;
            process.chdir(cwd);
        }
        const childProcess = exports.isLinux()
            ? spawn('/bin/bash', ['-c', command], options)
            : spawn('cmd.exe', ['/c', command], options);

        let stdoutData = '';
        let stderrData = '';

        if (childProcess.stdout) {
            childProcess.stdout.on('data', (data) => {
                const output = exports.byteToStr(data);
                if (info) {
                    console.log(output);
                    appendToLog('info', output);
                }
                stdoutData += output;
            });
        }

        if (childProcess.stderr) {
            childProcess.stderr.on('data', (data) => {
                const error = exports.byteToStr(data);
                if (info) {
                    console.warn(error);
                    appendToLog('warn', error);
                }
                stderrData += error;
            });
        }

        childProcess.on('close', (code) => {
            process.chdir(initialWorkingDirectory);
            if (code === 0) {
                resolve(exports.wrapEmdResult(true, stdoutData, null, 0, info));
            } else {
                resolve(exports.wrapEmdResult(false, stdoutData, stderrData, code, info));
            }
        });

        childProcess.on('error', (err) => {
            process.chdir(initialWorkingDirectory);
            const errorMessage = err.toString();
            appendToLog('error', errorMessage);
            resolve(exports.wrapEmdResult(false, stdoutData, err, -1, info));
        });
    });
}

exports.spawnAsync = async function (command, info = true, cwd = null, logname = null, callback = null, timeout = 5000, progressCallback = null) {
    let cmd = '';
    let args = [];
    if (typeof command === 'string') {
        command = command.split(/\s+/);
    }
    if (Array.isArray(command)) {
        cmd = command[0];
        args = command.slice(1);
    } else {
        cmd = command;
    }
    if (info) {
        console.log(command);
    }
    let timer = null;
    let callbackExecuted = false;

    return new Promise((resolve) => {
        const options = { stdio: [0, 'pipe', 'pipe'] };
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
                if (!callbackExecuted && callback) {
                    callback(exports.wrapEmdResult(true, stdoutData, null, 0, info));
                    callbackExecuted = true;
                }
            }, timeout);
        };

        const handleYesNo = (data) => {
            const output = data.toString();
            if (output.match(/(y\/n|yes\/no)/i) && childProcess.stdin) {
                childProcess.stdin.write('Yes\n');
            }
            resetTimer();
            if (info) {
                console.log(output);
            }
            stdoutData += output + '\n';
            progressCallback?.(stdoutData);
        };

        if (childProcess.stdout) {
            childProcess.stdout.on('data', handleYesNo);
        }

        if (childProcess.stderr) {
            childProcess.stderr.on('data', (data) => {
                resetTimer();
                const error = data.toString();
                if (info) {
                    console.warn(error);
                }
                stderrData += error + '\n';
                progressCallback?.(stdoutData);
            });
        }

        childProcess.on('close', (code) => {
            process.chdir(initialWorkingDirectory);
            if (code === 0) {
                resolve(exports.wrapEmdResult(true, stdoutData, null, 0, info));
            } else {
                resolve(exports.wrapEmdResult(false, stdoutData, stderrData, code, info));
            }
        });

        childProcess.on('error', (err) => {
            process.chdir(initialWorkingDirectory);
            resolve(exports.wrapEmdResult(false, stdoutData, err, -1, info));
        });
    });
}

exports.findPowerShellPath = function () {
    const standardPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
    const corePath = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';

    if (fs.existsSync(corePath)) {
        return corePath;
    } else if (fs.existsSync(standardPath)) {
        return standardPath;
    } else {
        console.error('PowerShell not found. Please ensure PowerShell is installed.');
        return null;
    }
}

exports.execPowerShell = function (command, info = false, cwd = null) {
    const powershellPath = exports.findPowerShellPath();
    if (!powershellPath) {
        console.error('PowerShell path is not set.');
        return null;
    }

    if (Array.isArray(command)) {
        command = command.join(" ");
    }
    command = command.trim();
    const fullCommand = `${powershellPath} -Command "${command}"`;
    return exports.execCmd(fullCommand, info, cwd);
}
