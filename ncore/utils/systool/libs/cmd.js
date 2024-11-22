const { execSync, spawn, exec, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const Base = require('#@base');
const readline = require('readline');

class CommandExecutor extends Base {
    constructor() {
        super();
        this.initialWorkingDirectory = this.getCwd();
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

    byteToStr(astr) {
        try {
            astr = astr.toString('utf-8');
            return astr;
        } catch (e) {
            astr = String(astr);
            const isByte = /^b\'{0,1}/;
            if (isByte.test(astr)) {
                astr = astr.replace(/^b\'{0,1}/, '').replace(/\'{0,1}$/, '');
            }
            return astr;
        }
    }

}


CommandExecutor.toString = () => '[class CommandExecutor]';



Plattools.toString = () => '[class Plattools]';

module.exports = { Plattools: new Plattools(), CommandExecutor: new CommandExecutor() };
