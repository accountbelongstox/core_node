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

'use strict';

const logger = require('#@logger');
const { ftools } = require('#@ftools');
const { btools } = require('#@btools');
const { commander } = require('#@commander');
const os = require('os');
const path = require('path');
const fs = require('fs');

class FrontendLauncher {
    constructor(options = {}) {
        // Calculate project root: from ncore/utils/frontend_launcher -> core_node
        this.projectRoot = options.projectRoot || path.resolve(__dirname, '../../..');
        this.frontendDir = options.frontendDir || path.join(this.projectRoot, 'poly_apps', 'nuxt_main');
        this.packageJsonPath = path.join(this.frontendDir, 'package.json');
        this.scriptsDir = options.scriptsDir || path.join(this.frontendDir, 'scripts');
        this.switchScript = path.join(this.scriptsDir, 'switch-app-entry.js');
        this.tempBatPath = null;
        this.childProcess = null;
        this.isRunning = false;
        this.appNamespace = options.appNamespace || 'dev';
        this.port = options.port || 3000;
        this.timeout = options.timeout || 120000; // 2 minutes
        this.checkInterval = options.checkInterval || 2000; // 2 seconds
    }

    async validatePaths() {
        if (!fs.existsSync(this.frontendDir)) {
            logger.error(`Frontend directory not found: ${this.frontendDir}`);
            return false;
        }

        if (!fs.existsSync(this.packageJsonPath)) {
            logger.error(`package.json not found: ${this.packageJsonPath}`);
            return false;
        }

        if (!fs.existsSync(this.switchScript)) {
            logger.error(`Switch script not found: ${this.switchScript}`);
            return false;
        }

        return true;
    }

    async checkPortAvailable(port) {
        const isWindows = os.platform() === 'win32';
        let command;

        if (isWindows) {
            command = `netstat -an | findstr ":${port}"`;
        } else {
            command = `lsof -i :${port} || ss -tuln | grep ":${port}"`;
        }

        try {
            const result = await commander.executeCommand(command, { timeout: 5000 });
            return !result.stdout || result.stdout.trim() === '';
        } catch (error) {
            // Command failed, assume port is available
            return true;
        }
    }

    async switchAppEntry(appNamespace) {
        if (!appNamespace) {
            logger.error('App namespace is required');
            return false;
        }

        try {
            const command = `node "${this.switchScript}" ${appNamespace}`;
            logger.info(`Switching to app namespace: ${appNamespace}`);

            const result = await commander.executeCommand(command, {
                cwd: this.frontendDir,
                timeout: 30000
            });

            if (result.exitCode === 0) {
                logger.info(`Successfully switched to app: ${appNamespace}`);
                return true;
            } else {
                logger.error(`Failed to switch to app ${appNamespace}: ${result.stderr}`);
                return false;
            }
        } catch (error) {
            logger.error(`Error switching app entry: ${error.message}`);
            return false;
        }
    }

    async createWindowsBatchScript(port = this.port) {
        const isWindows = os.platform() === 'win32';
        if (!isWindows) {
            return null;
        }

        const batchContent = `@echo off
cd /d "${this.frontendDir}"
echo Starting frontend development server...
echo Working directory: %CD%
echo App namespace: ${this.appNamespace}
echo Port: ${port}
echo.

REM Check if pnpm is available
where pnpm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] pnpm is not installed or not in PATH
    echo Please install pnpm: npm install -g pnpm
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo [WARNING] node_modules not found, running pnpm install...
    pnpm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Switch app entry
echo Switching to app: ${this.appNamespace}
node scripts/switch-app-entry.js ${this.appNamespace}
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to switch app entry
    pause
    exit /b 1
)

REM Launch development server with specified port
echo Running: pnpm dev:${this.appNamespace} --port ${port}
pnpm dev:${this.appNamespace} --port ${port}

pause
`;

        const tempDir = os.tmpdir();
        const timestamp = Date.now();
        this.tempBatPath = path.join(tempDir, `frontend_launcher_${timestamp}.bat`);

        try {
            fs.writeFileSync(this.tempBatPath, batchContent, 'utf8');
            logger.info(`Created Windows batch script: ${this.tempBatPath}`);
            return this.tempBatPath;
        } catch (error) {
            logger.error(`Failed to create batch script: ${error.message}`);
            return null;
        }
    }

    async launchFrontendWindows(port = this.port) {
        const batchScript = await this.createWindowsBatchScript(port);
        if (!batchScript) {
            return false;
        }

        try {
            // Launch using explorer to open in new window
            const { spawn } = require('child_process');

            logger.info('Launching frontend in new window via explorer...');
            const child = spawn('explorer', [batchScript], {
                detached: true,
                stdio: 'ignore',
                shell: false
            });

            child.unref();
            this.isRunning = true;

            logger.info('Frontend launcher started successfully');
            logger.info(`Development server will be available at http://localhost:${this.port}/${this.appNamespace}`);

            return true;
        } catch (error) {
            logger.error(`Failed to launch frontend: ${error.message}`);
            return false;
        }
    }

