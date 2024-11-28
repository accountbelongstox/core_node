import { execSync, spawn, spawnSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

const initialWorkingDirectory = process.cwd();

export function isLinux() {
    return process.platform === 'linux';
}

export function byteToStr(astr) {
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

export function execCmd(command, info = false, cwd = null, logname = null) {
    if (Array.isArray(command)) {
        command = command.join(" ");
    }
    if (info) {
        console.log(`command\t: ${command}`);
        console.log(`cwd\t: ${cwd}`);
    }
    const options = { stdio: 'inherit' };
    let is_changed_dir = false;
    if (cwd) {
        is_changed_dir = true;
        options.cwd = cwd;
        process.chdir(cwd);
    }
    const result = isLinux()
        ? execSync(command, { shell: '/bin/bash', ...options })
        : execSync(command, options);
    const resultText = byteToStr(result);
    if (logname) {
        fs.appendFileSync(path.join(process.cwd(), 'logs', `${logname}.log`), resultText + '\n');
    }
    if (info) {
        console.log(resultText);
    }
    if (is_changed_dir) {
        process.chdir(initialWorkingDirectory);
    }
    return resultText;
}

export async function execCommand(command, info = true, cwd = null, logname = null) {
    if (Array.isArray(command)) {
        command = command.join(" ");
    }
    if (info) {
        console.log(command);
    }
    return new Promise((resolve, reject) => {
        const options = { stdio: 'pipe' };
        if (cwd) {
            options.cwd = cwd;
            process.chdir(cwd);
        }
        const childProcess = isLinux()
            ? spawnSync('/bin/bash', ['-c', command], options)
            : spawnSync(command, options);

        let stdoutData = '';
        let stderrData = '';
        childProcess.stdout.on('data', (data) => {
            const output = byteToStr(data);
            if (info) {
                console.log(output);
            }
            stdoutData += output;
        });
        childProcess.stderr.on('data', (data) => {
            const error = byteToStr(data);
            if (info) {
                console.warn(error);
            }
            stderrData += error;
        });
        childProcess.on('close', (code) => {
            process.chdir(initialWorkingDirectory);
            if (logname) {
                fs.appendFileSync(path.join(process.cwd(), 'logs', `${logname}.log`), stdoutData + '\n');
            }
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
                console.log(output);
            }
            stdoutData += output + '\n';
            progressCallback?.(stdoutData);
        };

        childProcess.stdout.on('data', handleYesNo);

        childProcess.stderr.on('data', (data) => {
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

export function findPowerShellPath() {
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

export function execPowerShell(command, info = false, cwd = null, no_std = false, env = null) {
    const powershellPath = findPowerShellPath();
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
