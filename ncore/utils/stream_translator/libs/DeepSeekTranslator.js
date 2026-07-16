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
const logger = require('./Logger.js');
const { Worker } = require('worker_threads');

class DeepSeekTranslator {
    constructor(options = {}) {
        this.modelPath = options.modelPath || 'deepseek-ai/deepseek-vl-1.3b-chat';
        this.modelDir = options.modelDir || null;
        this.pythonCommand = options.pythonCommand || 'python';
        this.process = null;
        this.isReady = false;
        this.requestQueue = [];
        this.processing = false;
        this.responseHandlers = new Map();
        this.requestId = 0;
        this.timeout = options.timeout || 30000;
    }

    _resolveModelPath() {
        // Prefer pre-downloaded local weights (Step36 idempotent install) over a lazy
        // HF download at translator runtime. Staging mirrors pycore system_paths
        // get_local_data_dir(): <CORE_NODE_CACHE_DIR>/pycore/deepseek-vl (or DEEPSEEK_VL_DIR).
        const cacheDir = process.env.CORE_NODE_CACHE_DIR || (process.platform === 'win32' ? 'D:/www/cache' : '/var/_core_node/cache');
        const staging = process.env.DEEPSEEK_VL_DIR || path.join(cacheDir, 'pycore', 'deepseek-vl');
        const weightsDir = path.join(staging, 'weights');
        const sentinel = path.join(staging, '.model_installed');
        const config = path.join(weightsDir, 'config.json');
        try {
            if (fs.existsSync(sentinel) && fs.existsSync(config)) {
                logger.info('DeepSeek-VL: using pre-downloaded local weights at ' + weightsDir);
                return weightsDir;
            }
        } catch (e) {
            // ignore - fall back to configured modelPath (lazy HF download)
        }
        return this.modelPath;
    }

    async start() {
        if (this.process) {
            logger.warn('DeepSeek process already started');
            return true;
        }

        const resolvedModelPath = this._resolveModelPath();
        this.modelPath = resolvedModelPath;
        logger.info('Starting DeepSeek-VL model in separate process');
        logger.info('Model path: ' + resolvedModelPath);

        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, 'deepseek_server.py');

            const args = [
                scriptPath,
                '--model_path', resolvedModelPath
            ];

            if (this.modelDir) {
                args.push('--model_dir', this.modelDir);
            }

            logger.info('Starting Python process: ' + this.pythonCommand + ' ' + args.join(' '));

            this.process = spawn(this.pythonCommand, args, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let startupOutput = '';
            const startupTimeout = setTimeout(() => {
                logger.error('Model startup timeout');
                this.stop();
                reject(new Error('Model startup timeout'));
            }, 60000);

            this.process.stdout.on('data', (data) => {
                const output = data.toString();
                startupOutput += output;

                logger.info('[DeepSeek] ' + output.trim());

                if (output.includes('READY') || output.includes('Model loaded')) {
                    clearTimeout(startupTimeout);
                    this.isReady = true;
                    logger.info('DeepSeek model is ready');
                    resolve(true);
                }

                this.handleModelOutput(output);
            });

            this.process.stderr.on('data', (data) => {
                const output = data.toString();
                logger.warn('[DeepSeek Error] ' + output.trim());
            });

            this.process.on('error', (error) => {
                clearTimeout(startupTimeout);
                logger.error('DeepSeek process error: ' + error.message);
                this.isReady = false;
                reject(error);
            });

            this.process.on('close', (code) => {
                logger.warn('DeepSeek process closed with code: ' + code);
                this.isReady = false;
                this.process = null;
            });
        });
    }

    handleModelOutput(output) {
        try {
            const lines = output.split('\n');
            let i;

            for (i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('{') && line.endsWith('}')) {
                    const response = JSON.parse(line);

                    if (response.id !== undefined && this.responseHandlers.has(response.id)) {
                        const handler = this.responseHandlers.get(response.id);
                        this.responseHandlers.delete(response.id);

                        if (response.error) {
                            handler.reject(new Error(response.error));
                        } else {
                            handler.resolve(response.translation || response.text);
                        }
                    }
                }
            }
        } catch (error) {
            logger.error('Error parsing model output: ' + error.message);
        }
    }

    async translate(text, options = {}) {
        if (!this.isReady) {
            logger.error('DeepSeek model not ready');
            return text;
        }

        const requestId = this.requestId++;
        const targetLanguage = options.targetLanguage || 'Chinese';

        const request = {
            id: requestId,
            text: text,
            target_language: targetLanguage,
            action: 'translate'
        };

        return new Promise((resolve, reject) => {
            this.responseHandlers.set(requestId, { resolve, reject });

            const requestStr = JSON.stringify(request) + '\n';

            try {
                this.process.stdin.write(requestStr);
            } catch (error) {
                this.responseHandlers.delete(requestId);
                logger.error('Failed to send request to model: ' + error.message);
                reject(error);
            }

            const timeoutId = setTimeout(() => {
                if (this.responseHandlers.has(requestId)) {
                    this.responseHandlers.delete(requestId);
                    logger.error('Translation timeout for request: ' + requestId);
                    resolve(text);
                }
            }, this.timeout);

            const originalResolve = this.responseHandlers.get(requestId).resolve;
            this.responseHandlers.get(requestId).resolve = (result) => {
                clearTimeout(timeoutId);
                originalResolve(result);
            };
        });
    }

    async translateBatch(texts, options = {}) {
        const results = [];
        let i;

        for (i = 0; i < texts.length; i++) {
            const translation = await this.translate(texts[i], options);
            results.push(translation);
        }

        return results;
    }

    stop() {
        if (this.process) {
            logger.info('Stopping DeepSeek process');

            try {
                this.process.stdin.end();
                this.process.kill('SIGTERM');
            } catch (error) {
                logger.error('Error stopping process: ' + error.message);
            }

            this.process = null;
            this.isReady = false;

            this.responseHandlers.forEach((handler) => {
                handler.reject(new Error('Process stopped'));
            });
            this.responseHandlers.clear();
        }
    }

    getStatus() {
        return {
            isReady: this.isReady,
            hasProcess: this.process !== null,
            queueLength: this.requestQueue.length,
            pendingRequests: this.responseHandlers.size,
            modelPath: this.modelPath
        };
    }
}

module.exports = DeepSeekTranslator;
