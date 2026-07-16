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

const PythonCaller = require('./PythonCaller');
const { getXdgCacheHome } = require('../../../../foundation/common/system_paths');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class ModelCaller extends PythonCaller {
    constructor(options = {}) {
        super(options);

        this.modelCachePath = options.modelCachePath || path.join(getXdgCacheHome(), 'huggingface');
        this.persistentProcesses = new Map();
        this.defaultModelTimeout = options.defaultModelTimeout || 120000;
        this.enableProgressCallback = options.enableProgressCallback !== undefined ? options.enableProgressCallback : true;
    }

    async callWithModel(scriptPath, params = {}, options = {}) {
        let fullScriptPath, timeout, verbose, progressCallback, env;
        const isAbsolutePath = path.isAbsolute(scriptPath);

        fullScriptPath = isAbsolutePath
            ? scriptPath
            : path.join(this.pycorePath, scriptPath);

        if (!fs.existsSync(fullScriptPath)) {
            throw new Error(`Python script not found: ${fullScriptPath}`);
        }

        timeout = options.timeout || this.defaultModelTimeout;
        verbose = options.verbose !== undefined ? options.verbose : this.verbose;
        progressCallback = options.onProgress;

        env = {
            ...process.env,
            PYTHONPATH: `${this.pycorePath}${path.delimiter}${this.projectRoot}`,
            PYTHONIOENCODING: 'utf-8',
            HF_HOME: options.hfHome || this.modelCachePath,
            TRANSFORMERS_CACHE: path.join(options.hfHome || this.modelCachePath, 'hub'),
            HF_HUB_CACHE: path.join(options.hfHome || this.modelCachePath, 'hub')
        };

        if (options.device) {
            env.CUDA_VISIBLE_DEVICES = options.device;
        }

        return this.executeModelPython(fullScriptPath, params, {
            timeout,
            verbose,
            env,
            progressCallback
        });
    }

    async executeModelPython(scriptPath, params = {}, options = {}) {
        let timeout, verbose, env, progressCallback;

        timeout = options.timeout || this.defaultModelTimeout;
        verbose = options.verbose !== undefined ? options.verbose : this.verbose;
        env = options.env || process.env;
        progressCallback = options.progressCallback;

        return new Promise((resolve, reject) => {
            let args, pythonProcess, stdout, stderr, timeoutHandle;

            args = [scriptPath];

            if (Object.keys(params).length > 0) {
                args.push(JSON.stringify(params));
            }

            pythonProcess = spawn(this.pythonPath, args, {
                env: env,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            stdout = '';
            stderr = '';
            timeoutHandle = null;

            if (timeout > 0) {
                timeoutHandle = setTimeout(() => {
                    pythonProcess.kill('SIGTERM');
                    reject(new Error(`Python model execution timeout after ${timeout}ms`));
                }, timeout);
            }

            pythonProcess.stdout.on('data', (data) => {
                const output = data.toString(this.encoding);
                stdout += output;

                if (verbose) {
                    console.log('[Model stdout]:', output.trim());
                }

                if (progressCallback && this.enableProgressCallback) {
                    const progressMatch = output.match(/\[PROGRESS\]\s*(\d+(?:\.\d+)?)/);
                    if (progressMatch) {
                        progressCallback(parseFloat(progressMatch[1]));
                    }
                }
            });

            pythonProcess.stderr.on('data', (data) => {
                const error = data.toString(this.encoding);
                stderr += error;

                if (verbose) {
                    const isDownloadProgress = error.includes('Downloading') || error.includes('download');
                    if (isDownloadProgress) {
                        process.stderr.write(error);
                    } else {
                        console.error('[Model stderr]:', error.trim());
                    }
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
                reject(new Error(`Failed to start Python model process: ${error.message}`));
            });
        });
    }

    async checkModelAvailable(modelName, options = {}) {
        let scriptPath, checkScript;

        scriptPath = path.join(os.tmpdir(), `check_model_${Date.now()}.py`);

        checkScript = `
import os
import sys
import json

os.environ['HF_HOME'] = ${JSON.stringify(options.hfHome || this.modelCachePath)}

try:
    from transformers import AutoTokenizer, AutoModel

    model_name = ${JSON.stringify(modelName)}

    print(json.dumps({
        'success': True,
        'model': model_name,
        'message': 'Checking model availability...'
    }))

    tokenizer = AutoTokenizer.from_pretrained(model_name, local_files_only=True)
    model = AutoModel.from_pretrained(model_name, local_files_only=True)

    print(json.dumps({
        'success': True,
        'available': True,
        'model': model_name,
        'cached': True
    }))

except Exception as e:
    print(json.dumps({
        'success': True,
        'available': False,
        'model': model_name,
        'cached': False,
        'error': str(e)
    }))
`;

        try {
            fs.writeFileSync(scriptPath, checkScript, 'utf-8');
            const result = await this.executeModelPython(scriptPath, {}, {
                timeout: 10000,
                verbose: false,
                env: {
                    ...process.env,
                    HF_HOME: options.hfHome || this.modelCachePath
                }
            });

            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
            }

            try {
                const parsed = JSON.parse(result.stdout);
                return parsed.available || false;
            } catch (e) {
                return false;
            }
        } catch (error) {
            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
            }
            return false;
        }
    }

    async batchCall(scriptPath, paramsArray, options = {}) {
        let results, batchSize, i, batch, batchPromises;

        results = [];
        batchSize = options.batchSize || 5;

        for (i = 0; i < paramsArray.length; i += batchSize) {
            batch = paramsArray.slice(i, i + batchSize);
            batchPromises = batch.map(params =>
                this.callWithModel(scriptPath, params, {
                    ...options,
                    verbose: false
                })
            );

            try {
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
            } catch (error) {
                throw new Error(`Batch processing failed at batch ${Math.floor(i / batchSize)}: ${error.message}`);
            }
        }

        return results;
    }

    async getModelInfo(modelName, options = {}) {
        let scriptPath, infoScript;

        scriptPath = path.join(os.tmpdir(), `model_info_${Date.now()}.py`);

        infoScript = `
import os
import sys
import json

os.environ['HF_HOME'] = ${JSON.stringify(options.hfHome || this.modelCachePath)}

try:
    from transformers import AutoConfig

    model_name = ${JSON.stringify(modelName)}

    config = AutoConfig.from_pretrained(model_name)

    info = {
        'success': True,
        'model': model_name,
        'architecture': config.architectures[0] if hasattr(config, 'architectures') else 'unknown',
        'hidden_size': getattr(config, 'hidden_size', None),
        'num_layers': getattr(config, 'num_hidden_layers', None),
        'vocab_size': getattr(config, 'vocab_size', None),
        'model_type': getattr(config, 'model_type', None)
    }

    print(json.dumps(info, ensure_ascii=False))

except Exception as e:
    import traceback
    print(json.dumps({
        'success': False,
        'model': model_name,
        'error': str(e),
        'traceback': traceback.format_exc()
    }))
`;

        try {
            fs.writeFileSync(scriptPath, infoScript, 'utf-8');
            const result = await this.executeModelPython(scriptPath, {}, {
                timeout: 30000,
                verbose: false,
                env: {
                    ...process.env,
                    HF_HOME: options.hfHome || this.modelCachePath
                }
            });

            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
            }

            try {
                return JSON.parse(result.stdout);
            } catch (e) {
                return {
                    success: false,
                    error: 'Failed to parse model info'
                };
            }
        } catch (error) {
            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
            }
            throw error;
        }
    }

    async clearModelCache(modelName, options = {}) {
        let cacheDir, modelCachePattern, files, i, file;

        cacheDir = path.join(options.hfHome || this.modelCachePath, 'hub');

        if (!fs.existsSync(cacheDir)) {
            return { success: true, message: 'Cache directory does not exist' };
        }

        try {
            modelCachePattern = modelName.replace('/', '--');
            files = fs.readdirSync(cacheDir);

            for (i = 0; i < files.length; i++) {
                file = files[i];
                if (file.includes(modelCachePattern)) {
                    const filePath = path.join(cacheDir, file);
                    const stats = fs.statSync(filePath);

                    if (stats.isDirectory()) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(filePath);
                    }
                }
            }

            return {
                success: true,
                message: `Cache cleared for model: ${modelName}`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    getModelCachePath() {
        return this.modelCachePath;
    }

    setModelCachePath(cachePath) {
        this.modelCachePath = cachePath;
        return this;
    }

    cleanupPersistentProcesses() {
        for (const [key, process] of this.persistentProcesses.entries()) {
            try {
                process.kill('SIGTERM');
            } catch (e) {
            }
        }
        this.persistentProcesses.clear();
    }
}

module.exports = ModelCaller;
