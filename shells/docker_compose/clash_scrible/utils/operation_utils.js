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