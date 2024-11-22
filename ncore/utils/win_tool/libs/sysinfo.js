

'use strict';
const fs = require('fs');
const os = require('os')
const path = require('path');
const regedit = require('regedit').promisified;
const { execSync, exec } = require('child_process');
let config = {};
const { file, tool, strtool } = require('../../../utils.js');

class Win {
    pathKey = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'
    install_queue = []
    userDataFile = 'userData.json';

    parsedArgs = null

    


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

    
    getWindowsVersion() {
        const release = os.release();
        const majorVersion = parseInt(release.split('.')[0]);
        return majorVersion
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
}

Win.toString = () => '[class Win Api]';
module.exports = new Win();

