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
const fs = require('fs');
const { isWindows, isLinux, isMac } = require('#@global_vars');
const commander = require('#@commander');
const logger = require('#@logger');

/**
 * App Executable Launcher
 *
 * Searches for and launches executable files in app directory.
 * Similar to ncore/utils/systool/libs/explorer.js but designed for launcher integration.
 *
 * Supports:
 * - Windows: .cmd, .bat files
 * - Linux: .sh files
 * - macOS: .sh files
 */

class AppExecutableLauncher {
    constructor() {
        if (isWindows) {
            this.supportedExtensions = ['.cmd', '.bat'];
        } else if (isLinux || isMac) {
            this.supportedExtensions = ['.sh'];
        } else {
            this.supportedExtensions = [];
        }
    }

    searchExecutableFile(directory, baseName) {
        if (!fs.existsSync(directory)) {
            return null;
        }

        for (const ext of this.supportedExtensions) {
            const filePath = path.join(directory, baseName + ext);
            if (fs.existsSync(filePath)) {
                logger.info(`[Launcher] Found executable file: ${filePath}`);
                return filePath;
            }
        }

        return null;
    }

    async launchWithExplorer(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                logger.error(`[Launcher] File not found: ${filePath}`);
                return false;
            }

            let command;

            if (isWindows) {
                command = `explorer "${filePath}"`;
            } else if (isMac) {
                command = `open "${filePath}"`;
            } else if (isLinux) {
                command = `xdg-open "${filePath}"`;
            } else {
                logger.error('[Launcher] Unsupported operating system for explorer launch');
                return false;
            }

            logger.info(`[Launcher] Launching with explorer: ${command}`);

            await commander.execDetached(command);

            logger.success(`[Launcher] Successfully launched: ${filePath}`);
            return true;
        } catch (error) {
            logger.error(`[Launcher] Failed to launch file with explorer: ${error.message}`);
            return false;
        }
    }

    async searchAndLaunchAppExecutables(appDirectory, appName) {
        if (!isWindows) {
            logger.info('[Launcher] Skipping launcher discovery: automatic explorer start is only available on Windows environments.');
            return false;
        }

        if (!fs.existsSync(appDirectory)) {
            logger.warn(`[Launcher] App directory not found: ${appDirectory}`);
            return false;
        }

        const mainExecutable = this.searchExecutableFile(appDirectory, 'main');
        if (mainExecutable) {
            logger.info(`[Launcher] Found main executable for app ${appName}: ${mainExecutable}`);
            return await this.launchWithExplorer(mainExecutable);
        }

        const appExecutable = this.searchExecutableFile(appDirectory, appName);
        if (appExecutable) {
            logger.info(`[Launcher] Found app-specific executable for app ${appName}: ${appExecutable}`);
            return await this.launchWithExplorer(appExecutable);
        }

        logger.info(`[Launcher] No executable files found in app directory: ${appDirectory}`);
        return false;
    }
}

let _instance = null;

function getAppExecutableLauncher() {
    if (!_instance) {
        _instance = new AppExecutableLauncher();
    }
    return _instance;
}

module.exports = {
    AppExecutableLauncher,
    getAppExecutableLauncher
};
