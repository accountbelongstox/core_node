const os = require('os');
const commander = require('#@commander');

function isWindows() {
    return os.platform() == 'win32';
}

function execCmdResultText(command, info = true, cwd = null) {
    return commander.execCmdResultText(command, info, cwd);
}

function pipeExecCmd(command, useShell = true, cwd = null, inheritIO = true, env = process.env, info = true) {
    return commander.pipeExecCmd(command, useShell, cwd, inheritIO, env, info);
}

function execPowerShell(command, info = false, cwd = null, no_std = false, cmdEnv = null) {
    return commander.execPowerShell(command, info, cwd, no_std, cmdEnv);
}

function execCmdShell(command, ignoreError = false, cwd = null, print = true) {
    return commander.execCmdShell(command, ignoreError, cwd, print);
}

module.exports = {
    isWindows,
    getPlatformShell: commander.getPlatformShell,
    byteToStr: commander.byteToStr,
    execCmdResultText,
    pipeExecCmd,
    execPowerShell,
    execCmdShell
};
