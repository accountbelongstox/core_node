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
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('#@logger');
const http = require('http');
const https = require('https');
const isWindows = os.platform() === 'win32';
const osVersion = (() => {
    const platform = os.platform();
    if (platform === 'win32') {
        const release = os.release();
        if (release.startsWith('10')) {
            return 'win10';
        } else if (release.startsWith('11')) {
            return 'win11';
        }
    } else if (platform === 'linux') {
        const distro = os.type(); // Can be refined with more accurate Linux distribution data
        const version = os.release();
        if (distro.includes('Ubuntu')) {
            return `ubuntu${version.split('.')[0]}`;
        } else if (distro.includes('Debian')) {
            return `debian${version.split('.')[0]}`;
        }
    }
    return platform;
})();

let DATA_DRIVER;
if (os.platform() === 'win32') {
    DATA_DRIVER = fs.existsSync('D:\\') ? 'D:\\' : 'C:\\';
} else {
    DATA_DRIVER = fs.existsSync('/mnt/d') ? '/mnt/d' : '/usr/';
}

const USE_DRIVER = DATA_DRIVER
const DEFAULT_DOWNLOAD_TEMPDIR = path.join(USE_DRIVER, '.tmp', osVersion)
const DEFAULT_DOWNLOAD_DIR = path.join(DEFAULT_DOWNLOAD_TEMPDIR, 'Downloads');
ensureDir(DEFAULT_DOWNLOAD_TEMPDIR)
ensureDir(DEFAULT_DOWNLOAD_DIR)

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
        const finalPath = path.join(DEFAULT_DOWNLOAD_DIR, filename);
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
            logger.info(`Cleaned temporary directory: ${DEFAULT_DOWNLOAD_TEMPDIR}`);
        }
    } catch (error) {
        logger.warn('Error cleaning temporary directory:', error);
    }
}


/**
 * Download a file using system curl with browser simulation
 * @param {string} url - URL to download from
 * @param {string} [outputPath] - Path to save the file
 * @param {Object} [options] - Download options
 * @param {Function} [options.onComplete] - Complete callback
 * @param {Function} [options.onError] - Error callback
 * @returns {Promise<string|false>} Absolute path of downloaded file or false if failed
 */
async function CURLDownload(url, outputPath, options = {}) {
    const {
        onComplete = () => { },
        onError = (error) => logger.error('Download error:', error)
    } = options;

    const finalPath = processOutputPath(url, outputPath);
    const absolutePath = path.resolve(finalPath);
    const isWindows = os.platform() === 'win32';
    const verifyFile = await compareFileSize(absolutePath, url, true);
    if (verifyFile) {
        logger.info('File already exists, skipping download');
        return verifyFile;
    }
    try {
        // Clean temp directory before download
        cleanTempFile(absolutePath);

        const curlArgs = [
            'curl',
            url,
            '-L',                // Follow redirects
            '-k',                // Ignore SSL certificate issues
            '-o',                // Output to file
            `"${absolutePath}"`,
            '--progress-bar',    // Show progress bar

            // Browser simulation headers
            '-A', '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"',
            '--referer', `"${url}"`,
            '-H', '"Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"',
            '-H', '"Accept-Language: en-US,en;q=0.5"',
            '-H', '"Accept-Encoding: gzip, deflate"',  // 移除 br 编码，只使用 curl 支持的编码
            '-H', '"Connection: keep-alive"',
            '-H', '"Cache-Control: no-cache"',         // 添加缓存控制
            '-H', '"Pragma: no-cache"',               // 添加缓存控制
            '--compressed'        // Handle compressed content
        ];

        // Windows 特定参数
        if (isWindows) {
            curlArgs.push('--ssl-no-revoke'); // Ignore SSL certificate revocation checks on Windows
        }

        // 添加更多的错误处理参数
        // curlArgs.push('--fail');              // HTTP 错误时失败
        // curlArgs.push('--silent');            // 不显示进度条
        curlArgs.push('--show-error');        // 显示错误信息
        curlArgs.push('--location-trusted');  // 跟随重定向时保持原始认证

        // Join arguments with proper spacing and quoting
        const cmd = curlArgs.map(arg => {
            // If arg contains space and isn't already quoted, quote it
            if (arg.includes(' ') && !arg.startsWith('"') && !arg.endsWith('"')) {
                return `"${arg}"`;
            }
            return arg;
        }).join(' ');

        logger.command(cmd);
        await pipeExecCmd(cmd, true, null, true, process.env, false);

        // Ensure target directory exists
        ensureDir(path.dirname(absolutePath));

        onComplete();
        logger.info(`File downloaded successfully to: ${absolutePath}`);
        return absolutePath;
    } catch (error) {
        onError(error);
        // Clean up temp file if it exists
        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
        }
        return false;
    }
}

