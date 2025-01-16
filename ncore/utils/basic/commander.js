const { execSync, spawn, spawnSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
let log;
try {
    const logger = require('#@/ncore/utils/logger/index.js');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args),
        debug: (...args) => logger.debug ? logger.debug(...args) : console.log('[DEBUG]', ...args),
        command: (...args) => logger.command(...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args),
        debug: (...args) => console.log('[DEBUG]', ...args),
        command: (...args) => console.log('[COMMAND]', ...args)
    };
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
        fs.appendFileSync(path.join(process.cwd(), 'logs', `${logname}.log`), resultText + '\n');
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
            fs.appendFileSync(path.join(process.cwd(), 'logs', `${logname}.log`), stdoutData + '\n');
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
        throw error;
    }
}

function pipeExecCmdAsync(command, useShell = true, cwd = null, inheritIO = true, env = process.env) {
    return spawnAsync(command, useShell, cwd, inheritIO, env);
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
    pipeExecCmdAsync
};

