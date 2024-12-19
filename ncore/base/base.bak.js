const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');
import crypto from 'crypto';
import os from 'os';
import { execSync, spawn } from 'child_process';
// import Log from './log.js';
import fileCodings from './types/character_set.js';
import baseconfig from './types/baseconfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Base {
    constructor() {
        this.config = {};
        this.initialWorkingDirectory = this.getCwd();
        this.powershellPath = os.platform() === 'win32' ? this.findPowerShellPath() : null;
    }

    findPowerShellPath() {
        const standardPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
        const corePath = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';

        if (fs.existsSync(corePath)) {
            return corePath;
        } else if (fs.existsSync(standardPath)) {
            return standardPath;
        } else {
            console.error('PowerShell not found. Please ensure PowerShell is installed.');
            return null;
        }
    }

    getBaseConfig() {
        return baseconfig
    }

    getCwd(suffix = "") {
        if (!this.cachedCwd) {
            try {
                const baseFile = __dirname;
                const baseDir = path.basename(baseFile);
                const appDir = path.resolve(baseDir, '../');
                this.cachedCwd = appDir;
            } catch (e) {
                let mainFilePath = process.argv[0];
                if (fs.existsSync(mainFilePath) && fs.statSync(mainFilePath).isFile()) {
                    if (path.extname(mainFilePath).toLowerCase() === '.exe') {
                        let exeName = path.basename(mainFilePath).toLowerCase();
                        if (exeName === 'node.exe' || exeName === 'electron.exe') {
                            this.warn(`getCwd() - Using ${exeName} is not recommended. Please check the path: ${mainFilePath}`);
                        } else {
                            this.cachedCwd = path.join(path.dirname(mainFilePath), 'resources/app');
                        }
                    }
                }
            }
            if (!this.cachedCwd) {
                this.cachedCwd = path.resolve(__dirname, '..', '..');
            }
        }
        let cwd = this.cachedCwd;
        if (suffix) {
            cwd = path.join(cwd, suffix);
        }
        return cwd;
    }

    setAttr(key, value) {
        this[key] = value;
    }

    getAttr(key) {
        return this[key];
    }

    randomString(n = 64, upper = false) {
        const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const digits = '0123456789';
        const chars = letters + digits;
        let result = '';
        for (let i = 0; i < n; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return upper ? result.toUpperCase() : result.toLowerCase();
    }

    createFileName(suffix = "", prefix = '') {
        const filename = this.randomString(16);
        const saveTime = this.createTime();
        const fullPrefix = prefix ? `${prefix}_` : '';
        const filePath = path.join(this.getCwd(), `out/tmp/${fullPrefix}${saveTime}_${filename}${suffix}`);
        return filePath;
    }

    createTime() {
        const now = new Date();
        return `${now.getFullYear()}_${now.getMonth() + 1}_${now.getDate()}_${now.getHours()}_${now.getMinutes()}_${now.getSeconds()}`;
    }

    md5(value) {
        return crypto.createHash('md5').update(value).digest('hex');
    }

    md5id(srcvalue) {
        const md5str = this.md5(srcvalue);
        return `id_${md5str}`;
    }

    genId() {
        return crypto.randomUUID();
    }

    isWindows() {
        return os.platform() === 'win32';
    }

    isLinux() {
        return os.platform() === 'linux';
    }

    getSystemName() {
        return os.platform();
    }

    isDir(dir) {
        try {
            const stats = fs.statSync(dir);
            return stats.isDirectory();
        } catch (err) {
            console.error(`Base-Error checking if directory: ${err.message}`);
            return false;
        }
    }

    mkdir(dirPath) {
        try {
            fs.mkdirSync(dirPath, { recursive: true });
            return true;
        } catch (error) {
            console.error(`Error creating directory "${dirPath}": ${error}`);
            return false;
        }
    }

    read(fileName, encoding = 'utf-8', info = false, readLine = false) {
        // const resolvedPath = this.resolvePath(fileName);
        const resolvedPath = fileName;
        if (!this.isFile(resolvedPath)) {
            this.warn(`File '${resolvedPath}' does not exist.`);
            return null;
        }
        return this.tryFileEncode(resolvedPath, encoding, info, readLine);
    }

    readText(fileName, encoding = 'utf-8', info = false) {
        const fileObject = this.read(fileName, encoding, info);
        return fileObject ? fileObject.content : null;
    }

    readLines(fileName, encoding = 'utf-8', info = false) {
        const fileObject = this.read(fileName, encoding, info, true);
        return fileObject ? fileObject.content : null;
    }

    readLine(fileName, encoding = 'utf-8', info = false) {
        const fileObject = this.read(fileName, encoding, info, true);
        return fileObject && fileObject.content ? fileObject.content[0] : '';
    }

    readJson(fileName, encoding = 'utf-8', info = false) {
        const fileObject = this.read(fileName, encoding, info);
        if (fileObject) {
            try {
                return JSON.parse(fileObject.content);
            } catch (e) {
                this.warn(`Failed to parse JSON from file '${fileName}'. Error: ${e}`);
            }
        }
        return {};
    }

    save(fileName = null, content = null, encoding = 'utf-8', overwrite = false) {
        if (!fileName) fileName = this.createFileName();
        if (!content) return null;
        if (Array.isArray(content)) content = content.join('\n');
        const mode = overwrite ? 'wb' : 'ab';
        // const filePath = this.resolvePath(fileName);
        const filePath = fileName;
        this.mkBasedir(filePath);
        try {
            fs.writeFileSync(filePath, content, { encoding });
        } catch (e) {
            this.warn(`save: ${e}`);
            return null;
        }
        return filePath;
    }

    isFile(path) {
        try {
            return fs.existsSync(path) && fs.lstatSync(path).isFile();
        } catch {
            return false;
        }
    }

    mkBasedir(dir) {
        return this.mkdir(path.dirname(dir));
    }

    resolvePath(path, relativePath = null, resolve = true) {
        if (!resolve) return path;
        if (!path.isAbsolute(path)) {
            const rootPath = this.getCwd(relativePath);
            path = path.join(rootPath, path);
        }
        return path;
    }

    tryFileEncode(fileName, encoding, info, readLines) {
        const codings = encoding ? [encoding, ...fileCodings] : fileCodings;
        for (let i = 0; i < codings.length; i++) {
            try {
                const content = readLines ? fs.readFileSync(fileName, { encoding: codings[i] }).split('\n') : fs.readFileSync(fileName, { encoding: codings[i] });
                if (info) this.success(`Successfully read ${fileName} with ${codings[i]}`);
                return { encoding: codings[i], content };
            } catch (e) {
                this.error(e);
            }
        }
        return null;
    }

    runExe(command, info = true) {
        const cmd = this.isWindows() ? `start ${command}` : command;
        try {
            const result = execSync(cmd, { encoding: 'utf-8' });
            if (info) {
                this.info(`Run-Exe-command: ${command}`);
                this.info(result);
            }
            return result;
        } catch (e) {
            console.error(`Error runExe: ${command}`);
            console.error(e);
            return '';
        }
    }

    execPowerShell(command, info = false, cwd = null, no_std = false, env = null) {
        if (!this.powershellPath) {
            console.error('PowerShell path is not set.');
            return null;
        }

        if (Array.isArray(command)) {
            command = command.join(" ");
        }
        command = command.trim()
        const fullCommand = `${this.powershellPath} -Command "${command}"`;
        return this.execCmd(fullCommand, info, cwd, no_std, env);
    }

    pipeExecCmd(command, cwd = null, env = null) {
        return this.execCmd(command, true, cwd, true, env)
    }

    execCmd(command, info = false, cwd = null, no_std = false, env = null) {
        if (env) {
            env = Object.assign({}, process.env, env);
        }

        if (Array.isArray(command)) {
            command = command.join(" ");
        }
        command = command.trim()
        if (info) {
            this.info(`command\t: ${command}`);
            if (cwd) this.info(`cwd\t: ${cwd}`);
        }
        const options = no_std ? { stdio: 'inherit' } : {};
        if (env) options.env = env;
        let isChangedDir = false;

        if (cwd && this.isDir(cwd)) {
            isChangedDir = true;
            options.cwd = cwd;
            process.chdir(cwd);
        }
        let result;
        try {
            if (this.isLinux()) {
                try {
                    result = execSync(command, { shell: '/bin/bash', ...options });
                } catch (error) {
                    result = execSync(command, { shell: 'sh', ...options });
                }
            } else {
                result = execSync(command, options);
            }
        } catch (error) {
            console.error(`Error executing command: ${error.message}`);
            result = Buffer.from(error.message, 'utf8');
        }

        const resultText = this.byteToStr(result);
        if (info) {
            this.info(`execCmd-resultText:`);
            this.info(resultText);
        }

        if (isChangedDir) {
            process.chdir(this.initialWorkingDirectory);
        }

        return resultText;
    }

    byteToStr(astr) {
        if (Buffer.isBuffer(astr)) {
            astr = astr.toString('utf-8');
        } else {
            astr = String(astr);
            const isByte = /^b\'{0,1}/;
            if (isByte.test(astr)) {
                astr = astr.replace(/^b\'{0,1}/, '').replace(/\'{0,1}$/, '');
            }
        }
        astr = astr.replace(/\x00/g, '');
        return astr
    }

    async spawnAsync(command, info = true, cwd = null, logname = null, callback, timeout = 5000, progressCallback = null) {
        let cmd = '';
        let args = [];
        if (typeof command === 'string') {
            command = command.split(/\s+/)
        }
        if (Array.isArray(command)) {
            cmd = command[0];
            args = command.slice(1);
        } else {
            cmd = command;
        }
        if (info) {
            console.log(command);
        }
        let timer = null;
        let callbackExecuted = false;
        return new Promise((resolve, reject) => {
            const options = {
                stdio: 'pipe'
            };
            if (cwd) {
                options.cwd = cwd;
                process.chdir(cwd);
            }
            let childProcess;
            childProcess = spawn(cmd, args, options);
            let stdoutData = '';
            let stderrData = '';
            const resetTimer = () => {
                if (timer !== null) {
                    clearTimeout(timer);
                }
                timer = setTimeout(() => {
                    if (!callbackExecuted) {
                        if (callback) callback(this.wrapEmdResult(true, stdoutData, null, 0, info));
                        callbackExecuted = true;
                        // childProcess.kill();
                    }
                }, timeout);
            };
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const onOutput = (data) => {
                const output = data.toString();
                if (output.match(/(y\/n)/i)) {
                    childProcess.stdin.write('Y\n');
                }
                resetTimer();
                if (info) {
                    console.log(output);
                }
                if (logname) {
                    // this.easyLog(output, logname);
                }
                stdoutData += output + '\n';
                progressCallback && progressCallback(stdoutData);
            };

            const onOutputYesNo = (data) => {
                const output = data.toString();
                if (output.match(/(yes\/no)/i)) {
                    childProcess.stdin.write('Yes\n');
                }
                resetTimer();
                if (info) {
                    console.log(output);
                }
                if (logname) {
                    // this.easyLog(output, logname);
                }
                stdoutData += output + '\n';
                progressCallback && progressCallback(stdoutData);
            };

            childProcess.stdout.on('data', onOutput);
            childProcess.stdout.on('data', onOutputYesNo);

            childProcess.stderr.on('data', (data) => {
                resetTimer();
                const error = data.toString();
                if (info) {
                    console.warn(error);
                }
                stderrData += error + '\n';
                progressCallback && progressCallback(stdoutData);
            });

            childProcess.on('close', (code) => {
                process.chdir(this.initialWorkingDirectory);
                if (logname) {
                    // this.easyLog(stdoutData, logname);
                }
                if (code === 0) {
                    resolve(this.wrapEmdResult(true, stdoutData, null, 0, info));
                } else {
                    resolve(
                        this.wrapEmdResult(false,
                            stdoutData,
                            stderrData,
                            code, info)
                    );
                }
            });

            childProcess.on('error', (err) => {
                process.chdir(this.initialWorkingDirectory);
                resolve(
                    this.wrapEmdResult(false,
                        stdoutData,
                        err,
                        -1, info)
                );
            });
        });
    }

    wrapEmdResult(success = true, stdout = '', error = null, code = 0, info = true) {
        stdout = this.byteToStr(stdout)
        error = this.byteToStr(stdout)
        if (info) {
            this.info(stdout)
            this.warn(error)
        }
        return {
            success,
            stdout,
            error,
            code
        }
    }


    getEnvFile() {
        return path.join(this.getCwd(), '.env');
    }

    readEnv() {
        const filePath = this.getEnvFile();
        if (!fs.existsSync(filePath)) return [];
        const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
        return lines.map(line => line.split('=').map(value => value.trim()));
    }

    saveEnv(envArr) {
        const filteredEnvArr = envArr.filter(subArr => subArr.length === 2);
        const formattedLines = filteredEnvArr.map(subArr => `${subArr[0]}=${subArr[1]}`).join('\n');
        const envFilePath = this.getEnvFile();
        try {
            fs.writeFileSync(envFilePath, formattedLines, 'utf-8');
        } catch (e) {
            console.error(`Error saving environment variables: ${e}`);
        }
    }

    setEnv(key, value) {
        const envArr = this.readEnv();
        let keyExists = false;
        for (const subArr of envArr) {
            if (subArr[0] === key) {
                subArr[1] = value;
                keyExists = true;
                break;
            }
        }
        if (!keyExists) {
            envArr.push([key, value]);
        }
        this.saveEnv(envArr);
    }

    isEnv(key) {
        return this.getEnv(key) !== '';
    }

    getEnv(key) {
        const envArr = this.readEnv();
        for (const subArr of envArr) {
            if (subArr[0] === key) return subArr[1];
        }
        return '';
    }

    warn(...args) {
        this._log('warn', args);
    }

    error(...args) {
        this._log('error', args);
    }

    success(...args) {
        this._log('success', args);
    }

    info(...args) {
        this._log('info', args);
    }

    _log(level, args) {
        const colorMap = {
            info: '\x1b[34m',
            success: '\x1b[32m',
            warn: '\x1b[33m',
            error: '\x1b[31m',
        };
        const color = colorMap[level] || '\x1b[37m';
        for (const msg of args) {
            console.log(`${color}${msg}\x1b[0m`);
        }
    }
}

module.exports = Base;
