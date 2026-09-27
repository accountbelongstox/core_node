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
