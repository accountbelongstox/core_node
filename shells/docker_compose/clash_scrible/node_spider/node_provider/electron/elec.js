'use strict';
const fs = require('fs');
const os = require('os')
const path = require('path');
const { app, protocol } = require('electron');
const { execSync, exec } = require('child_process');
const { file, } = require('../utils.js');
const log = require('../util/log.js');

class ElectronInstance {
    userDataFile = 'userData.json';

    getASARDir() {
        return app.getAppPath()
    }

    getRootDir() {
        let buildRootDir = file.getElectronRootByBuild()
        if (!buildRootDir) {
            buildRootDir = app.getAppPath();
        }
        return buildRootDir
    }

    getMainExe(callback) {
        let rootDir = this.getRootDir()
        fs.readdir(rootDir, (err, files) => {
            if (err) {
                console.error('Error reading directory:', err);
                if (callback) callback([])
                return
            }
            const exeFiles = files.filter(file => path.extname(file).toLowerCase() === '.exe');
            if (callback) callback(exeFiles)
        });
    }

    setstartup() {
        this.getMainExe((apps) => {
            if (apps.length) {
                let app = apps.pop();
                const updateExe = path.resolve(path.join(this.getRootDir(), app));
                try {
                    app.setLoginItemSettings({
                        openAtLogin: true,
                        openAsHidden: true,
                        path: updateExe,
                    });
                } catch (e) {
                    console.error('Error setting login item:' + e);
                }
            }
        })
    }

    LogginError(save = true) {
        if (save) {
            const rootDir = this.getRootDir()
            log.initLog(path.join(rootDir, 'error.log'))
            // protocol.registerSchemesAsPrivileged([{
            //     scheme: 'demoapp',
            //     privileges: {
            //         secure: true,
            //         standard: true
            //     }
            // }])
            process.on('uncaughtException', (err) => {
                log.error('Uncaught Exception:' + err)
            });
            process.on('unhandledRejection', (reason, promise) => {
                reason = reason.toString()
                if (reason.includes("An object could not be cloned")) {
                    return
                }
                log.error('Promise ' + reason)
                log.error('Error ' + promise)
            });
        }
    }

    getUserDir(dir) {
        let homedir = os.homedir()
        if (dir) {
            homedir = path.join(homedir, dir)
        }
        file.mkbasedir(homedir)
        return homedir
    }

    getPrivateUserDir(dir) {
        let private_dir = this.getUserDir('.desktop_icons')
        if (dir) {
            private_dir = path.join(private_dir, dir)
        }
        file.mkbasedir(private_dir)
        return private_dir
    }

    getPath(name, dir) {
        //getPath(name: 'home' | 'appData' | 'userData' | 'sessionData' | 'temp' | 'exe' | 'module' | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | 'recent' | 'logs' | 'crashDumps'): string;
        let homedir = app.getPath(name);
        if (dir) {
            homedir = path.join(homedir, dir)
            if (!file.isDir(homedir)) file.mkdir(homedir)
        }
        return homedir
    }

    getDesktopDir(dir) {
        return this.getPath('desktop', dir);
    }

    getUserDataDir(dir) {
        return this.getPath('userData', dir);
    }

    getAppDataDir(dir) {
        return this.getPath('appData', dir);
    }

    getDownloadsDir(dir) {
        return this.getPath('downloads', dir);
    }

    getDocumentsDir(dir) {
        return this.getPath('documents', dir);
    }

    getTempDir(dir) {
        return this.getPath('temp', dir);
    }

    processesCount(processe_name) {
        let cmd;
        const normalizedProcessName = processe_name.toLowerCase();
        if (os.platform() === 'win32') {
            cmd = 'tasklist';
        } else {
            cmd = 'ps aux';
        }
        try {
            const stdout = execSync(cmd, { encoding: 'utf8' });
            const count = stdout.split('\n').filter(line => line.toLowerCase().includes(normalizedProcessName)).length;
            return count;
        } catch (err) {
            console.error('Error executing command:', err);
            return 10000;
        }
    }

    isProcessesRun(processe_name) {
        let count = this.isProcessesRun(processe_name)
        if (count > 0 && count != 10000) {
            return true
        } else {
            return false
        }
    }

    saveUserData(key, val) {
        let data_dir = this.getPrivateUserDir(this.userDataFile)
        let data = file.readJSON(data_dir)
        data[key] = val;
        file.saveJSON(data_dir, data)
    }

    setUserData(key, val) {
        this.saveUserData(key, val)
    }

    getUserData(key) {
        let data_dir = this.getPrivateUserDir(this.userDataFile)
        let data = file.readJSON(data_dir)
        if (key) return data[key]
        return data;
    }

    hasUserData(key) {
        return key in this.getUserData()
    }

    hasAndSetUserData(key, val) {
        let has = this.hasUserData(key)
        if (val === undefined) {
            val = true
        }
        this.saveUserData(key, val)
        return has
    }

    hasAndAddListUserData(key, val) {
        let arr = this.getUserData(key)
        if (!arr) {
            arr = []
        }
        let has = false
        if (val != undefined) {
            has = arr.includes(val)
            if (!has) {
                arr.push(val)
            }
        }
        this.saveUserData(key, arr)
        return has
    }

    hasListUserData(key, val) {
        let arr = this.getUserData(key)
        if (!arr || !val) {
            return false
        }
        return arr.includes(val)
    }

    addListUserData(key, val) {
        let arr = this.getUserData(key)
        if (!arr) {
            arr = []
        }
        if (val != undefined) {
            if (!arr.includes(val)) {
                arr.push(val)
                this.saveUserData(key, arr)
            }
        }
    }
}

ElectronInstance.toString = () => '[class ElectronInstance]';
module.exports = new ElectronInstance();

