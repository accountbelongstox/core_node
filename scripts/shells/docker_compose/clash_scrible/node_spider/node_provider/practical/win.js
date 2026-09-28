'use strict';
const fs = require('fs');
const os = require('os')
const path = require('path');
const regedit = require('regedit').promisified;
const { execSync, exec } = require('child_process');
let config = {};
const { file, tool, strtool, plattool } = require('../utils.js');
const { gdir } = require('../globalvars.js');

class Win {
    pathKey = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'
    install_queue = []
    userDataFile = 'userData.json';

    parsedArgs = null

    isWindows() {
        return os.platform() === 'win32';
    }

    kill(process = "chrome") {
        const cmd = `pkill ${process}`;
        return cmd;
    }

    isAppInLoginItems() {
        const settings = app.getLoginItemSettings()
        return settings.openAtLogin === true
    }

    checkAdmin(callback) {
        if (!this.isAdmin()) {
            console.error(`请以管理员模式运行,(右键:管理员运行.)`)
            setTimeout(() => {
                this.checkAdmin(callback)
            }, 3000)
        } else {
            if (callback) callback()
        }
    }
    async getPathEnv() {
        let listResult = await this.queryRegistry(this.pathKey)
        return listResult.values.Path.value
    }

    async setPathEnv(envs, callback) {
        if (typeof envs == 'string') {
            envs = [envs]
        }
        envs = envs.map(p => { return path.normalize(p).replace(/^[\/\\]+|[\/\\]+$/g, ''); })
        let pathEnv = await this.getPathEnv()
        let currentPath = pathEnv.split(';')
        currentPath = currentPath.map(p => {
            return path.normalize(p).replace(/^[\/\\]+|[\/\\]+$/g, '');
        })
        currentPath = currentPath.filter(val => { return val != '.' && val })
        let new_env = []
        let oriLen = currentPath.length
        for (let i = 0; i < envs.length; i++) {
            if (!currentPath.includes(envs[i])) {
                new_env.push(envs[i]);
            }
        }
        if (new_env.length == 0) {
            //没有新的变量，直接结束，无需设置
            console.log(`没有新的变量，直接结束，无需设置`)
            return
        }
        // let indexToSplit = tool.array_lastchat(currentPath, "c:") + 1
        // let firstPart = currentPath.slice(0, indexToSplit);
        // let secondPart = currentPath.slice(indexToSplit);

        let default_version = []

        let default_python = strtool.getDefault(config.default_python, '3.10');
        let default_java = strtool.getDefault(config.default_java, '9');
        let default_node = strtool.getDefault(config.default_node, '18');

        default_python = default_python.replace(/\./g, '')
        default_java = default_java.replace(/\./g, '')
        default_node = default_node.replace(/\./g, '')

        default_version.push(`python` + default_python)
        default_version.push(`java` + default_java)
        default_version.push(`node-v` + default_node)
        default_version.push(`node` + default_node)

        new_env = tool.array_priority(new_env, default_version)

        currentPath = [...currentPath, ...new_env];
        console.log(`set evn : ${currentPath}`)

        if (oriLen != currentPath.length) {
            let pathString = currentPath.join(';')
            let regValue = {
                Path: {
                    'type': 'REG_SZ',
                    'value': pathString,
                }
            }
            this.setRegistry(this.pathKey, regValue, (listResult) => {
                if (callback) callback(listResult)
            })
        }
    }

    getDefaultEnvVersion() {
        let default_version = []

        let default_python = strtool.getDefault(config.default_python, '3.10');
        let default_java = strtool.getDefault(config.default_java, '9');
        let default_node = strtool.getDefault(config.default_node, '18');
        let local_envdir = config.local_envdir

        default_python = default_python.replace(/\./g, '')
        default_java = default_java.replace(/\./g, '')
        default_node = default_node.replace(/\./g, '')

        default_version.push(`python` + default_python)
        default_version.push(`java` + default_java)
        default_version.push(`node-v` + default_node)
        default_version.push(`node` + default_node)

        let envs = file.scanDir(local_envdir)
        let evn = {}

        envs.forEach((env) => {
            env = path.basename(env)
            if (env != '.tmp') {
                let env_low = env.toLowerCase()
                let env_name = env_low.match(/^[a-zA-Z]*/)[0];
                if (!evn[env_name]) {
                    evn[env_name] = env
                }
                default_version.forEach(version => {
                    if (env_low.startsWith(version)) {
                        evn[env_name] = env
                    }
                })
            }
        })

        return evn
    }

    async queryRegistry(regKey) {
        const listResult = await regedit.list(regKey)
        if (listResult[regKey]) {
            return listResult[regKey]
        }
        return null
    }

    setRegistry(regKey, value, callback) {
        let regValue = {}
        regValue[regKey] = value
        regedit.putValue(regValue).then((listResult) => {
            if (callback) callback(listResult)
        }).catch(e => { })
    }

    getWindowsVersion() {
        const release = os.release();
        const majorVersion = parseInt(release.split('.')[0]);
        return majorVersion
    }

