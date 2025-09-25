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

const path = require('path');
const { execCmd } = require('#@commander');
const logger = require('#@logger');
const gconfig = require('#@gconfig');

async function execWingetCommand(command, silent = false) {
    try {
        const result = await execCmd(`winget ${command}`, !silent);
        return result;
    } catch (error) {
        logger.error(`Winget command failed: ${command}`);
        logger.error(error);
        throw error;
    }
}

async function installSoftwareById(winget_id, installDir = null, silent = true, callback = null, progressCallback = null) {
    const targetDir = installDir || path.join(gconfig.APP_INSTALL_DIR, winget_id);

    try {
        let command = `install --id "${winget_id}"`;
        if (silent) {
            command += ` --accept-package-agreements --location "${targetDir}" --silent`;
        }
        
        logger.info(`Installing ${winget_id}...`);
        const result = await execWingetCommand(command, silent);
        
        logger.success(`Software ${winget_id} installed successfully.`);
        if (progressCallback) {
            progressCallback(100, result);
        }
        if (callback) callback();
        return true;
    } catch (error) {
        logger.error(`Failed to install software ${winget_id}`);
        if (progressCallback) {
            progressCallback(-1, error);
        }
        if (callback) callback();
        return false;
    }
}

async function installSoftwareByName(softwareName, installDir = null, silent = true, callback = null, progressCallback = null) {
    const targetDir = installDir || path.join(gconfig.APP_INSTALL_DIR, softwareName);

    try {
        const searchResults = await searchSoftware(softwareName);
        if (!searchResults || searchResults.length === 0) {
            throw new Error(`Software "${softwareName}" not found`);
        }

        const winget_id = searchResults[0].id;
        return await installSoftwareById(
            winget_id,
            targetDir,
            silent,
            callback,
            progressCallback
        );
    } catch (error) {
        logger.error(`Failed to install software "${softwareName}":`, error);
        if (progressCallback) {
            progressCallback(-1, error);
        }
        if (callback) callback();
        return false;
    }
}

async function installSoftware(software, silent = true, callback = null) {
    if (typeof software === 'string') {
        return installSoftwareByName(software, null, silent, callback);
    }

    const appDir = software.appDir || gconfig.APP_INSTALL_DIR;
    const basename = software.basename || software.winget_id;
    const { winget_id, progressCallback } = software;

    const installDir = path.join(appDir, basename);
    return installSoftwareById(
        winget_id,
        installDir,
        silent,
        callback,
        progressCallback
    );
}

async function isInstalled(software) {
        let winget_id;
        if (typeof software !== 'string') {
            winget_id = software.winget_id;
        } else {
            winget_id = software;
        }

        try {
        const stdout = await execWingetCommand('list', true);
        return stdout.includes(winget_id);
        } catch (err) {
        logger.error(`Error checking if software ${winget_id} is installed`);
            return false;
        }
    }

function parseInstalledSoftwareList(output) {
        const lines = output.split('\n').filter(line => line.trim() !== '');
    return lines.map(line => {
            const parts = line.split('\t');
            return {
            name: parts[0]?.trim() || '',
            id: parts[1]?.trim() || ''
            };
        });
}

async function getInstalledList() {
    try {
        const stdout = await execWingetCommand('list', true);
        return parseInstalledSoftwareList(stdout);
        } catch (err) {
        logger.error('Error getting installed software list');
            return [];
        }
    }

async function searchSoftware(query) {
    try {
        const stdout = await execWingetCommand(`search "${query}"`, true);
        return parseSearchResults(stdout);
        } catch (err) {
        logger.error(`Error searching for software with query "${query}"`);
            return [];
        }
    }

function parseSearchResults(output) {
        const lines = output.split('\n').filter(line => line.trim() !== '');
    return lines.map(line => {
            const parts = line.split('\t');
            return {
            name: parts[0]?.trim() || '',
            id: parts[1]?.trim() || ''
            };
        });
}

async function uninstallSoftwareById(winget_id, silent = true) {
    try {
        let command = `uninstall --id "${winget_id}"`;
        if (silent) {
            command += ` --silent`;
        }
        
        logger.info(`Uninstalling ${winget_id}...`);
        await execWingetCommand(command, silent);
        logger.success(`Software ${winget_id} uninstalled successfully.`);
        return true;
    } catch (error) {
        logger.error(`Failed to uninstall software ${winget_id}`);
        logger.error(error);
        return false;
    }
}

async function forceInstallSoftwareById(winget_id, installDir = null, silent = true, callback = null, progressCallback = null) {
    try {
        // First check if software is installed
        const isAlreadyInstalled = await isInstalled(winget_id);
        
        // If installed, uninstall it first
        if (isAlreadyInstalled) {
            logger.info(`${winget_id} is already installed. Uninstalling first...`);
            const uninstallResult = await uninstallSoftwareById(winget_id, silent);
            if (!uninstallResult) {
                throw new Error(`Failed to uninstall existing ${winget_id}`);
            }
        }

        // Now proceed with fresh installation
        return await installSoftwareById(winget_id, installDir, silent, callback, progressCallback);
    } catch (error) {
        logger.error(`Force installation failed for ${winget_id}`);
        logger.error(error);
        if (progressCallback) {
            progressCallback(-1, error);
        }
        if (callback) callback();
        return false;
    }
}

module.exports = {
    execWingetCommand,
    installSoftwareById,
    installSoftwareByName,
    installSoftware,
    isInstalled,
    getInstalledList,
    searchSoftware,
    parseInstalledSoftwareList,
    parseSearchResults,
    uninstallSoftwareById,
    forceInstallSoftwareById
};