import { execSync, spawn, exec, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = path.join(__dirname, '../../../../')

class CommandExecutor {
    constructor() {
        this.initialWorkingDirectory = cwd;
        this.colors = {
            reset: '\x1b[0m',
            bright: '\x1b[1m',
            dim: '\x1b[2m',
            underscore: '\x1b[4m',
            blink: '\x1b[5m',
            reverse: '\x1b[7m',
            hidden: '\x1b[8m',
            // Foreground (text) colors
            fg: {
                black: '\x1b[30m',
                red: '\x1b[31m',
                green: '\x1b[32m',
                yellow: '\x1b[33m',
                blue: '\x1b[34m',
                magenta: '\x1b[35m',
                cyan: '\x1b[36m',
                white: '\x1b[37m'
            }
        };
    }

    // Get current working directory
    getCwd() {
        return process.cwd();
    }

    // Convert bytes to string with error handling
    byteToStr(astr) {
        try {
            return astr.toString('utf-8');
        } catch (e) {
            astr = String(astr);
            if (/^b\'{0,1}/.test(astr)) {
                astr = astr.replace(/^b\'{0,1}/, '').replace(/\'{0,1}$/, '');
            }
            return astr;
        }
    }

    // Check if running on Linux
    isLinux() {
        return process.platform === 'linux';
    }

    // Write log to file
    easyLog(content, logname) {
        try {
            const logDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            const logPath = path.join(logDir, `${logname}.log`);
            fs.appendFileSync(logPath, content + '\n');
        } catch (error) {
            console.error('Failed to write log:', error);
        }
    }

    async execCommand(command, info = true, cwd = null, logname = null) {
        if (info) {
            this.info(command);
        }

        return new Promise((resolve, reject) => {
            let options = {};
            if (cwd) {
                options.cwd = cwd;
            }
            exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    if (logname) {
                        this.easyLog(stderr, logname);
                    }
                    resolve(this.wrapEmdResult(false, stdout, stderr, error.code, info));
                } else {
                    console.log(`exec stdout: ${stdout}`);
                    if (logname) {
                        this.easyLog(stdout, logname);
                    }
                    if (stderr) {
                        console.warn(`exec stderr: ${stderr}`);
                        resolve(this.wrapEmdResult(true, stdout, stderr, 0, info));
                    } else {
                        resolve(this.wrapEmdResult(true, stdout, null, 0, info));
                    }
                }
            });
        });
    }

    async cmd(command, info = false, cwd = null, logname = null) {
        if (Array.isArray(command)) {
            command = command.join(" ");
        }
        if (info) {
            this.info(command);
        }
        return new Promise((resolve, reject) => {
            const options = { stdio: 'pipe' };
            if (cwd) {
                options.cwd = cwd;
                process.chdir(cwd);
            }
            const childProcess = this.isLinux()
                ? spawnSync('/bin/bash', ['-c', command], options)
                : spawnSync(command, options);

            let stdoutData = '';
            let stderrData = '';
            childProcess.stdout.on('data', (data) => {
                const output = this.byteToStr(data);
                if (info) {
                    this.info(output);
                }
                stdoutData += output;
            });
            childProcess.stderr.on('data', (data) => {
                const error = this.byteToStr(data);
                if (info) {
                    this.warn(error);
                }
                stderrData += error;
            });
            childProcess.on('close', (code) => {
                process.chdir(this.initialWorkingDirectory); // 切换回原始的系统工作目录
                if (logname) {
                    this.easyLog(stdoutData, logname);
                }
                if (code === 0) {
                    resolve(true);
                } else {
                    reject(`Command execution failed with code ${code}\n${stderrData}`);
                }
            });
            childProcess.on('error', (err) => {
                process.chdir(this.initialWorkingDirectory); // 切换回原始的系统工作目录
                reject(`Error executing command: ${err}`);
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

    async cmdSync(command, info = true, cwd = null, logname = null) {
        return await this.execCommand(command, info, cwd, logname)
    }

    async cmdAsync(command, info = true, cwd = null, logname = null) {
        return await this.execCmd(command, info, cwd, logname)
    }

    execCmd(command, info = false, cwd = null, logname = null) {
        if (Array.isArray(command)) {
            command = command.join(" ");
        }
        if (info) {
            this.info(`command\t: ${command}`);
            this.info(`cwd\t: ${cwd}`);
        }
        const options = { stdio: 'inherit' };
        let is_changed_dir = false
        if (cwd) {
            is_changed_dir = true
            options.cwd = cwd;
            process.chdir(cwd);
        }
        const result = this.isLinux()
            ? execSync(command, { shell: '/bin/bash', ...options })
            : execSync(command, options);
        const resultText = this.byteToStr(result)
        if (logname) {
            this.easyLog(resultText, logname);
        }
        if (info) {
            this.info(resultText);
        }
        if (is_changed_dir) {
            process.chdir(this.initialWorkingDirectory);
        }
        return resultText;
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

            // 监听输出，如果遇到 (Y/N)，则输入 Y
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

            // 监听输出，如果遇到 (Yes/No)，则输入 Yes
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

    async spawnSync(command, info = true, cwd = null, logname = null) {
        let cmd = '';
        let args = [];
        command = command.split(/\s+/)
        if (Array.isArray(command)) {
            cmd = command[0];
            args = command.slice(1);
        } else {
            cmd = command;
        }
        if (info) {
            this.info(command);
        }
        return new Promise((resolve, reject) => {
            const options = {
                stdio: 'pipe'
            };
            if (cwd) {
                options.cwd = cwd;
                process.chdir(cwd);
            }
            const childProcess = this.isLinux()
                ? spawnSync('/bin/bash', ['-c', cmd].concat(args), options)
                : spawnSync(cmd, args, options);

            let stdoutData = '';
            let stderrData = '';
            childProcess.stdout.on('data', (data) => {
                const output = this.byteToStr(data);
                if (info) {
                    this.info(output);
                }
                if (logname) {
                    this.easyLog(output, logname);
                }
                stdoutData += output + '\n';
            });
            childProcess.stderr.on('data', (data) => {
                const error = this.byteToStr(data);
                if (info) {
                    this.warn(error);
                }
                stderrData += error + '\n';
            });
            childProcess.on('close', (code) => {
                process.chdir(this.initialWorkingDirectory);
                if (logname) {
                    this.easyLog(stdoutData, logname);
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
                console.log(`childProcess-error`)
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

    // Add logging methods
    info(message) {
        const timestamp = new Date().toISOString();
        console.log(`${this.colors.fg.cyan}[INFO] ${timestamp} - ${message}${this.colors.reset}`);
    }

    warn(message) {
        const timestamp = new Date().toISOString();
        console.warn(`${this.colors.fg.yellow}[WARN] ${timestamp} - ${message}${this.colors.reset}`);
    }

    error(message) {
        const timestamp = new Date().toISOString();
        console.error(`${this.colors.fg.red}[ERROR] ${timestamp} - ${message}${this.colors.reset}`);
    }

    success(message) {
        const timestamp = new Date().toISOString();
        console.log(`${this.colors.fg.green}[SUCCESS] ${timestamp} - ${message}${this.colors.reset}`);
    }

    debug(message) {
        if (process.env.DEBUG) {
            const timestamp = new Date().toISOString();
            console.log(`${this.colors.fg.magenta}[DEBUG] ${timestamp} - ${message}${this.colors.reset}`);
        }
    }

    // Add a method to format command output
    formatOutput(output) {
        if (!output) return '';
        return output.toString().trim();
    }

    // Add a method to handle command errors
    handleError(error, command) {
        this.error(`Command failed: ${command}`);
        this.error(`Error message: ${error.message}`);
        if (error.stderr) {
            this.error(`stderr: ${this.formatOutput(error.stderr)}`);
        }
        return error;
    }
}

CommandExecutor.toString = () => '[class CommandExecutor]';

export const commandExecutor = new CommandExecutor();
