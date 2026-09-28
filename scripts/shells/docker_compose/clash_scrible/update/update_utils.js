const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { exec } = require('child_process');
const execPromise = promisify(exec);
const { scriptDir, local_dir, isMainRouterDevice, clash_scrible_dir, out_dir, isDevelopmentEnvironment, bak_dir } = require('../provider/global_var');
const {
    forceUpdateRepo,
    runGitCommand,
    cloneRepository,
    ensureRepositoryCloned
} = require('./git_utils');
const logger = require('../utils/log_utils');
const { getConfigValue, getOrSetConfigValue, setConfigValue } = require('../utils/config_utils');
const os = require('os');

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        // Skip node_modules folders
        if (entry.isDirectory() && entry.name === 'node_modules') {
            continue;
        }

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function removeDir(dir) {
    let entries = fs.readdirSync(dir, { withFileTypes: true });

    for (let entry of entries) {
        let fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            removeDir(fullPath);
        } else {
            fs.unlinkSync(fullPath);
        }
    }

    fs.rmdirSync(dir);
}

async function getGitRepoUrl() {
    if (isMainRouterDevice) {
        return getConfigValue('remoteLocalGitUrl');
    }
    return getConfigValue('remoteGitUrl');
}

async function checkForNewVersion() {
    const gitRepoUrl = await getGitRepoUrl();
    const scriptPath = path.join(scriptDir, 'script');

    await ensureRepositoryCloned(gitRepoUrl, scriptPath);

    const lastUpdateTime = getOrSetConfigValue('lastUpdateTime', Date.now());
    logger.log(`Last update time: ${new Date(lastUpdateTime)}`);

    const lastCommitTime = await getLastCommitTime(scriptPath);
    logger.log(`Last commit time: ${new Date(lastCommitTime)}`);

    const isNewVersionAvailable = lastCommitTime > lastUpdateTime;
    logger.log(`New version available: ${isNewVersionAvailable}`);

    if (isNewVersionAvailable) {
        return {
            newVersionAvailable: true,
            lastCommitTime: lastCommitTime,
            lastUpdateTime: lastUpdateTime,
            timeDifference: lastCommitTime - lastUpdateTime
        };
    } else {
        return {
            newVersionAvailable: false,
            lastCommitTime: lastCommitTime,
            lastUpdateTime: lastUpdateTime,
            timeDifference: 0
        };
    }
}

async function getLastCommitTime() {
    const gitRepoUrl = await getGitRepoUrl();
    const scriptPath = path.join(scriptDir, 'script');

    if (!fs.existsSync(scriptPath) || fs.readdirSync(scriptPath).length === 0) {
        console.log(`Script directory not found or empty. Cloning repository to ${scriptPath}`);
        try {
            await cloneRepository(gitRepoUrl, scriptPath);
            console.log('Repository cloned successfully');
        } catch (error) {
            console.error('Error cloning repository:', error);
            return null;
        }
    } else {
        console.log(`Updating repository at ${scriptPath}`);
        try {
            await forceUpdateRepo(scriptPath);
            console.log('Repository updated successfully');
        } catch (error) {
            console.error('Error updating repository:', error);
        }
    }

    const result = await runGitCommand(['log', '-1', '--format=%cd'], scriptPath);
    return result.trim();
}

function restartProgram() {
    logger.log("Triggering nodemon restart...");

    const triggerFile = path.join(local_dir, '.restart-trigger');
    try {
        fs.writeFileSync(triggerFile, Date.now().toString());
        logger.log("Restart trigger file updated. Nodemon should detect the change and restart.");
    } catch (error) {
        logger.logRed(`Error triggering restart: ${error.message}`);
        manualRestart();
    }
}

function manualRestart() {
    logger.log("Falling back to manual restart...");
    process.on('exit', () => {
        exec(`cd ${local_dir} && node main.js`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Execution error: ${error}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
        });
    });
    process.exit();
}

async function updateAndRestart() {
    try {
        const gitRepoUrl = await getGitRepoUrl();
        const scriptPath = path.join(scriptDir, 'script');
        const clashScriblePath = path.join(scriptPath, clash_scrible_dir);

        const updateTargetDir = !isDevelopmentEnvironment ? local_dir : path.join(out_dir, '.update_test');

        await ensureRepositoryCloned(gitRepoUrl, scriptPath);

        const backupDir = path.join(bak_dir, `backup_${Date.now()}`);
        copyDir(local_dir, backupDir);
        logger.log(`Backup created at ${backupDir}`);

        cleanupBackups();

        logger.log(`Updated files copying from ${clashScriblePath} to ${updateTargetDir}`);
        copyDirWithStatus(clashScriblePath, updateTargetDir);
        logger.log(`Updated files copied from ${clashScriblePath} to ${updateTargetDir}`);

        setConfigValue('lastUpdateTime', Date.now());

        logger.log("Update completed. Installing dependencies...");

        try {
            await Promise.race([
                execPromise(`cd ${updateTargetDir} && yarn install`, { timeout: 180000 }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Yarn install timed out')), 180000))
            ]);
            logger.log("Dependencies installed successfully.");
        } catch (error) {
            logger.logRed(`Error during yarn install: ${error.message}`);
        }

        restartProgram();
    } catch (error) {
        logger.logRed(`Error during force update and restart: ${error.message}`);
        throw error;
    }
}

function copyDirWithStatus(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        if (entry.isDirectory() && entry.name === 'node_modules') {
            logger.logGray(`Skipping node_modules: ${srcPath}`);
            continue;
        }

        if (entry.isDirectory()) {
            copyDirWithStatus(srcPath, destPath);
        } else {
            try {
                const destExists = fs.existsSync(destPath);
                fs.copyFileSync(srcPath, destPath);
                if (!destExists) {
                    logger.logGray(`New file: ${destPath}`);
                } else {
                    logger.logGreen(`Replaced file: ${destPath}`);
                }
            } catch (error) {
                logger.logRed(`Replacement failed: ${destPath} - ${error.message}`);
            }
        }
    }
}

function cleanupBackups() {
    const backups = fs.readdirSync(bak_dir);
    const backupDirs = backups
        .filter(dir => dir.startsWith('backup_') && !isNaN(dir.slice(7)))
        .sort((a, b) => parseInt(b.slice(7)) - parseInt(a.slice(7)));

    logger.log(`Found ${backupDirs.length} backups. Keeping the latest 5.`);

    for (let i = 5; i < backupDirs.length; i++) {
        const dirToRemove = path.join(bak_dir, backupDirs[i]);
        logger.log(`Removing old backup: ${dirToRemove}`);
        removeDir(dirToRemove);
    }

    logger.log(`Backup cleanup completed. ${Math.max(backupDirs.length - 5, 0)} old backups removed.`);
}

// Example usage
if (require.main === module) {
    (async () => {
        // Check for new version
        const versionCheck = await checkForNewVersion();

        if (versionCheck.newVersionAvailable) {
            logger.log(`New version available. ${versionCheck.newerDir} is newer by ${versionCheck.timeDifference} milliseconds.`);
            // If a new version is available, update and restart
            await updateAndRestart();
        } else {
            logger.log("No updates available.");
        }
    })();
}

module.exports = {
    checkForNewVersion,
    updateAndRestart,
    getLastCommitTime,
    restartProgram
};
