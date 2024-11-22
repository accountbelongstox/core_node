const { execSync, spawn, exec, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const Base = require('../provider/base/base.js');

class Plattools extends Base {
    constructor() {
        super();
        this.initialWorkingDirectory = process.cwd();
        this.currentDir = process.cwd();
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

    async runAsAdmin(file_path, callback) {
        file_path = path.normalize(file_path);
        let cmd;
        let result;
        if (!fs.existsSync(file_path)) {
            const baseDir = path.dirname(file_path);
            cmd = `explorer "${baseDir}"`;
            result = { error: 'Executable file does not exist. Opening the parent directory of the executable file.' };
            console.error(result.error);
        } else {
            cmd = `explorer "${file_path}"`;
            result = await this.execCommand(cmd, true);
        }
        if (callback) {
            callback(result);
        }
    }

    async execCmdSync(command, info = true, cwd = null, logname = null) {
        return await this.execCommand(command, info, cwd, logname)
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

    async spawnAsync(command, info = true, cwd = null, logname = null, callback, timeout = 5000) {
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
            childProcess = this.isLinux()
                ? spawn('/bin/bash', ['-c', cmd].concat(args), options)
                : spawn(cmd, args, options);
            let stdoutData = '';
            let stderrData = '';
            const resetTimer = () => {
                if (timer !== null) {
                    clearTimeout(timer);
                }
                timer = setTimeout(() => {
                    if (!callbackExecuted) {
                        callback(this.wrapEmdResult(true, stdoutData, null, 0, info));
                        callbackExecuted = true;
                        // childProcess.kill(); 
                    }
                }, timeout);
            };
            childProcess.stdout.on('data', (data) => {
                resetTimer();
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
                resetTimer();
                const error = this.byteToStr(data);
                if (info) {
                    this.warn(error);
                }
                stderrData += error + '\n';
            });
            childProcess.on('close', (code) => {
                console.log(`childProcess-close`)
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

    async execByExplorer(command, info = false, cwd = null) {
        let cmd;
        const parsedPath = path.parse(command);

        if (parsedPath.root !== '' && parsedPath.dir !== '') {
            // 如果是文件路径，则在命令中加入双引号
            cmd = `explorer "${command}"`;
        } else {
            cmd = `explorer ${command}`;
        }

        return await this.spawnAsync(cmd, info, cwd);
    }

    async execByCommand(command, info = false, cwd = null) {
        const cmd = `cmd /c ${command}`;
        return await this.spawnAsync(cmd, info, cwd);
    }

    isCommand(command) {
        try {
            const result = this.isWindows()
                ? execSync(`where ${command}`, { stdio: 'ignore' })
                : execSync(`which ${command}`, { stdio: 'ignore' });
            return result === 0;
        } catch (e) {
            return false;
        }
    }

    isWsl() {
        try {
            const output = execSync('uname -a').toString().toLowerCase();
            return output.includes('microsoft') || output.includes('wsl');
        } catch (error) {
            return false;
        }
    }

    isWindows() {
        return process.platform === 'win32';
    }

    isLinux() {
        return process.platform === 'linux';
    }

    isCentos() {
        return this.isLinux() && fs.readFileSync('/etc/os-release', 'utf-8').toLowerCase().includes('centos');
    }

    isUbuntu() {
        return this.isLinux() && fs.readFileSync('/etc/os-release', 'utf-8').toLowerCase().includes('ubuntu');
    }

    isDebian() {
        return this.isLinux() && fs.readFileSync('/etc/os-release', 'utf-8').toLowerCase().includes('debian');
    }

    installCommandBySystem(installCommand) {
        if (this.isWindows()) {
            console.log("Windows system detected. Installing with Chocolatey (choco) command.");
            this.installOnWindows(installCommand);
        } else if (this.isCentos()) {
            console.log("CentOS system detected. Installing with CentOS command.");
            this.installOnCentos(installCommand);
        } else if (this.isUbuntu()) {
            console.log("Ubuntu system detected. Installing with Ubuntu command.");
            this.installOnUbuntu(installCommand);
        } else if (this.isDebian()) {
            console.log("Debian system detected. Installing with Debian command.");
            this.installOnDebian(installCommand);
        } else {
            console.log("Unsupported system.");
        }
    }

    installOnWindows(installCommand) {
        try {
            execSync(`choco install ${installCommand}`, { stdio: 'inherit' });
            console.log("Installation successful with Chocolatey.");
        } catch (e) {
            console.error(`Error installing on Windows with Chocolatey: ${e}`);
        }
    }

    hasChocoInstalled() {
        try {
            execSync('choco --version', { stdio: 'ignore' });
            return true;
        } catch (e) {
            return false;
        }
    }

    installChoco() {
        console.log("Installing Chocolatey...");
        try {
            execSync("powershell -Command 'Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))'", { stdio: 'inherit' });
            console.log("Chocolatey installation successful.");
        } catch (e) {
            console.error(`Error installing Chocolatey: ${e}`);
        }
    }

    installOnCentos(installCommand) {
        try {
            execSync(`sudo yum install -y ${installCommand}`, { stdio: 'inherit' });
            console.log("Installation successful on CentOS.");
        } catch (e) {
            console.error(`Error installing on CentOS: ${e}`);
        }
    }

    installOnUbuntu(installCommand) {
        try {
            execSync(`sudo apt-get install -y ${installCommand}`, { stdio: 'inherit' });
            console.log("Installation successful on Ubuntu.");
        } catch (e) {
            console.error(`Error installing on Ubuntu: ${e}`);
        }
    }

    installOnDebian(installCommand) {
        try {
            execSync(`sudo apt-get install -y ${installCommand}`, { stdio: 'inherit' });
            console.log("Installation successful on Debian.");
        } catch (e) {
            console.error(`Error installing on Debian: ${e}`);
        }
    }

    isAdmin() {
        if (this.isWindows()) {
            try {
                return execSync("NET SESSION", { stdio: 'ignore' }) === 0;
            } catch (e) {
                return false;
            }
        }
        return false;
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

    reloadSystemctl() {
        const systemName = os.platform();
        if (systemName === "linux") {
            this.execCmd(["sudo", "systemctl", "daemon-reload"]);
        } else {
            console.log("Unsupported operating system");
        }
    }
}

Plattools.toString = () => '[class Plattools]';
module.exports = new Plattools();
