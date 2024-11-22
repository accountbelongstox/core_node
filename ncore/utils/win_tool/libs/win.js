'use strict';
const fs = require('fs');
const os = require('os')
const path = require('path');
const regedit = require('regedit').promisified;
const { execSync, exec } = require('child_process');
let config = {};
const { file, tool, strtool, plattool } = require('../../../utils.js');
const { gdir } = require('../../../globalvars.js');
const { Shell } = require('node-windows');
// const windows_shortcuts = require('windows-shortcuts');

class Win {
    pathKey = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'
    install_queue = []
    userDataFile = 'userData.json';

    parsedArgs = null

    async createShortcut(name, exePath, iconPath = exePath) {
        const desktopPath = path.join(os.homedir(), 'Desktop');
        const shortcutPath = path.join(desktopPath, `${name}.lnk`);

        if (await this.fileExists(shortcutPath)) {
            console.log(`Shortcut "${name}" already exists. Removing it before creating a new one.`);
            await this.deleteFile(shortcutPath);
        }

        try {
            const shell = new Shell();
            await shell.createShortcut({
                target: exePath,
                workingDirectory: path.dirname(exePath),
                description: name,
                icon: iconPath,
                hotkey: '',
                args: '',
                desktop: true,
                filename: name
            });
            console.log(`Shortcut "${name}" created successfully.`);
        } catch (error) {
            console.error(`Failed to create shortcut "${name}":`, error);
        }
    }

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


    checkVersionByTail(inputText, version) {
        const lines = inputText.split(/[\n\r]+/);
        for (let line of lines) {
            line = line.replaceAll(/\s+$/g, ``)
            if (line.endsWith(version)) {
                return true;
            }
        }
        return false;
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

