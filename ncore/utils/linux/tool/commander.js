import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const initialWorkingDirectory = process.cwd();
const powershellPath = os.platform() === 'win32' ? findPowerShellPath() : null;

function findPowerShellPath() {
    const standardPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
    const corePath = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';

    if (fs.existsSync(corePath)) {
        return corePath;
    } else if (fs.existsSync(standardPath)) {
        return standardPath;
    }
    console.error('PowerShell not found. Please ensure PowerShell is installed.');
    return null;
}

export function isWindows() {
    return os.platform() === 'win32';
}

export function isLinux() {
    return os.platform() === 'linux';
}

export function isDir(dir) {
    try {
        const stats = fs.statSync(dir);
        return stats.isDirectory();
    } catch (err) {
        console.error(`Error checking if directory: ${err.message}`);
        return false;
    }
}

export function runExe(command, info = true) {
    const cmd = isWindows() ? `start ${command}` : command;
    try {
        const result = execSync(cmd, { encoding: 'utf-8' });
        if (info) {
            console.info(`Run-Exe-command: ${command}`);
            console.info(result);
        }
        return result;
    } catch (e) {
        console.error(`Error runExe: ${command}`);
        console.error(e);
        return '';
    }
}

export function execPowerShell(command, info = false, cwd = null, no_std = false, env = null) {
    if (!powershellPath) {
        console.error('PowerShell path is not set.');
        return null;
    }

    if (Array.isArray(command)) {
        command = command.join(" ");
    }
    command = command.trim();
    const fullCommand = `${powershellPath} -Command "${command}"`;
    return execCmd(fullCommand, info, cwd, no_std, env);
}

export function pipeExecCmd(command, cwd = null, env = null) {
    return execCmd(command, true, cwd, true, env);
}

export function execCmd(command, info = false, cwd = null, no_std = false, env = null) {
    if (env) {
        env = Object.assign({}, process.env, env);
    }

    if (Array.isArray(command)) {
        command = command.join(" ");
    }
    command = command.trim();
    if (info) {
        console.info(`command\t: ${command}`);
        if (cwd) console.info(`cwd\t: ${cwd}`);
    }
    const options = no_std ? { stdio: 'inherit' } : {};
    if (env) options.env = env;
    let isChangedDir = false;

    if (cwd && isDir(cwd)) {
        isChangedDir = true;
        options.cwd = cwd;
        process.chdir(cwd);
    }
    let result;
    try {
        if (isLinux()) {
            try {
                result = execSync(command, { shell: '/bin/bash', ...options });
            } catch (error) {
                result = execSync(command, { shell: 'sh', ...options });
            }
        } else {
            result = execSync(command, options);
        }
    } catch (error) {
        console.error(`Error executing command: ${error.message}`);
        result = Buffer.from(error.message, 'utf8');
    }

    const resultText = byteToStr(result);
    if (info) {
        console.info(`execCmd-resultText:`);
        console.info(resultText);
    }

    if (isChangedDir) {
        process.chdir(initialWorkingDirectory);
    }

    return resultText;
}

export function byteToStr(astr) {
    if (Buffer.isBuffer(astr)) {
        astr = astr.toString('utf-8');
    } else {
        astr = String(astr);
        const isByte = /^b\'{0,1}/;
        if (isByte.test(astr)) {
            astr = astr.replace(/^b\'{0,1}/, '').replace(/\'{0,1}$/, '');
        }
    }
    astr = astr.replace(/\x00/g, '');
    return astr;
}

export function wrapEmdResult(success = true, stdout = '', error = null, code = 0, info = true) {
    stdout = byteToStr(stdout);
    error = byteToStr(stdout);
    if (info) {
        console.info(stdout);
        console.warn(error);
    }
    return {
        success,
        stdout,
        error,
        code
    };
}

export async function spawnAsync(command, info = true, cwd = null, logname = null, callback, timeout = 5000, progressCallback = null) {
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
        const options = {
            stdio: ['pipe', 'pipe', 'pipe']
        };
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

        if (childProcess.stdin) {
            const handleYesNo = (data) => {
                const output = data.toString();
                if (output.match(/(y\/n|yes\/no)/i)) {
                    childProcess.stdin?.write('Yes\n');
                }
            };

            childProcess.stdout?.on('data', handleYesNo);
        }

        childProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            resetTimer();
            if (info) {
                console.log(output);
            }
            stdoutData += output + '\n';
            progressCallback?.(stdoutData);
        });

        childProcess.stderr?.on('data', (data) => {
            resetTimer();
            const error = data.toString();
            if (info) {
                console.warn(error);
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
