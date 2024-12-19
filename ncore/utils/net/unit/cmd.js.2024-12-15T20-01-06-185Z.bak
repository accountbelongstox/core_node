import { exec, spawn } from 'child_process';
import Base from '#@base';

class Commander extends Base {
    constructor() {
        super();
        this.currentDir = process.cwd(); 
    }

    async execCommand(command, info = true, cwd = null) {
        if (info) {
            this.info(command);
        }
        return new Promise((resolve, reject) => {
            const options = {};
            if (cwd) {
                options.cwd = cwd;
            }

            exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    resolve(this.wrapCmdResult(false, stdout, stderr, error.code, info)); // Corrected method name wrapEmdResult to wrapCmdResult
                } else {
                    if (stderr) {
                        console.warn(`exec stderr: ${stderr}`);
                        resolve(this.wrapCmdResult(true, stdout, stderr, 0, info));
                    } else {
                        resolve(this.wrapCmdResult(true, stdout, null, 0, info));
                    }
                }
            });
        });
    }

    async spawnSync(command, info = true, cwd = null, logname = null) {
        let cmd = '';
        let args = [];
        command = command.split(/\s+/);
        if (Array.isArray(command)) {
            cmd = command[0];
            args = command.slice(1);
        } else {
            cmd = command;
        }
        if (info) {
            this.info(command.join(' ')); // Corrected this.info(command) to this.info(command.join(' '))
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
                    resolve(this.wrapCmdResult(true, stdoutData, null, 0, info));
                } else {
                    resolve(this.wrapCmdResult(false, stdoutData, stderrData, code, info));
                }
            });
            childProcess.on('error', (err) => {
                process.chdir(this.currentDir);
                resolve(this.wrapCmdResult(false, stdoutData, err, -1, info));
            });
        });
    }

    wrapCmdResult(success = true, stdout = '', error = null, code = 0, info = true) {
        if (info) {
            this.info(this.byteToStr(stdout));
            this.warn(this.byteToStr(error));
        }
        return { success, stdout, error, code };
    }

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
}

export default new Commander();
