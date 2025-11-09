const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const logger = require('#@logger');
const commander = require('#@commander');

const execAsync = promisify(exec);

class PythonBridge {
  constructor() {
    this.pythonCommand = null;
    this.pythonVersion = null;
    this.initialized = false;
  }

  /**
   * Detect available Python command (python3, python, py)
   * @returns {Promise<string|null>} Python command or null if not found
   */
  async detectPython() {
    if (this.pythonCommand) {
      return this.pythonCommand;
    }

    const commands = ['python3', 'python', 'py'];

    for (const cmd of commands) {
      try {
        const { stdout } = await execAsync(`${cmd} --version`);
        const versionMatch = stdout.match(/Python (\d+\.\d+\.\d+)/);

        if (versionMatch) {
          const version = versionMatch[1];
          const [major, minor] = version.split('.').map(Number);

          if (major >= 3 && minor >= 8) {
            this.pythonCommand = cmd;
            this.pythonVersion = version;
            logger.info(`Python detected: ${cmd} (version ${version})`);
            return cmd;
          } else {
            logger.warn(`Python version ${version} is too old (requires 3.8+)`);
          }
        }
      } catch (error) {
        continue;
      }
    }

    logger.error('No suitable Python installation found (requires Python 3.8+)');
    return null;
  }

  async checkPythonAvailable() {
    const pythonCmd = await this.detectPython();
    return pythonCmd !== null;
  }

  async checkModelAvailable(modelName) {
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      const cacheDir = path.join(homeDir, '.cache', 'huggingface', 'hub');

      const files = await fs.readdir(cacheDir).catch(() => []);
      const modelDirName = `models--${modelName.replace('/', '--')}`;

      const modelExists = files.some(file => file === modelDirName);

      if (modelExists) {
        logger.info(`Model ${modelName} found in cache`);
      } else {
        logger.info(`Model ${modelName} not found in cache`);
      }

      return modelExists;
    } catch (error) {
      logger.warn(`Error checking model cache: ${error.message}`);
      return false;
    }
  }

  async callWithModel(scriptPath, params = {}, options = {}) {
    const pythonCmd = await this.detectPython();

    if (!pythonCmd) {
      throw new Error('Python is not available. Please install Python 3.8 or higher.');
    }

    try {
      logger.info(`Executing Python script: ${scriptPath}`);
      logger.debug(`Parameters: ${JSON.stringify(params)}`);

      const args = [scriptPath];

      if (Object.keys(params).length > 0) {
        args.push('--params', JSON.stringify(params));
      }

      const result = await commander.execute(pythonCmd, args, {
        timeout: options.timeout || 120000,
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      if (result.code !== 0) {
        logger.error(`Python script failed with code ${result.code}`);
        logger.error(`stderr: ${result.stderr}`);
        throw new Error(`Python script execution failed: ${result.stderr}`);
      }

      try {
        const output = JSON.parse(result.stdout);
        logger.info('Python script executed successfully');
        return output;
      } catch (parseError) {
        logger.warn('Python script output is not JSON, returning raw stdout');
        return { stdout: result.stdout, stderr: result.stderr };
      }
    } catch (error) {
      logger.error(`Error executing Python script: ${error.message}`);
      throw error;
    }
  }

  async batchCall(scriptPath, batchParams = [], options = {}) {
    logger.info(`Batch executing Python script: ${scriptPath} (${batchParams.length} items)`);

    const results = [];

    for (let i = 0; i < batchParams.length; i++) {
      try {
        logger.debug(`Batch item ${i + 1}/${batchParams.length}`);
        const result = await this.callWithModel(scriptPath, batchParams[i], options);
        results.push({ success: true, result });
      } catch (error) {
        logger.error(`Batch item ${i + 1} failed: ${error.message}`);
        results.push({ success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`Batch execution completed: ${successCount}/${batchParams.length} successful`);

    return results;
  }

  async getModelInfo(modelName) {
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      const cacheDir = path.join(homeDir, '.cache', 'huggingface', 'hub');
      const modelDirName = `models--${modelName.replace('/', '--')}`;
      const modelPath = path.join(cacheDir, modelDirName);

      try {
        const stat = await fs.stat(modelPath);

        const getSize = async (dirPath) => {
          let size = 0;
          const files = await fs.readdir(dirPath, { withFileTypes: true });

          for (const file of files) {
            const filePath = path.join(dirPath, file.name);
            if (file.isDirectory()) {
              size += await getSize(filePath);
            } else {
              const fileStat = await fs.stat(filePath);
              size += fileStat.size;
            }
          }

          return size;
        };

        const size = await getSize(modelPath);

        return {
          exists: true,
          path: modelPath,
          size: size,
          sizeFormatted: `${(size / 1024 / 1024).toFixed(2)} MB`,
          lastModified: stat.mtime
        };
      } catch (error) {
        return {
          exists: false,
          path: modelPath,
          error: error.message
        };
      }
    } catch (error) {
      logger.error(`Error getting model info: ${error.message}`);
      throw error;
    }
  }

  async clearModelCache(modelName) {
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      const cacheDir = path.join(homeDir, '.cache', 'huggingface', 'hub');
      const modelDirName = `models--${modelName.replace('/', '--')}`;
      const modelPath = path.join(cacheDir, modelDirName);

      logger.info(`Clearing model cache: ${modelPath}`);

      await fs.rm(modelPath, { recursive: true, force: true });

      logger.info(`Model cache cleared: ${modelName}`);
      return true;
    } catch (error) {
      logger.error(`Error clearing model cache: ${error.message}`);
      return false;
    }
  }
}

let instance = null;

function getInstance() {
  if (!instance) {
    instance = new PythonBridge();
  }
  return instance;
}

module.exports = {
  PythonBridge,
  getInstance
};