    async launchFrontendLinux() {
        try {
            const { spawn } = require('child_process');

            // First switch app entry
            const switchSuccess = await this.switchAppEntry(this.appNamespace);
            if (!switchSuccess) {
                return false;
            }

            // Launch development server in background
            logger.info(`Starting frontend development server for app: ${this.appNamespace}`);

            this.childProcess = spawn('pnpm', [`dev:${this.appNamespace}`], {
                cwd: this.frontendDir,
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            // Handle output
            this.childProcess.stdout.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    logger.info(`[Frontend] ${output}`);
                }
            });

            this.childProcess.stderr.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    logger.error(`[Frontend] ${output}`);
                }
            });

            this.childProcess.on('error', (error) => {
                logger.error(`Frontend process error: ${error.message}`);
                this.isRunning = false;
            });

            this.childProcess.on('exit', (code) => {
                logger.info(`Frontend process exited with code: ${code}`);
                this.isRunning = false;
                this.childProcess = null;
            });

            // Don't wait for the process, let it run in background
            this.childProcess.unref();
            this.isRunning = true;

            logger.info(`Frontend development server started for app: ${this.appNamespace}`);
            logger.info(`Development server will be available at http://localhost:${this.port}/${this.appNamespace}`);

            return true;
        } catch (error) {
            logger.error(`Failed to launch frontend: ${error.message}`);
            return false;
        }
    }

    async waitForFrontendReady() {
        const maxAttempts = Math.floor(this.timeout / this.checkInterval);
        let attempts = 0;

        logger.info(`Waiting for frontend to be ready at http://localhost:${this.port}/${this.appNamespace}`);

        while (attempts < maxAttempts) {
            try {
                // Simple HTTP check using node's built-in modules
                const http = require('http');
                const options = {
                    hostname: 'localhost',
                    port: this.port,
                    path: `/${this.appNamespace}`,
                    method: 'GET',
                    timeout: 3000
                };

                const response = await new Promise((resolve, reject) => {
                    const req = http.request(options, (res) => {
                        resolve(res);
                    });

                    req.on('error', reject);
                    req.on('timeout', () => {
                        req.destroy();
                        reject(new Error('Request timeout'));
                    });

                    req.end();
                });

                if (response.statusCode === 200) {
                    logger.info(`Frontend is ready at http://localhost:${this.port}/${this.appNamespace}`);
                    return true;
                }

            } catch (error) {
                // Frontend not ready yet, continue waiting
            }

            attempts++;
            if (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, this.checkInterval));
                process.stdout.write('.');
            }
        }

        logger.error(`Frontend did not become ready within ${this.timeout}ms`);
        return false;
    }

    async launch(appNamespace = null, options = {}) {
        if (this.isRunning) {
            logger.warn('Frontend launcher is already running');
            return true;
        }

        // Update configuration
        if (appNamespace) {
            this.appNamespace = appNamespace;
        }
        if (options.port) {
            this.port = options.port;
        }
        if (options.timeout) {
            this.timeout = options.timeout;
        }

        // Validate paths
        if (!await this.validatePaths()) {
            return false;
        }

        // Check if port is available
        const portAvailable = await this.checkPortAvailable(this.port);
        if (!portAvailable) {
            logger.error(`Port ${this.port} is already in use. Frontend may already be running.`);
            return false;
        }

        const isWindows = os.platform() === 'win32';
        let launchSuccess = false;

        if (isWindows) {
            launchSuccess = await this.launchFrontendWindows(this.port);
        } else {
            launchSuccess = await this.launchFrontendLinux();
        }

        if (launchSuccess && options.waitForReady) {
            return await this.waitForFrontendReady();
        }

        return launchSuccess;
    }

    async stop() {
        if (!this.isRunning) {
            logger.warn('Frontend launcher is not running');
            return true;
        }

        try {
            if (this.childProcess) {
                // On Linux/Unix, terminate the child process
                this.childProcess.kill('SIGTERM');

                // Wait a bit for graceful shutdown
                await new Promise(resolve => setTimeout(resolve, 5000));

                // Force kill if still running
                if (this.childProcess && !this.childProcess.killed) {
                    this.childProcess.kill('SIGKILL');
                }

                this.childProcess = null;
            }

            // Clean up temporary batch file on Windows
            if (this.tempBatPath && fs.existsSync(this.tempBatPath)) {
                try {
                    fs.unlinkSync(this.tempBatPath);
                    logger.info(`Cleaned up temporary batch script: ${this.tempBatPath}`);
                } catch (error) {
                    logger.warn(`Failed to clean up batch script: ${error.message}`);
                }
                this.tempBatPath = null;
            }

            this.isRunning = false;
            logger.info('Frontend launcher stopped successfully');
            return true;
        } catch (error) {
            logger.error(`Error stopping frontend launcher: ${error.message}`);
            return false;
        }
    }

    async getStatus() {
        const portAvailable = await this.checkPortAvailable(this.port);
        return {
            isRunning: this.isRunning && !portAvailable,
            port: this.port,
            appNamespace: this.appNamespace,
            url: `http://localhost:${this.port}/${this.appNamespace}`,
            hasChildProcess: !!this.childProcess,
            hasTempScript: !!this.tempBatPath
        };
    }
}

// Singleton instance
let instance = null;

function getInstance(options = {}) {
    if (!instance) {
        instance = new FrontendLauncher(options);
    }
    return instance;
}

module.exports = {
    FrontendLauncher,
    getInstance
};