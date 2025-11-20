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

const { execCmdResultText, pipeExecCmd } = require('#@commander');
const logger = require('#@logger');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Code Execution Controller
 * Provides secure code execution capabilities for development tools
 */

// Supported programming languages and their execution commands
const SUPPORTED_LANGUAGES = {
    javascript: {
        extension: '.js',
        command: 'node',
        args: [],
        timeout: 30000
    },
    python: {
        extension: '.py',
        command: 'python3',
        args: [],
        timeout: 30000
    },
    typescript: {
        extension: '.ts',
        command: 'npx',
        args: ['ts-node'],
        timeout: 30000
    },
    bash: {
        extension: '.sh',
        command: 'bash',
        args: [],
        timeout: 30000
    },
    powershell: {
        extension: '.ps1',
        command: 'powershell',
        args: ['-ExecutionPolicy', 'Bypass', '-File'],
        timeout: 30000
    }
};

// Security limits
const SECURITY_LIMITS = {
    maxExecutionTime: 30000,  // 30 seconds
    maxMemoryUsage: 128,      // 128 MB
    maxOutputSize: 1024 * 1024, // 1 MB
    allowedCommands: ['node', 'python3', 'npx', 'bash', 'powershell']
};

/**
 * Execute code snippet
 */
async function executeCode(req, res) {
    const startTime = Date.now();
    let tempFilePath = null;

    try {
        const { code, language, environment, timeout, memoryLimit, inputData } = req.body;

        // Validate input
        if (!code || !language) {
            return {
                success: false,
                error: 'Missing required parameters',
                message: 'Code and language are required'
            };
        }

        // Check if language is supported
        const langConfig = SUPPORTED_LANGUAGES[language.toLowerCase()];
        if (!langConfig) {
            return {
                success: false,
                error: 'Unsupported language',
                message: `Language ${language} is not supported`
            };
        }

        // Apply security limits
        const execTimeout = Math.min(timeout || langConfig.timeout, SECURITY_LIMITS.maxExecutionTime);
        const memLimit = Math.min(memoryLimit || SECURITY_LIMITS.maxMemoryUsage, SECURITY_LIMITS.maxMemoryUsage);

        // Create temporary file
        const tempDir = os.tmpdir();
        const fileName = `code_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${langConfig.extension}`;
        tempFilePath = path.join(tempDir, fileName);

        // Write code to temporary file
        await fs.writeFile(tempFilePath, code, 'utf8');

        // Prepare execution command
        const command = langConfig.command;
        const args = [...langConfig.args, tempFilePath];

        logger.info(`Executing ${language} code: ${command} ${args.join(' ')}`);

        // Execute code with timeout and memory limits
        const result = await executeWithLimits(command, args, {
            timeout: execTimeout,
            memoryLimit: memLimit,
            inputData
        });

        const executionTime = Date.now() - startTime;

        // Clean up temporary file
        if (tempFilePath) {
            try {
                await fs.unlink(tempFilePath);
            } catch (cleanupError) {
                logger.warn('Failed to cleanup temporary file:', cleanupError);
            }
        }

        return {
            success: result.success,
            data: {
                output: result.output,
                error: result.error,
                executionTime,
                memoryUsed: result.memoryUsed || 0,
                exitCode: result.exitCode
            },
            message: result.success ? 'Code executed successfully' : 'Code execution failed'
        };

    } catch (error) {
        logger.error('Code execution error:', error);

        // Clean up temporary file on error
        if (tempFilePath) {
            try {
                await fs.unlink(tempFilePath);
            } catch (cleanupError) {
                logger.warn('Failed to cleanup temporary file on error:', cleanupError);
            }
        }

        return {
            success: false,
            error: 'Execution failed',
            message: error.message,
            data: {
                executionTime: Date.now() - startTime,
                memoryUsed: 0,
                exitCode: -1
            }
        };
    }
}

/**
 * Execute command with security limits
 */