/**
 * Download a file using Node.js http/https modules
 * @param {string} url - URL to download from
 * @param {string} [outputPath] - Path to save the file
 * @param {Object} [options] - Download options
 * @param {Function} [options.onComplete] - Complete callback
 * @param {Function} [options.onError] - Error callback
 * @param {Function} [options.onProgress] - Progress callback
 * @returns {Promise<string|false>} Absolute path of downloaded file or false if failed
 */
async function HTTPDownload(url, outputPath, options = {}) {
    const {
        onComplete = () => { },
        onError = (error) => logger.error('Download error:', error),
        onProgress = (received, total) => {
            if (total && !isNaN(total) && total > 0) {
                const percent = ((received * 100) / total).toFixed(2);
                logger.info(`Progress: ${percent}% (${received}/${total} bytes)`);
            } else {
                logger.info(`Progress: ${received} bytes downloaded`);
            }
        },
        onHeaders = () => { }
    } = options;

    const finalPath = processOutputPath(url, outputPath);
    const absolutePath = path.resolve(finalPath);
    const verifyFile = await compareFileSize(absolutePath, url, true);
    if (verifyFile) {
        logger.info('File already exists, skipping download');
        return verifyFile;
    }

    return new Promise((resolve) => {
        try {
            // Clean temp directory before download
            cleanTempFile(absolutePath);

            // Create write stream
            const fileStream = fs.createWriteStream(absolutePath);

            // Select http or https module
            const client = url.startsWith('https') ? https : http;

            logger.info(`Starting download: ${url}`);

            const request = client.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, (response) => {
                const total = parseInt(response.headers['content-length'], 10);
                let received = 0;

                // Call onHeaders callback with response headers
                onHeaders(response.headers);

                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    const redirectUrl = response.headers.location;
                    logger.info(`Redirecting to: ${redirectUrl}`);
                    request.abort();
                    HTTPDownload(redirectUrl, outputPath, options)
                        .then(resolve)
                        .catch(onError);
                    return;
                }

                response.pipe(fileStream);

                response.on('data', (chunk) => {
                    received += chunk.length;
                    onProgress(received, total);
                });

                fileStream.on('finish', async () => {
                    fileStream.close();

                    try {
                        // Ensure target directory exists
                        ensureDir(path.dirname(absolutePath));

                        onComplete();
                        logger.success(`File downloaded successfully to: ${absolutePath}`);
                        resolve(absolutePath);
                    } catch (error) {
                        onError(error);
                        resolve(false);
                    }
                });
            });

            request.on('error', (error) => {
                fs.unlink(absolutePath, () => { });
                onError(error);
                resolve(false);
            });

        } catch (error) {
            onError(error);
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
            }
            resolve(false);
        }
    });
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

async function getRemoteFileSize(url) {
    return new Promise((resolve) => {
        const protocol = url.startsWith('https') ? https : http;

        const options = {
            method: 'HEAD',
            ...(protocol === https && { agent: new https.Agent({ rejectUnauthorized: false }) }) // Ignore SSL errors
        };

        protocol.get(url, options, (res) => {
            if (res.statusCode === 200) {
                const fileSizeBytes = parseInt(res.headers['content-length'], 10);
                const fileSizeKB = fileSizeBytes / 1024; // Convert bytes to KB
                resolve(fileSizeKB);
            } else {
                console.error(`Error: Received status code ${res.statusCode}`);
                resolve(0);
            }
        }).on('error', (err) => {
            console.error(`Request error: ${err.message}`);
            resolve(0);
        });
    });
}

async function compareFileSize(localPath, remoteUrl, deleteIfDifferent = false) {
    try {
        // Get local file size
        if (!fs.existsSync(localPath)) {
            console.log(`Local file does not exist: ${localPath}`);
            return false;
        }

        const localFileSizeKB = fs.statSync(localPath).size / 1024;
        console.log(`Local file size: ${localFileSizeKB.toFixed(2)} KB`);

        // Get remote file size
        const remoteFileSizeKB = await getRemoteFileSize(remoteUrl);
        console.log(`Remote file size: ${remoteFileSizeKB.toFixed(2)} KB`);

        // Compare sizes
        if (localFileSizeKB === remoteFileSizeKB) {
            console.log('File sizes match.');
            return localPath;
        } else {
            console.log('File sizes are different.');
            if (deleteIfDifferent) {
                fs.unlinkSync(localPath);
                console.log(`Deleted local file: ${localPath}`);
            }
            return false;
        }
    } catch (err) {
        console.error(`Error: ${err.message}`);
        return false;
    }
}


module.exports = {
    CURLDownload,
    HTTPDownload,
    ensureDir,
    getRemoteFileSize,
    compareFileSize,
    DEFAULT_DOWNLOAD_TEMPDIR,
    DEFAULT_DOWNLOAD_DIR,
};