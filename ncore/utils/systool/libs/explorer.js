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

class ExplorerLauncher {
    constructor() {
        this.supportedExtensions = ['.cmd', '.bat', '.sh'];
    }

    /**
     * Search for executable files in a directory with specific extensions
     * @param {string} directory - Directory to search in
     * @param {string} baseName - Base name to search for (without extension)
     * @returns {string|null} - Found file path or null
     */
    searchExecutableFile(directory, baseName) {
        if (!fs.existsSync(directory)) {
            return null;
        }

        for (const ext of this.supportedExtensions) {
            const filePath = path.join(directory, baseName + ext);
            if (fs.existsSync(filePath)) {
                logger.info(`Found executable file: ${filePath}`);
                return filePath;
            }
        }

        return null;
    }

    /**
     * Launch a file using system explorer/file manager
     * @param {string} filePath - Path to the file to launch
     * @returns {Promise<boolean>} - Success status
     */
    async launchWithExplorer(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                logger.error(`File not found: ${filePath}`);
                return false;
            }

            let command;
            
            if (isWindows) {
                // Use explorer to launch the file, which will detach from main process
                command = `explorer "${filePath}"`;
            } else if (isMac) {
                // Use open command on macOS
                command = `open "${filePath}"`;
            } else if (isLinux) {
                // Use xdg-open on Linux
                command = `xdg-open "${filePath}"`;
            } else {
                logger.error('Unsupported operating system for explorer launch');
                return false;
            }

            logger.info(`Launching with explorer: ${command}`);
            
            // Use spawn with detached option to prevent blocking
            await commander.execDetached(command);
            
            logger.success(`Successfully launched: ${filePath}`);
            return true;
        } catch (error) {
            logger.error(`Failed to launch file with explorer: ${error.message}`);
            return false;
        }
    }

    /**
     * Search and launch executable files in app directory
     * @param {string} appDirectory - App directory path
     * @param {string} appName - App name for searching main.cmd/main.bat
     * @returns {Promise<boolean>} - Success status
     */
    async searchAndLaunchAppExecutables(appDirectory, appName) {
        if (!fs.existsSync(appDirectory)) {
            logger.warn(`App directory not found: ${appDirectory}`);
            return false;
        }

        // Search for main.cmd/main.bat first
        const mainExecutable = this.searchExecutableFile(appDirectory, 'main');
        if (mainExecutable) {
            logger.info(`Found main executable for app ${appName}: ${mainExecutable}`);
            return await this.launchWithExplorer(mainExecutable);
        }

        // Search for app-specific executable (appname.cmd/appname.bat)
        const appExecutable = this.searchExecutableFile(appDirectory, appName);
        if (appExecutable) {
            logger.info(`Found app-specific executable for app ${appName}: ${appExecutable}`);
            return await this.launchWithExplorer(appExecutable);
        }

        logger.info(`No executable files found in app directory: ${appDirectory}`);
        return false;
    }
}

module.exports = new ExplorerLauncher();
