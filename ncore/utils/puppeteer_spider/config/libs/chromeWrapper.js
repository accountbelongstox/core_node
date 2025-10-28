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
const { spawn } = require('child_process');
const logger = require('#@logger');

class ChromeWrapper {
    constructor() {
        this.chromeProcess = null;
        this.isInitialized = false;
    }

    /**
     * Launch Chrome with symbolic link loop protection
     * @param {Object} options - Chrome launch options
     * @returns {Promise<Object>} Chrome process information
     */
    async launchChrome(options = {}) {
        const {
            executablePath,
            args = [],
            env = {},
            timeout = 30000
        } = options;

        if (!executablePath) {
            throw new Error('Chrome executable path is required');
        }

        // Verify Chrome executable exists and is accessible
        await this.verifyChromePath(executablePath);

        // Set environment variables to avoid symbolic link issues
        const chromeEnv = {
            ...process.env,
            ...env,
            // Prevent Chrome from following problematic symbolic links
            'CHROME_DEVEL_SANDBOX': '/dev/null',
            // Set a clean PATH that avoids problematic directories
            'PATH': this.getCleanPath(),
            // Disable X11 forwarding that might trigger symbolic link loops
            'DISPLAY': process.env.DISPLAY || ':0',
            'XAUTHORITY': process.env.XAUTHORITY || '',
        };

        // Add Chrome arguments to avoid symbolic link issues and handle root execution
        const chromeArgs = [
            ...args,
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            // Avoid accessing problematic system directories
            '--disable-extensions-file-access-check',
            '--disable-extensions-http-throttling',
            '--disable-component-extensions-with-background-pages',
            // Handle root execution
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            `--user-data-dir=/tmp/chrome-user-data-${Date.now()}`,
            '--single-process',
            '--disable-setuid-sandbox',
        ];

        logger.info(`Launching Chrome with protected environment...`);
        logger.debug(`Executable: ${executablePath}`);
        logger.debug(`Arguments: ${chromeArgs.join(' ')}`);

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                if (this.chromeProcess) {
                    this.chromeProcess.kill('SIGKILL');
                }
                reject(new Error(`Chrome launch timeout after ${timeout}ms`));
            }, timeout);

            try {
                this.chromeProcess = spawn(executablePath, chromeArgs, {
                    env: chromeEnv,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    detached: false
                });

                this.chromeProcess.on('error', (error) => {
                    clearTimeout(timeoutId);
                    logger.error('Chrome process error:', error);
                    
                    // Check if error is related to symbolic links
                    if (error.message.includes('ELOOP') || error.message.includes('too many symbolic links')) {
                        reject(new Error(`Chrome failed to start due to symbolic link loop: ${error.message}`));
                    } else {
                        reject(error);
                    }
                });

                this.chromeProcess.on('spawn', () => {
                    clearTimeout(timeoutId);
                    this.isInitialized = true;
                    logger.success(`Chrome process spawned successfully (PID: ${this.chromeProcess.pid})`);
                    
                    resolve({
                        process: this.chromeProcess,
                        pid: this.chromeProcess.pid,
                        executablePath: executablePath
                    });
                });

                // Handle stderr for debugging
                this.chromeProcess.stderr.on('data', (data) => {
                    const errorMsg = data.toString();
                    if (errorMsg.includes('ELOOP') || errorMsg.includes('symbolic link')) {
                        logger.error('Chrome symbolic link error:', errorMsg);
                    } else {
                        logger.debug('Chrome stderr:', errorMsg);
                    }
                });

            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * Verify Chrome executable path and accessibility
     * @private
     */
    async verifyChromePath(executablePath) {
        try {
            // Check if file exists
            if (!fs.existsSync(executablePath)) {
                throw new Error(`Chrome executable not found: ${executablePath}`);
            }

            // Check if it's a regular file or a valid symbolic link
            const stats = fs.lstatSync(executablePath);
            if (stats.isSymbolicLink()) {
                try {
                    // Try to resolve the symbolic link
                    const realPath = fs.realpathSync(executablePath);
                    if (!fs.existsSync(realPath)) {
                        throw new Error(`Chrome executable symbolic link is broken: ${executablePath} -> ${realPath}`);
                    }
                } catch (error) {
                    if (error.code === 'ELOOP') {
                        throw new Error(`Chrome executable has circular symbolic link: ${executablePath}`);
                    }
                    throw error;
                }
            }

            // Check if file is executable
            try {
                fs.accessSync(executablePath, fs.constants.X_OK);
            } catch (error) {
                throw new Error(`Chrome executable is not executable: ${executablePath}`);
            }

            logger.debug(`Chrome executable verified: ${executablePath}`);
        } catch (error) {
            logger.error('Chrome path verification failed:', error.message);
            throw error;
        }
    }

    /**
     * Get a clean PATH environment variable that avoids problematic directories
     * @private
     */
    getCleanPath() {
        const originalPath = process.env.PATH || '';
        const pathDirs = originalPath.split(':');
        
        // Filter out potentially problematic directories
        const cleanDirs = pathDirs.filter(dir => {
            // Skip empty directories
            if (!dir) return false;
            
            // Skip directories that commonly have symbolic link issues
            if (dir.includes('/X11/') || dir.endsWith('/X11')) return false;
            
            // Skip directories that might contain FileCheck or similar problematic binaries
            if (dir.includes('llvm') && dir.includes('bin')) return false;
            
            // Keep standard system directories
            return true;
        });

        // Add essential directories if they're missing
        const essentialDirs = ['/usr/local/bin', '/usr/bin', '/bin'];
        essentialDirs.forEach(dir => {
            if (!cleanDirs.includes(dir) && fs.existsSync(dir)) {
                cleanDirs.push(dir);
            }
        });

        const cleanPath = cleanDirs.join(':');
        logger.debug(`Clean PATH: ${cleanPath}`);
        return cleanPath;
    }

    /**
     * Kill the Chrome process
     */
    async killChrome() {
        if (this.chromeProcess && !this.chromeProcess.killed) {
            logger.info('Terminating Chrome process...');
            
            return new Promise((resolve) => {
                this.chromeProcess.on('exit', () => {
                    logger.info('Chrome process terminated');
                    this.isInitialized = false;
                    resolve();
                });

                // Try graceful shutdown first
                this.chromeProcess.kill('SIGTERM');
                
                // Force kill after timeout
                setTimeout(() => {
                    if (!this.chromeProcess.killed) {
                        logger.warn('Force killing Chrome process');
                        this.chromeProcess.kill('SIGKILL');
                    }
                }, 5000);
            });
        }
    }

    /**
     * Check if Chrome process is running
     */
    isRunning() {
        return this.chromeProcess && !this.chromeProcess.killed && this.isInitialized;
    }
}

module.exports = ChromeWrapper;
