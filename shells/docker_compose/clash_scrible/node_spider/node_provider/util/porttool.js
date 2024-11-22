const { exec, spawn } = require('child_process');
const Base = require('../base/base.js');
const net = require('net');

class Porttool extends Base {
    constructor() {
        super();
        this.currentDir = process.cwd();
    }

    isWindows() {
        return process.platform === 'win32';
    }

    isLinux() {
        return process.platform === 'linux';
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
                ? spawn('/bin/bash', ['-c', cmd].concat(args), options)
                : spawn(cmd, args, options);

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
                process.chdir(this.currentDir);
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
                process.chdir(this.currentDir);
                resolve(
                    this.wrapEmdResult(false,
                        stdoutData,
                        err,
                        -1, info)
                );
            });
        });
    }

    async isPortInUse(port) {
        return new Promise(async (resolve, reject) => {
            const netstatCommand = `netstat -ano | findstr :${port}`;
            const result = await this.execCommand(netstatCommand)
            let stdout = result && result.stdout ? result.stdout : ``
            if (!stdout) {
                stdout = result && result.error ? result.error : ``
            }
            const lines = stdout.trim().split('\n').map(line => line.trim().replace(/\r/g, ''));
            let portLines = lines;
            let isPortUsed = false;
            for (let i = 0; i < portLines.length; i++) {
                const parts = portLines[i].split(/\s+/);
                let isIncludePort = false;
                let firstValue = parts[0];
                if (firstValue == "TCP") firstValue = parts[1];
                if (firstValue.endsWith(`:${port}`)) {
                    isIncludePort = true
                }
                const lastValue = parts[parts.length - 1];
                const usePid = parseInt(lastValue, 10)
                if (!isNaN(usePid) && usePid > 0) {
                    if (isIncludePort) {
                        if(!Array.isArray(isPortUsed)) {
                            isPortUsed = []
                        }
                        isPortUsed.push(usePid)
                    }
                }
            }
            resolve(isPortUsed);
        }).catch(error => {
            console.error("An error occurred while checking port:", error);
            return true;
        });
    }

    async killProcessByPort(port) {
        return new Promise(async (resolve, reject) => {
            let pids = await this.isPortInUse(port)
            if (pids) {
                const processesToKill = [];
                pids.forEach(pid => {
                    processesToKill.push({ pid, port });
                });
                const forceOption = processesToKill.length > 1 ? '/F' : '';
                const taskkillCommand = `taskkill ${forceOption} /PID ${pids}`;
                const stdout = await this.execCommand(taskkillCommand)
                resolve(stdout);
            }
        });
    }
    async checkPort(port) {
        return new Promise((resolve, reject) => {
            port = parseInt(port);
            const tester = net.createServer();
            tester.once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(true);
                } else {
                    reject(err);
                }
            });

            tester.once('listening', () => {
                tester.close(() => {
                    resolve(false);
                });
            });

            tester.listen(port, 'localhost');
        });
    }
    isPortTaken(port) {
        return new Promise((resolve, reject) => {
            const tester = net.createServer()
                .once('error', err => {
                    if (err.code !== 'EADDRINUSE') {
                        reject(err);
                        return;
                    }
                    resolve(true);
                })
                .once('listening', () => {
                    tester.once('close', () => {
                        resolve(false);
                    }).close();
                })
                .listen(port);
        });
    }
    wrapEmdResult(success = true, stdout = '', error = null, code = 0, info = true) {
        if (info) {
            this.info(this.byteToStr(stdout))
            this.warn(this.byteToStr(error))
        }
        return {
            success,
            stdout,
            error,
            code
        }
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

Porttool.toString = () => '[class Porttool]';
module.exports = new Porttool();
