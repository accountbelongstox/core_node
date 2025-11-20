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

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const { local_dir } = require('../provider/global_var');
const logger = require('./log_utils');

function exitProgram() {
    logger.log("Exiting program...");
    process.exit(0);  // Equivalent to calling `exit()`
}

function restartProgram() {
    logger.log("Restarting program in 3 seconds...");

    const nodeExecutable = process.execPath;
    const scriptPath = path.join(local_dir, 'main.js');

    const command = [nodeExecutable, ...process.argv.slice(1)];

    setTimeout(() => {
        let options = {};
        if (os.platform() === "win32") {
            options = {
                detached: true,
                stdio: 'ignore'
            };
        }

        const child = spawn(nodeExecutable, [scriptPath], options);

        if (os.platform() === "win32") {
            child.unref();
        }

        process.exit(0);
    }, 3000);
}

// Example usage
if (require.main === module) {
    setTimeout(() => {
        restartProgram();  // Call the restart logic
    }, 2000);
}

module.exports = {
    exitProgram,
    restartProgram
};