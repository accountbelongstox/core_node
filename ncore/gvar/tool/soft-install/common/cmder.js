const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
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

function isWindows() {
    return os.platform() == 'win32';
}

const initialWorkingDirectory = process.cwd();

function getPlatformShell() {
    return isWindows() ?
        { shell: true, command: 'cmd.exe', args: ['/c'] } :
        { shell: '/bin/sh', command: '/bin/sh', args: ['-c'] };
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

function execCmdResultText(command, info = true, cwd = null) {
    if (Array.isArray(command)) {
        command = command.join(" ");
    }
    if (info) {
        log.command(`${command}`);
    }
    const platformShell = getPlatformShell();
    const options = {
        shell: typeof platformShell.shell === 'boolean' ? 'cmd.exe' : platformShell.shell,
        encoding: 'utf8'
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
        log.error(`${e}`);
        resultText = ""
    }
    if (hasChangedDir) {
        process.chdir(initialWorkingDirectory);
    }
    return resultText;
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

module.exports = {
    isWindows,
    getPlatformShell,
    byteToStr,
    execCmdResultText,
    pipeExecCmd,
    execPowerShell
}; 