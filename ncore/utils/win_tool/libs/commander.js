const { execSync, spawn, spawnSync } = require('child_process');
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const readline = require('readline');

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

    function wrapEmdResult(success, stdout, error, code, info) {
        if (success === undefined) success = true;
        if (info) {
            stdout = byteToStr(stdout);
            error = byteToStr(stdout);
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

    function execCmd(command, info, cwd, logname) {
        if (Array.isArray(command)) {
            command = command.join(" ");
        }
        if (info) {
            console.log(`Command: ${command}`);
            console.log(`Working directory: ${cwd}`);
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

        const result = execSync(command, options);
        const resultText = result.toString();

        if (logname) {
            appendToLog(logname, resultText);
        }
        if (info) {
            console.log(resultText);
        }
        if (hasChangedDir) {
            process.chdir(initialWorkingDirectory);
        }
        return resultText;
    }

    function execCommand(command, info, cwd, logname) {
        if (Array.isArray(command)) {
            command = command.join(" ");
        }
        if (info) {
            console.log(`Executing command: ${command}`);
        }

        return new Promise((resolve, reject) => {
            const platformShell = getPlatformShell();
            const options = { stdio: 'pipe' };

            if (cwd) {
                options.cwd = cwd;
                process.chdir(cwd);
            }

            const childProcess = spawnSync(
                platformShell.command,
                [...platformShell.args, command],
                options
            );

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
                    appendToLog(logname, stdoutData);
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

    function spawnAsync(command, info, cwd, logname, callback, timeout, progressCallback) {
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
        console.error('PowerShell not found. Please ensure PowerShell is installed.');
        return null;
    }

    function execPowerShell(command, info, cwd, no_std, env) {
        if (process.platform !== 'win32') {
            console.error('PowerShell commands are only supported on Windows');
            return null;
        }

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

    function pipeExecCmd(command, useShell, cwd, inheritIO, env) {
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

            return execSync(command, options);
        } catch (error) {
            console.error(`Command execution failed: ${command}`);
            console.error(error);
            throw error;
        }
    }

    function pipeExecCmdAsync(command, useShell, cwd, inheritIO, env) {
        return spawnAsync(command, useShell, cwd, inheritIO, env);
    }

    module.exports = {
        getPlatformShell,
        isLinux,
        byteToStr,
        wrapEmdResult,
        execCmd,
        execCommand,
        spawnAsync,
        findPowerShellPath,
        execPowerShell,
        pipeExecCmd,
        pipeExecCmdAsync
    };