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

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class PythonCaller {
    constructor(options = {}) {
        this.pythonPath = options.pythonPath || this.detectPythonPath();
        this.projectRoot = options.projectRoot || this.detectProjectRoot();
        this.pycorePath = options.pycorePath || path.join(this.projectRoot, 'pycore');
        this.timeout = options.timeout || 30000;
        this.encoding = options.encoding || 'utf-8';
        this.verbose = options.verbose !== undefined ? options.verbose : true;
    }

    detectPythonPath() {
        const platform = os.platform();
        const possiblePaths = platform === 'win32'
            ? ['python', 'python3', 'py']
            : ['python3', 'python'];

        return possiblePaths[0];
    }

    detectProjectRoot() {
        let currentDir = __dirname;
        const maxDepth = 10;
        let depth = 0;

        while (depth < maxDepth) {
            const pycoreDir = path.join(currentDir, 'pycore');
            const ncoreDir = path.join(currentDir, 'ncore');

            if (fs.existsSync(pycoreDir) && fs.existsSync(ncoreDir)) {
                return currentDir;
            }

            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) break;

            currentDir = parentDir;
            depth++;
        }

        return path.resolve(__dirname, '../../..');
    }

    async call(scriptPath, params = {}, options = {}) {
        const isAbsolutePath = path.isAbsolute(scriptPath);
        const fullScriptPath = isAbsolutePath
            ? scriptPath
            : path.join(this.pycorePath, scriptPath);

        if (!fs.existsSync(fullScriptPath)) {
            throw new Error(`Python script not found: ${fullScriptPath}`);
        }

        const timeout = options.timeout || this.timeout;
        const verbose = options.verbose !== undefined ? options.verbose : this.verbose;

        return this.executePython(fullScriptPath, params, { timeout, verbose });
    }

    async callModule(modulePath, functionName, params = {}, options = {}) {
        const tempScript = this.generateTempScript(modulePath, functionName, params);
        const tempScriptPath = path.join(os.tmpdir(), `py_bridge_${Date.now()}.py`);

        try {
            fs.writeFileSync(tempScriptPath, tempScript, 'utf-8');
            const result = await this.executePython(tempScriptPath, {}, options);
            fs.unlinkSync(tempScriptPath);
            return result;
        } catch (error) {
            if (fs.existsSync(tempScriptPath)) {
                fs.unlinkSync(tempScriptPath);
            }
            throw error;
        }
    }

    generateTempScript(modulePath, functionName, params) {
        const paramsJson = JSON.stringify(params);

        return `
import sys
import os
import json

project_root = ${JSON.stringify(this.projectRoot)}
pycore_path = ${JSON.stringify(this.pycorePath)}

if pycore_path not in sys.path:
    sys.path.insert(0, pycore_path)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

try:
    from ${modulePath} import ${functionName}

    params = json.loads('''${paramsJson}''')

    result = ${functionName}(**params) if params else ${functionName}()

    output = {
        'success': True,
        'result': result,
        'error': None
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))

except Exception as e:
    import traceback
    output = {
        'success': False,
        'result': None,
        'error': str(e),
        'traceback': traceback.format_exc()
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    sys.exit(1)
`;
    }

    async executePython(scriptPath, params = {}, options = {}) {
        const timeout = options.timeout || this.timeout;
        const verbose = options.verbose !== undefined ? options.verbose : this.verbose;

        return new Promise((resolve, reject) => {
            const args = [scriptPath];

            if (Object.keys(params).length > 0) {
                args.push(JSON.stringify(params));
            }

            const pythonProcess = spawn(this.pythonPath, args, {
                env: {
                    ...process.env,
                    PYTHONPATH: `${this.pycorePath}${path.delimiter}${this.projectRoot}`,
                    PYTHONIOENCODING: 'utf-8'
                },
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';
            let timeoutHandle = null;

            if (timeout > 0) {
                timeoutHandle = setTimeout(() => {
                    pythonProcess.kill('SIGTERM');
                    reject(new Error(`Python execution timeout after ${timeout}ms`));
                }, timeout);
            }

            pythonProcess.stdout.on('data', (data) => {
                const output = data.toString(this.encoding);
                stdout += output;
                if (verbose) {
                    console.log('[Python stdout]:', output.trim());
                }
            });

            pythonProcess.stderr.on('data', (data) => {
                const error = data.toString(this.encoding);
                stderr += error;
                if (verbose) {
                    console.error('[Python stderr]:', error.trim());
                }
            });

            pythonProcess.on('close', (code) => {
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }

                try {
                    const result = this.parseOutput(stdout, stderr, code);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });

            pythonProcess.on('error', (error) => {
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }
                reject(new Error(`Failed to start Python process: ${error.message}`));
            });
        });
    }

    parseOutput(stdout, stderr, exitCode) {
        stdout = stdout.trim();
        stderr = stderr.trim();

        if (exitCode !== 0) {
            return {
                success: false,
                result: null,
                stdout: stdout,
                stderr: stderr,
                exitCode: exitCode,
                error: stderr || 'Python script exited with non-zero code'
            };
        }

        try {
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    success: parsed.success !== false,
                    result: parsed.result || parsed,
                    stdout: stdout,
                    stderr: stderr,
                    exitCode: exitCode,
                    error: parsed.error || null,
                    traceback: parsed.traceback || null
                };
            }
        } catch (e) {
            // Not JSON output, return as plain text
        }

        return {
            success: true,
            result: stdout,
            stdout: stdout,
            stderr: stderr,
            exitCode: exitCode,
            error: stderr || null
        };
    }

    async checkPythonAvailable() {
        try {
            const result = await this.executePython('-c', {}, {
                timeout: 5000,
                verbose: false
            });
            return result.success;
        } catch (error) {
            return false;
        }
    }

    async getPythonVersion() {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn(this.pythonPath, ['--version']);

            let output = '';

            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                output += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error('Failed to get Python version'));
                }
            });
        });
    }
}

module.exports = PythonCaller;
