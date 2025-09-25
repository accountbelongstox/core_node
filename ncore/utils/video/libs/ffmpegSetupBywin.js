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
const os = require('os');
const logger = require('#@logger');

const gconfig = require('#@gconfig');
const winpath = require('#@winpath');
const winget = require('../../win_tool/libs/winget');

class FFmpegSetup {
    constructor() {
        if (os.platform() !== 'win32') {
            logger.error('This module only supports Windows platform');
            return;
        }

        this.ffmpegPackageId = 'Gyan.FFmpeg.Shared';
        this.ffmpegBinary = 'ffmpeg.exe';
        
        const baseDir = gconfig.DEV_LANG_DIR;
        this.installDir = path.join(baseDir, 'FFmpeg');
        this.ffmpegPath = null; // Will be set when found
    }

    /**
     * Recursively find ffmpeg.exe in directory
     * @param {string} dir Directory to search in
     * @param {number} depth Current depth
     * @param {number} maxDepth Maximum depth to search
     * @returns {string|null} Path to ffmpeg.exe if found, null otherwise
     */
    findFFmpegBinary(dir, depth = 0, maxDepth = 3) {
        if (depth > maxDepth) return null;
        
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                
                if (stat.isFile() && file.toLowerCase() === this.ffmpegBinary.toLowerCase()) {
                    return fullPath;
                }
                
                if (stat.isDirectory()) {
                    const found = this.findFFmpegBinary(fullPath, depth + 1, maxDepth);
                    if (found) return found;
                }
            }
        } catch (error) {
            logger.error(`Error searching in directory ${dir}:`, error);
        }
        
        return null;
    }

    /**
     * Get FFmpeg absolute path if installed
     * @returns {Promise<string|null>} FFmpeg absolute path or null if not found
     */
    async getFFmpegAbsPath() {
        // Return cached path if exists
        if (this.ffmpegPath && fs.existsSync(this.ffmpegPath)) {
            try {
                await execCmd(`"${this.ffmpegPath}" -version`, false);
                return this.ffmpegPath;
            } catch (error) {
                this.ffmpegPath = null; // Reset if binary doesn't work
            }
        }

        if (fs.existsSync(this.installDir)) {
            const foundPath = this.findFFmpegBinary(this.installDir);
            if (foundPath) {
                try {
                    await execCmd(`"${foundPath}" -version`, false);
                    this.ffmpegPath = foundPath; // Cache the working path
                    return foundPath;
                } catch (error) {
                    logger.error('Found FFmpeg binary but it is not working:', error);
                }
            }
        }

        return null;
    }

    /**
     * Check if FFmpeg is installed
     * @returns {Promise<boolean>} True if FFmpeg is installed
     */
    async isInstalled() {
        const absPath = await this.getFFmpegAbsPath();
        return absPath;
    }

    /**
     * Install FFmpeg using winget
     * @returns {Promise<boolean>} True if installation was successful
     */
    async install() {
        const isInstalled = await this.isInstalled();
        if (isInstalled) {
            logger.info(`FFmpeg is already installed ${isInstalled}`);
            return isInstalled;
        }
        logger.info(`FFmpeg is not installed ${isInstalled}, installing...`); 

        try {
            logger.info('Installing FFmpeg...');

            // Remove existing installation directory if exists
            if (fs.existsSync(this.installDir)) {
                fs.rmSync(this.installDir, { recursive: true, force: true });
            }

            // Create installation directory
            fs.mkdirSync(this.installDir, { recursive: true });
     
            const installed = await winget.forceInstallSoftwareById(this.ffmpegPackageId, this.installDir);
            
            if (!installed) {
                logger.error('Failed to install FFmpeg');
                return false;
            }

            // Find the ffmpeg binary in the installation directory
            const foundPath = await this.getFFmpegAbsPath();
            if (!foundPath) {
                logger.error('FFmpeg was installed but binary not found in installation directory');
                return false;
            }

            // Add binary directory to system PATH
            const binDir = path.dirname(foundPath);
            winpath.addPath(binDir);

            logger.success('FFmpeg installation completed successfully');
            return true;
        } catch (error) {
            logger.error('FFmpeg installation failed:', error);
            return false;
        }
    }

    /**
     * Get FFmpeg path or install if not found
     * @returns {Promise<string>} FFmpeg path
     */
    async getFFmpegPath() {
        const absPath = await this.getFFmpegAbsPath();
        if (absPath) {
            return absPath;
        }

        // If FFmpeg is not found, try to install it
        const installed = await this.install();
        if (installed) {
            const newPath = await this.getFFmpegAbsPath();
            if (newPath) {
                return newPath;
            }
        }

        throw new Error('FFmpeg is not installed and automatic installation failed');
    }
}

module.exports = new FFmpegSetup(); 