    getUnusedDrives() {
        try {
            const stdout = execSync('wmic logicaldisk get name').toString();
            const usedDrives = stdout.match(/[A-Z]:/g) || [];
            const allDrives = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => `${letter}:`);
            const unusedDrives = allDrives.filter(drive => !usedDrives.includes(drive));
            return unusedDrives;
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    }
    exec_explorer(file_path, group, default_config, callback) {
        file_path = path.normalize(file_path)
        if (!fs.existsSync(file_path)) {
            if (group && default_config) file_path = path.join(default_config.icon_dir, group)
        }
        let cmd = `explorer "${file_path}"`
        console.log(cmd)
        tool.exeBySpawn(cmd, (err, std) => {
            if (callback) callback(err, std)
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
            result = await plattool.execCommand(cmd, true);
        }
        if (callback) {
            callback(result);
        }
    }
    runAsAdminByGSudo(file_path, group, default_config, pare = '', callback) {
        console.log(`file_path`, file_path)
        file_path = path.normalize(file_path)
        let cmd
        let runmode = `explorer`
        if (!fs.existsSync(file_path)) {
            if (group && default_config) file_path = path.join(default_config.icon_dir, group)
            cmd = `explorer "${file_path}"`
        } else {
            if (file.isExecutable(file_path)) {
                let gsudo = gdir.getLibraryByWin32Dir(`gsudo.portable/gsudo.exe`)
                gsudo = path.normalize(gsudo)
                let current_user = os.userInfo().username;
                if (pare) {
                    pare = ` ` + pare
                }
                cmd = `${gsudo} -u ${current_user} "${file_path}"${pare}`
                runmode = `admin`
            } else {
                cmd = `explorer "${file_path}"${pare}`
            }
        }

        console.log(`cmd`, cmd)
        plattool.execCommand(cmd, true, null, null, (err, std) => {
            let rData = {
                runmode,
                err,
                std
            }
            if (callback) callback(rData)
        }, 3000);
    }

    isHyperVEnabled(callback) {
        tool.exec_cmd('dism /online /get-featureinfo /featurename:Microsoft-Hyper-V', (stdout, error, stderr) => {
            const isEnabled = stdout.includes('State : Enabled');
            callback(isEnabled);
        })
    }

    // 启用Hyper-V
    enableHyperV(callback) {
        exec('dism /online /enable-feature /featurename:Microsoft-Hyper-V /all', (error, stdout, stderr) => {
            if (error) {
                callback(null, error,);
                return;
            }
            const wasSuccessful = stdout.includes('successfully');
            callback(wasSuccessful, null);
        });
    }

    installOrUpdateWSL2(callback) {
        this.isWSL2Enabled((isWSL2, error) => {
            if (error) {
                callback(error);
                return;
            }

            if (isWSL2) {
                console.log("WSL2 is already enabled. Trying to upgrade any WSL1 distributions.");
                this.upgradeWSL1Distributions(callback);
            } else {
                console.log("WSL2 is not enabled. Starting installation process.");
                // TODO: Add the installation steps here.
                // For example, using exec to run installation commands.
            }
        });
    }



    checkVersionByTail(inputText, version) {
        const lines = inputText.split(/[\n\r]+/);
        console.log(lines)
        for (let line of lines) {
            line = line.replaceAll(/\s+$/g, ``)
            if (line.endsWith(version)) {
                return true;
            }
        }
        return false;
    }

    getWslDistributes(callback) {
        let cmd = 'wsl -l --quiet'
        tool.exec_cmd(cmd, (stdout, error) => {
            stdout = strtool.trim(stdout)
            let distros = stdout.split(/\s+/)
            distros = distros.map(str => str.replace(/\x00/g, "")).filter(str => str != "");
            callback(distros);
        })
    }

    isWSL2Enabled(callback) {
        tool.exec_cmd('wsl --status', (stdout, error) => {
            const hasWSL2 = this.checkVersionByTail(stdout, `2`)
            callback(hasWSL2, error);
        })
    }

    upgradeWSL1Distributions(callback) {
        exec('wsl --list --verbose', (error, stdout) => {
            if (error) {
                callback(error);
                return;
            }

            const wsl1Distributions = stdout.split('\n')
                .filter(line => line.includes(' 1 '))
                .map(line => line.trim().split(' ')[0]);

            if (wsl1Distributions.length === 0) {
                console.log("No WSL1 distributions found.");
                callback(null);
                return;
            }

            wsl1Distributions.forEach(dist => {
                console.log(`Upgrading ${dist} to WSL2.`);
                exec(`wsl --set-default-version  2`, (err) => {
                    if (err) {
                        callback(err);
                    } else {
                        console.log(`${dist} has been upgraded to WSL2.`);
                        callback(null);
                    }
                });
            });
        });
    }

    async isVisualStudio(callback) {
        let vs
        try {
            vs = await this.queryRegistry("HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\VisualStudio\\SxS\\VS7")
        } catch (e) {
            vs = null
        }
        if (callback) callback(vs)
    }

    async killProcessByPort(port) {
        return new Promise((resolve, reject) => {
            const netstatCommand = `netstat -ano | findstr :${port}`;
            exec(netstatCommand, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                const lines = stdout.trim().split('\n');
                const pidRegex = /(\d+)$/; // Regular expression to match PID at the end of each line
                const pids = lines.map(line => {
                    const match = line.match(pidRegex);
                    return match ? match[1] : null;
                }).filter(pid => pid); // Filter out null values

                if (pids.length === 0) {
                    resolve(`No processes found using port ${port}`);
                    return;
                }

                const forceOption = pids.length > 1 ? '/F' : '';
                const taskkillCommand = `taskkill ${forceOption} /PID ${pids.join(' /PID ')}`;
                exec(taskkillCommand, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(stdout.trim());
                });
            });
        });
    }
}

Win.toString = () => '[class Win Api]';
module.exports = new Win();