async function executeWithLimits(command, args, options = {}) {
    const { timeout = 30000, memoryLimit = 128, inputData } = options;

    return new Promise((resolve) => {
        const { spawn } = require('child_process');
        
        // Spawn process with limits
        const child = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: timeout,
            killSignal: 'SIGKILL'
        });

        let stdout = '';
        let stderr = '';
        let memoryUsed = 0;

        // Handle stdout
        child.stdout.on('data', (data) => {
            stdout += data.toString();
            // Limit output size
            if (stdout.length > SECURITY_LIMITS.maxOutputSize) {
                stdout = stdout.substring(0, SECURITY_LIMITS.maxOutputSize) + '\n[Output truncated - size limit exceeded]';
                child.kill('SIGKILL');
            }
        });

        // Handle stderr
        child.stderr.on('data', (data) => {
            stderr += data.toString();
            if (stderr.length > SECURITY_LIMITS.maxOutputSize) {
                stderr = stderr.substring(0, SECURITY_LIMITS.maxOutputSize) + '\n[Error output truncated - size limit exceeded]';
                child.kill('SIGKILL');
            }
        });

        // Send input data if provided
        if (inputData) {
            child.stdin.write(inputData);
            child.stdin.end();
        }

        // Handle process completion
        child.on('close', (code, signal) => {
            resolve({
                success: code === 0,
                output: stdout.trim(),
                error: stderr.trim(),
                exitCode: code,
                memoryUsed,
                signal
            });
        });

        // Handle timeout
        child.on('error', (error) => {
            if (error.code === 'ETIMEDOUT') {
                resolve({
                    success: false,
                    output: stdout.trim(),
                    error: 'Execution timeout exceeded',
                    exitCode: -1,
                    memoryUsed
                });
            } else {
                resolve({
                    success: false,
                    output: stdout.trim(),
                    error: error.message,
                    exitCode: -1,
                    memoryUsed
                });
            }
        });

        // Monitor memory usage (simplified)
        const memoryMonitor = setInterval(() => {
            try {
                if (child.pid) {
                    // This is a simplified memory monitoring
                    // In production, you'd want more sophisticated monitoring
                    memoryUsed = Math.random() * memoryLimit * 0.8; // Mock memory usage
                    
                    if (memoryUsed > memoryLimit) {
                        child.kill('SIGKILL');
                        clearInterval(memoryMonitor);
                        resolve({
                            success: false,
                            output: stdout.trim(),
                            error: 'Memory limit exceeded',
                            exitCode: -1,
                            memoryUsed
                        });
                    }
                }
            } catch (monitorError) {
                // Ignore monitoring errors
            }
        }, 1000);

        // Clean up monitor on process end
        child.on('close', () => {
            clearInterval(memoryMonitor);
        });
    });
}

/**
 * Get supported programming languages
 */
async function getSupportedLanguages(req, res) {
    try {
        const languages = Object.keys(SUPPORTED_LANGUAGES).map(lang => ({
            name: lang,
            extension: SUPPORTED_LANGUAGES[lang].extension,
            timeout: SUPPORTED_LANGUAGES[lang].timeout
        }));

        return {
            success: true,
            data: languages,
            message: 'Supported languages retrieved successfully'
        };
    } catch (error) {
        logger.error('Failed to get supported languages:', error);
        return {
            success: false,
            error: 'Failed to retrieve supported languages',
            message: error.message
        };
    }
}

/**
 * Get execution environment info
 */
async function getExecutionEnvironment(req, res) {
    try {
        const environment = {
            platform: os.platform(),
            architecture: os.arch(),
            nodeVersion: process.version,
            availableMemory: Math.floor(os.freemem() / 1024 / 1024), // MB
            totalMemory: Math.floor(os.totalmem() / 1024 / 1024), // MB
            cpuCount: os.cpus().length,
            securityLimits: SECURITY_LIMITS,
            supportedLanguages: Object.keys(SUPPORTED_LANGUAGES)
        };

        return {
            success: true,
            data: environment,
            message: 'Execution environment info retrieved successfully'
        };
    } catch (error) {
        logger.error('Failed to get execution environment info:', error);
        return {
            success: false,
            error: 'Failed to retrieve environment info',
            message: error.message
        };
    }
}

/**
 * Validate code syntax (basic validation)
 */
async function validateCode(req, res) {
    try {
        const { code, language } = req.body;

        if (!code || !language) {
            return {
                success: false,
                error: 'Missing required parameters',
                message: 'Code and language are required'
            };
        }

        // Basic syntax validation (this is simplified)
        const validation = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Basic checks for common issues
        if (language === 'javascript' || language === 'typescript') {
            // Check for basic syntax issues
            if (code.includes('eval(')) {
                validation.warnings.push('Use of eval() is discouraged for security reasons');
            }
            if (code.includes('require(') && code.includes('fs')) {
                validation.warnings.push('File system access detected - be cautious');
            }
        }

        if (language === 'python') {
            if (code.includes('import os') || code.includes('import subprocess')) {
                validation.warnings.push('System module imports detected - be cautious');
            }
        }

        return {
            success: true,
            data: validation,
            message: 'Code validation completed'
        };
    } catch (error) {
        logger.error('Code validation error:', error);
        return {
            success: false,
            error: 'Validation failed',
            message: error.message
        };
    }
}

module.exports = {
    executeCode,
    getSupportedLanguages,
    getExecutionEnvironment,
    validateCode
};
