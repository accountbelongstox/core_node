const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
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


/**
 * Format URL to a valid filename
 * @param {string} url - URL to format
 * @param {boolean} [keepPath=false] - Whether to keep the path part of the URL
 * @returns {{filename: string, warnings: string[]}} Formatted filename and any warnings
 */
function formatUrlToFilename(url, keepPath = false) {
    const warnings = [];
    let urlObj;
    try {
        urlObj = new URL(url);
    } catch (e) {
        warnings.push(`Invalid URL format: ${url}`);
        return { filename: 'download.html', warnings };
    }

    // Remove query parameters unless keepPath is true
    let pathname = urlObj.pathname;
    if (!keepPath && urlObj.search) {
        warnings.push(`Query parameters were removed from the filename`);
    }

    // Handle trailing slash - return index.html
    if (pathname.endsWith('/')) {
        return { filename: 'index.html', warnings };
    }

    // Get the filename part
    let filename = keepPath ?
        pathname.substring(1).replace(/\//g, '_') :
        path.basename(pathname);

    // If no extension found in basename, try to extract from path
    if (!path.extname(filename) && pathname.includes('.')) {
        filename = pathname.split('/').pop() || 'download.html';
    }

    // If still no filename, use default
    if (!filename) {
        filename = 'download.html';
        warnings.push(`Could not extract filename from URL, using default: ${filename}`);
    }

    // Replace invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g;
    const originalFilename = filename;
    filename = filename.replace(invalidChars, '_');

    if (filename !== originalFilename) {
        warnings.push(`Invalid characters in filename were replaced with '_': ${originalFilename} -> ${filename}`);
    }

    // Handle empty or invalid cases
    if (!filename || filename === '.') {
        filename = 'download.html';
        warnings.push(`Invalid filename generated, using default: ${filename}`);
    }

    return { filename, warnings };
}

/**
 * Process output path for download
 * @param {string} url - Download URL
 * @param {string} [outputPath] - Optional output path
 * @returns {string} Processed output path
 */
function processOutputPath(url, outputPath) {
    // Extract filename from URL using the new function
    const { filename, warnings } = formatUrlToFilename(url);
    warnings.forEach(warning => logger.warn(warning));

    // Case 1: No output path provided
    if (!outputPath) {
        const finalPath = path.join(DOWNLOAD_DIR, filename);
        if (fs.existsSync(finalPath)) {
            fs.unlinkSync(finalPath);
        }
        ensureDir(path.dirname(finalPath));
        return finalPath;
    }

    // Case 2: Output path is a directory
    if (!path.extname(outputPath)) {
        ensureDir(outputPath);
        return path.join(outputPath, filename);
    }

    // Case 3: Output path is a file
    const outputFilename = path.basename(outputPath);
    if (outputFilename === filename && fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
    }
    ensureDir(path.dirname(outputPath));
    return outputPath;
}

/**
 * Clean temporary directory
 * @returns {void}
 */
function cleanTempFile(tempfile) {
    try {
        if (fs.existsSync(tempfile)) {
            fs.unlinkSync(tempfile);
            logger.info(`Cleaned temporary directory: ${TEMP_DIR}`);
        }
    } catch (error) {
        logger.warn('Error cleaning temporary directory:', error);
    }
}

/**
 * Move file safely, using copy as fallback
 * @param {string} source - Source file path
 * @param {string} target - Target file path
 * @returns {boolean} Success status
 */
function moveFile(source, target) {
    try {
        // Try rename first (atomic operation)
        fs.renameSync(source, target);
        return true;
    } catch (error) {
        // If rename fails (e.g., cross-device), try copy and delete
        logger.warn(`Failed to move file directly, falling back to copy: ${error.message}`);
        try {
            // Copy file in binary mode
            fs.copyFileSync(source, target);
            // Delete source file after successful copy
            fs.unlinkSync(source);
            return true;
        } catch (copyError) {
            logger.error('Failed to copy file:', copyError);
            // Clean up target file if it exists after failed copy
            if (fs.existsSync(target)) {
                try {
                    fs.unlinkSync(target);
                } catch (cleanupError) {
                    logger.error('Failed to clean up target file:', cleanupError);
                }
            }
            return false;
        }
    }
}

/**
 * Download a file using system curl
 * @param {string} url - URL to download from
 * @param {string} [outputPath] - Path to save the file
 * @param {Object} [options] - Download options
 * @param {Function} [options.onComplete] - Complete callback
 * @param {Function} [options.onError] - Error callback
 * @returns {Promise<string|false>} Absolute path of downloaded file or false if failed
 */
async function downloadFile(url, outputPath, options = {}) {
    const {
        onComplete = () => { },
        onError = (error) => logger.error('Download error:', error)
    } = options;

    const finalPath = processOutputPath(url, outputPath);
    const absolutePath = path.resolve(finalPath);
    const isWindows = os.platform() === 'win32';

    // Create temp filename
    const tempFileName = `tmp_${Date.now()}_${path.basename(finalPath)}`;
    const tempFilePath = path.join(TEMP_DIR, tempFileName);

    try {
        // Clean temp directory before download
        cleanTempFile(tempFilePath);

        const curlArgs = [
            'curl',
            url,
            '-L', // Follow redirects
            '-o', tempFilePath,
            // '--progress-bar'
        ];

        if (isWindows) {
            curlArgs.push('--ssl-no-revoke'); // Ignore SSL certificate revocation checks
        } else {
            // curlArgs.push('--silent');
            curlArgs.push('--show-error');
        }

        // Download to temp file
        await pipeExecCmd(curlArgs.join(' '), true, null, true, process.env, false);

        // Ensure target directory exists
        ensureDir(path.dirname(absolutePath));

        // Remove existing file if it exists
        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
        }

        // Move temp file to final location with fallback to copy
        if (!moveFile(tempFilePath, absolutePath)) {
            throw new Error('Failed to move file to final location');
        }

        onComplete();
        logger.info(`File downloaded successfully to: ${absolutePath}`);
        return absolutePath;
    } catch (error) {
        onError(error);
        // Clean up temp file if it exists
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
        return false;
    }
}

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Get the size of a remote file in bytes
 * @param {string} url - URL of the remote file
 * @returns {Promise<number|false>} File size in bytes or false if failed
 */
