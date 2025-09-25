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
const { pipeExecCmd, execCmd } = require('#@commander');
const logger = require('#@/ncore/basic/libs/logger.js');
const gconfig = require('#@gconfig');

// 辅助函数：检查路径是否已包含软件名
function hasPackageNameInPath(installDir, packageName) {
    const normalizedInstallDir = path.normalize(installDir).toLowerCase();
    const normalizedPackageName = packageName.toLowerCase();
    return normalizedInstallDir.endsWith(normalizedPackageName) ||
        normalizedInstallDir.includes(`\\${normalizedPackageName}\\`);
}

// 辅助函数：获取合适的安装目录
function getInstallDir(baseDir, packageName) {
    if (!baseDir) {
        return path.join(gconfig.APP_INSTALL_DIR, packageName);
    }
    return hasPackageNameInPath(baseDir, packageName) ? baseDir : path.join(baseDir, packageName);
}

async function execWingetCommand(command, silent = false) {
    const fullCommand = `winget ${command}`;
    logger.command(`Executing: ${fullCommand}`);  // 预览命令

    try {
        const result = await pipeExecCmd(fullCommand, !silent);
        return result;
    } catch (error) {
        logger.error(`Winget command failed: ${command}`);
        logger.error(error);
        return null;
    }
}

async function installSoftwareById(winget_id, installDir = null, silent = true, callback = null, progressCallback = null) {
    // 将 winget_id 转换为合适的文件夹名
    const folderName = winget_id.replace(/[^\w.-]/g, '_');
    const targetDir = getInstallDir(installDir, folderName);

    try {
        let command = `install --id "${winget_id}"`;
        if (silent) {
            command += ` --accept-package-agreements --location "${targetDir}" --silent`;
        }

        logger.info(`Installing ${winget_id} to ${targetDir}...`);
        const result = await execWingetCommand(command, silent);
        if (!result) {
            logger.error(`Failed to install software ${winget_id}`);
            if (progressCallback) progressCallback(-1, 'Installation failed');
            if (callback) callback();
            return false;
        }

        logger.success(`Software ${winget_id} installed successfully.`);
        if (progressCallback) progressCallback(100, result);
        if (callback) callback();
        return true;
    } catch (error) {
        logger.error(`Failed to install software ${winget_id}`);
        if (progressCallback) progressCallback(-1, error);
        if (callback) callback();
        return false;
    }
}

async function installSoftwareByName(softwareName, installDir = null, silent = true, callback = null, progressCallback = null) {
    // 将软件名转换为合适的文件夹名
    const folderName = softwareName.replace(/[^\w.-]/g, '_');
    const targetDir = getInstallDir(installDir, folderName);

    try {
        const searchResults = await searchSoftware(softwareName);
        if (!searchResults || searchResults.length === 0) {
            logger.error(`Software "${softwareName}" not found`);
            if (progressCallback) progressCallback(-1, 'Software not found');
            if (callback) callback();
            return false;
        }

        const winget_id = searchResults[0].id;
        // 使用 winget_id 作为文件夹名，而不是软件名
        const wingetFolderName = winget_id.replace(/[^\w.-]/g, '_');
        const finalTargetDir = getInstallDir(installDir, wingetFolderName);

        return await installSoftwareById(
            winget_id,
            finalTargetDir,
            silent,
            callback,
            progressCallback
        );
    } catch (error) {
        logger.error(`Failed to install software "${softwareName}":`, error);
        if (progressCallback) progressCallback(-1, error);
        if (callback) callback();
        return false;
    }
}

async function installSoftware(software, silent = true, callback = null) {
    if (typeof software === 'string') {
        return installSoftwareByName(software, null, silent, callback);
    }

    const appDir = software.appDir || gconfig.APP_INSTALL_DIR;
    const winget_id = software.winget_id;
    const basename = software.basename || winget_id.replace(/[^\w.-]/g, '_');
    const { progressCallback } = software;

    const installDir = getInstallDir(appDir, basename);
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
        const stdout = await execCmd(`winget list `);
        return stdout ? stdout.includes(winget_id) : false;
    } catch (err) {
        logger.error(`Error checking if software ${winget_id} is installed`);
        return false;
    }
}

function parseInstalledSoftwareList(output) {
    if (!output) return [];
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
        const stdout = await execCmd(`winget list `);
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
    if (!output) return [];
    const lines = output.split('\n').filter(line => line.trim() !== '');
    return lines.map(line => {
        const parts = line.split('\t');
        return {
            name: parts[0]?.trim() || '',
            id: parts[1]?.trim() || ''
        };
    });
}

async function uninstallSoftwareById(winget_id, silent = true, callback = null, progressCallback = null) {
    try {
        let command = `uninstall --id "${winget_id}"`;
        if (silent) {
            command += ` --silent`;
        }

        logger.info(`Uninstalling ${winget_id}...`);
        const result = await execWingetCommand(command, silent);
        if (!result) {
            logger.error(`Failed to uninstall software ${winget_id}`);
            if (progressCallback) progressCallback(-1, 'Uninstallation failed');
            if (callback) callback();
            return false;
        }

        logger.success(`Software ${winget_id} uninstalled successfully.`);
        if (progressCallback) progressCallback(100, result);
        if (callback) callback();
        return true;
    } catch (error) {
        logger.error(`Failed to uninstall software ${winget_id}`);
        if (progressCallback) progressCallback(-1, error);
        if (callback) callback();
        return false;
    }
}

async function uninstallSoftwareByName(softwareName, silent = true, callback = null, progressCallback = null) {
    try {
        // 先检查是否已安装
        const installedList = await getInstalledList();
        const installedSoftware = installedList.find(
            software => software.name.toLowerCase().includes(softwareName.toLowerCase())
        );

        if (!installedSoftware) {
            logger.error(`Software "${softwareName}" is not installed`);
            if (progressCallback) progressCallback(-1, 'Software not installed');
            if (callback) callback();
            return false;
        }

        return await uninstallSoftwareById(
            installedSoftware.id,
            silent,
            callback,
            progressCallback
        );
    } catch (error) {
        logger.error(`Failed to uninstall software "${softwareName}":`, error);
        if (progressCallback) progressCallback(-1, error);
        if (callback) callback();
        return false;
    }
}

async function uninstallSoftware(software, silent = true, callback = null) {
    if (typeof software === 'string') {
        return uninstallSoftwareByName(software, silent, callback);
    }

    const { winget_id, progressCallback } = software;
    return uninstallSoftwareById(
        winget_id,
        silent,
        callback,
        progressCallback
    );
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
    uninstallSoftwareByName,
    uninstallSoftware
};