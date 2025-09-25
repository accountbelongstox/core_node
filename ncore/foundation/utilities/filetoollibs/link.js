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

const fs = require('fs');
const path = require('path');
const { execCmd } = require('#@commander');
const logger = require('#@logger');
const isWindows = os.platform() === 'win32';
const USE_DRIVER = isWindows ? (fs.existsSync('D:\\') ? "D:" : "C:") : null
const TEMP_DIR = isWindows ? path.join(USE_DRIVER, '.tmp') : "/tmp/.tmp"
const DOWNLOAD_DIR = path.join(TEMP_DIR, '.downloads');
ensureDir(TEMP_DIR)
ensureDir(DOWNLOAD_DIR)

function getPlatformShell() {
    return process.platform === 'win32' ?
        { shell: true, command: 'cmd.exe', args: ['/c'] } :
        { shell: '/bin/sh', command: '/bin/sh', args: ['-c'] };
}

function pipeExecCmd(command, useShell = true, cwd = null, inheritIO = true, env = process.env, info = true) {
    return new Promise((resolve, reject) => {
        try {
            const platformShell = getPlatformShell();
            const options = {
                shell: useShell ? (process.platform === 'win32' ? true : platformShell.shell) : false,
                cwd: cwd || process.cwd(),
                stdio: inheritIO ? 'inherit' : 'pipe',
                env: env
            };

            if (Array.isArray(command)) {
                command = command.join(' ');
            }
            if (info) {
                logger.command(`${command}`);
            }
            const result = execSync(command, options);
            resolve(result);
        } catch (error) {
            logger.error(`Command execution failed: ${command}`);
            logger.error(error);
            reject(error);
        }
    });
}


class LinkFile {
    constructor() {
        this.isWindows = process.platform === 'win32';
    }

    /**
     * Create a hard link to target
     * @param {string} sourcePath - Original file path
     * @param {string} targetPath - Target link path to create
     * @returns {Promise<boolean>} Success status
     */
    async hardLinkTo(sourcePath, targetPath) {
        try {
            sourcePath = path.resolve(sourcePath);
            targetPath = path.resolve(targetPath);

            // Check if source exists
            if (!fs.existsSync(sourcePath)) {
                logger.error(`Source file does not exist: ${sourcePath}`);
                return false;
            }

            // Ensure target directory exists
            const targetDir = path.dirname(targetPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // Remove target if exists
            if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
            }

            if (this.isWindows) {
                await execCmd(`mklink /H "${targetPath}" "${sourcePath}"`);
            } else {
                await execCmd(`ln "${sourcePath}" "${targetPath}"`);
            }

            logger.success(`Created hard link: ${targetPath} -> ${sourcePath}`);
            return true;
        } catch (error) {
            logger.error('Error creating hard link:', error);
            return false;
        }
    }

    /**
     * Create a hard link from source
     * @param {string} targetPath - Target link path to create
     * @param {string} sourcePath - Original file path
     * @returns {Promise<boolean>} Success status
     */
    async hardLinkFrom(targetPath, sourcePath) {
        return this.hardLinkTo(sourcePath, targetPath);
    }

    /**
     * Create a symbolic link to target
     * @param {string} sourcePath - Original path
     * @param {string} targetPath - Target link path to create
     * @returns {Promise<boolean>} Success status
     */
    async symLinkTo(sourcePath, targetPath) {
        try {
            sourcePath = path.resolve(sourcePath);
            targetPath = path.resolve(targetPath);

            // Check if source exists
            if (!fs.existsSync(sourcePath)) {
                logger.error(`Source path does not exist: ${sourcePath}`);
                return false;
            }

            // Ensure target directory exists
            const targetDir = path.dirname(targetPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // Remove target if exists
            if (fs.existsSync(targetPath)) {
                const stats = fs.lstatSync(targetPath);
                if (stats.isDirectory()) {
                    fs.rmdirSync(targetPath);
                } else {
                    fs.unlinkSync(targetPath);
                }
            }

            const isDirectory = fs.statSync(sourcePath).isDirectory();

            if (this.isWindows) {
                if (isDirectory) {
                    await execCmd(`mklink /D "${targetPath}" "${sourcePath}"`);
                } else {
                    await execCmd(`mklink "${targetPath}" "${sourcePath}"`);
                }
            } else {
                await execCmd(`ln -s "${sourcePath}" "${targetPath}"`);
            }

            logger.success(`Created symbolic link: ${targetPath} -> ${sourcePath}`);
            return true;
        } catch (error) {
            logger.error('Error creating symbolic link:', error);
            return false;
        }
    }

    /**
     * Create a symbolic link from source
     * @param {string} targetPath - Target link path to create
     * @param {string} sourcePath - Original path
     * @returns {Promise<boolean>} Success status
     */
    async symLinkFrom(targetPath, sourcePath) {
        return this.symLinkTo(sourcePath, targetPath);
    }

    /**
     * Check if a path is a link and get its information
     * @param {string} linkPath - Path to check
     * @returns {Promise<{isLink: boolean, type: string|null, target: string|null}>} Link information
     */
    async getLinkInfo(linkPath) {
        try {
            linkPath = path.resolve(linkPath);
            if (!fs.existsSync(linkPath)) {
                logger.info(`Path does not exist: ${linkPath}`);
                return { isLink: false, type: null, target: null };
            }

            const stats = fs.lstatSync(linkPath);
            if (!stats.isSymbolicLink() && !this.isJunction(linkPath)) {
                logger.info(`Path is not a link: ${linkPath}`);
                return { isLink: false, type: null, target: null };
            }

            let target = null;
            let type = null;

            if (this.isWindows) {
                const result = await execCmd(`fsutil reparsepoint query "${linkPath}"`, true);
                type = result.includes('Symbolic Link') ? 'symbolic' : 
                       result.includes('Junction') ? 'junction' : 'unknown';
                const targetMatch = result.match(/Print Name:\s+(.+)/);
                target = targetMatch ? targetMatch[1].trim() : null;
            } else {
                target = fs.readlinkSync(linkPath);
                type = stats.isSymbolicLink() ? 'symbolic' : 'unknown';
            }

            logger.info(`Link information for ${linkPath}:`, { type, target });
            return { isLink: true, type, target };
        } catch (error) {
            logger.error('Error checking link:', error);
            return { isLink: false, type: null, target: null };
        }
    }

    /**
     * Check if path is a junction point (Windows only)
     * @private
     * @param {string} path - Path to check
     * @returns {boolean} True if path is a junction
     */
    isJunction(path) {
        try {
            if (!this.isWindows) return false;
            const stats = fs.lstatSync(path);
            return stats.isDirectory() && stats.isSymbolicLink();
        } catch (error) {
            logger.error('Error checking junction point:', error);
            return false;
        }
    }
}

module.exports = new LinkFile(); 