async function getRemoteFileSize(url) {
    const isWindows = os.platform() === 'win32';
    const curlArgs = [
        'curl',
        '--head',                    // Only get headers
        '-L',                        // Follow redirects
        '--max-time', '600',         // 10 minutes timeout
        '-s',                        // Silent mode
        '-f',                        // Fail silently
        url
    ];

    if (isWindows) {
        curlArgs.push('--ssl-no-revoke');
    }

    try {
        const result = await pipeExecCmd(curlArgs.join(' '), true, null, false, process.env, false);
        if (!result) {
            return false;
        }

        const headers = result.toString().toLowerCase();
        const contentLength = headers.match(/content-length:\s*(\d+)/i);

        if (contentLength && contentLength[1]) {
            const size = parseInt(contentLength[1], 10);
            logger.info(`Remote file size: ${(size / (1024 * 1024)).toFixed(2)}MB`);
            return size;
        }

        logger.warn('Could not determine file size from headers');
        return false;
    } catch (error) {
        logger.error('Error getting remote file size:', error);
        return false;
    }
}

/**
 * Compare local file size with remote file size
 * @param {string} localPath - Path to local file
 * @param {string} remoteUrl - URL of remote file
 * @param {boolean} [deleteIfDifferent=false] - Whether to delete local file if sizes differ
 * @returns {Promise<boolean>} True if sizes match, false otherwise
 */
async function compareFileSize(localPath, remoteUrl, deleteIfDifferent = false) {
    try {
        // Check if local file exists
        if (!fs.existsSync(localPath)) {
            logger.warn(`Local file does not exist: ${localPath}`);
            return false;
        }

        // Get local file size
        const localSize = fs.statSync(localPath).size;
        logger.info(`Local file size: ${(localSize / (1024 * 1024)).toFixed(2)}MB`);

        // Get remote file size
        const remoteSize = await getRemoteFileSize(remoteUrl);
        if (remoteSize === false) {
            logger.warn('Could not get remote file size for comparison');
            return false;
        }

        // Compare sizes
        const sizesMatch = localSize === remoteSize;
        if (!sizesMatch) {
            logger.warn(`File sizes do not match:
                Local:  ${(localSize / (1024 * 1024)).toFixed(2)}MB
                Remote: ${(remoteSize / (1024 * 1024)).toFixed(2)}MB`);

            if (deleteIfDifferent) {
                logger.info(`Deleting local file due to size mismatch: ${localPath}`);
                fs.unlinkSync(localPath);
            }
            return false;
        }

        logger.info('Local and remote file sizes match');
        return true;
    } catch (error) {
        logger.error('Error comparing file sizes:', error);
        return false;
    }
}

module.exports = {
    downloadFile,
    ensureDir,
    getRemoteFileSize,
    compareFileSize
};