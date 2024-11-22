const path = require('path');
const { plattool, strtool } = require('../utils.js');
const Base = require('#@base');

class Winget extends Base {
    taskQueue = {}
    isQueueRunning = false;

    constructor() {
        super();
    }

    addQueue(software) {
        if (!software || typeof software !== 'object') {
            console.error('Invalid software object.');
            return;
        }
        if (!software.hasOwnProperty('aid')) {
            console.error('Software object must have a aid property.');
            return;
        }
        const { aid } = software;
        if (aid in this.taskQueue) {
            console.warn(`${aid} is already in the installation queue.`);
            return;
        }
        this.taskQueue[aid] = software;
        if (!this.isQueueRunning) {
            this.popQueue();
        }
    }

    popQueue() {
        const queueLength = Object.keys(this.taskQueue).length;
        if (queueLength > 0) {
            const keys = Object.keys(this.taskQueue);
            const firstKey = keys[0];
            const software = this.taskQueue[firstKey];
            delete this.taskQueue[firstKey];
            const basename = software.basename;
            this.installSoftware(software, true, () => {
                this.popQueue()
            })
        } else {
            this.isQueueRunning = false
        }
    }

    installSoftware(software, silent = true, callback) {
        const appDir = software.appDir;
        const basename = software.basename;
        const winget_id = software.winget_id;
        const progressCallback = software.progressCallback;
        let installDir = path.join(appDir, basename);
        let command = `winget install --id "${winget_id}"`;
        if (silent) {
            command += ` --accept-package-agreements --location "${installDir}" --silent`;
        }
        console.log(command,`command`)
        plattool.execCommand(command)
            .then((result) => {
                console.log(`Software ${winget_id} installed successfully.`);
                if (progressCallback) {
                    progressCallback(100, result);
                }
                if (callback) callback()
            })
            .catch((err) => {
                console.error(`Failed to install software ${winget_id}: ${err}`);
                if (progressCallback) {
                    progressCallback(-1, err);
                }
                if (callback) callback()
            });
    }

    async isInstalled(software, callback) {
        let winget_id;
        if (typeof software !== 'string') {
            winget_id = software.winget_id;
        } else {
            winget_id = software;
        }

        try {
            const stdout = await plattool.execCommand('winget list');
            const isExists = stdout.includes(winget_id);
            if (callback) {
                callback(null, isExists);
            }
            return isExists;
        } catch (err) {
            console.error(`Error checking if software ${winget_id} is installed: ${err}`);
            if (callback) {
                callback(err);
            }
            return false;
        }
    }

    parseInstalledSoftwareList(output) {
        const lines = output.split('\n').filter(line => line.trim() !== '');
        const installedSoftware = lines.map(line => {
            const parts = line.split('\t');
            return {
                name: parts[0].trim(),
                id: parts[1].trim()
            };
        });
        return installedSoftware;
    }

    async getInstalledList(callback) {
        try {
            const stdout = await plattool.execCommand('winget list');
            const installedSoftware = this.parseInstalledSoftwareList(stdout);
            if (callback) {
                callback(null, installedSoftware);
            }
            return installedSoftware;
        } catch (err) {
            console.error(`Error getting installed software list: ${err}`);
            if (callback) {
                callback(err);
            }
            return [];
        }
    }

    async searchSoftware(query, callback) {
        try {
            const stdout = await plattool.execCommand(`winget search "${query}"`);
            const softwareList = this.parseSearchResults(stdout);
            if (callback) {
                callback(null, softwareList);
            }
            return softwareList;
        } catch (err) {
            console.error(`Error searching for software with query "${query}": ${err}`);
            if (callback) {
                callback(err);
            }
            return [];
        }
    }

    parseSearchResults(output) {
        const lines = output.split('\n').filter(line => line.trim() !== '');
        const softwareList = lines.map(line => {
            const parts = line.split('\t');
            return {
                name: parts[0].trim(),
                id: parts[1].trim()
            };
        });
        return softwareList;
    }

    createInstallIconChart(aid, src, percent, w, h,) {
        if (!w) w = config_base.icon_width
        if (!h) h = config_base.icon_height
        let cw = w
        let ch = h
        let r = 100
        let cx = 100
        let cy = 100
        let imgId = strtool.create_id(src)
        let html = `
        <div id="install_${imgId}">
            <figure id="selft-pie2" style="position:relative;width:${w}px;height:${h}px;"><svg xmlns:svg="http://www.w3.org/2000/svg"
                    xmlns="http://www.w3.org/2000/svg"
                    style="width:100%;height:100%;-webkit-transform: rotate(-90deg);transform: rotate(-90deg);overflow:visible;">
                    <circle r="${r}" cx="${cx}" cy="${cy}" style="fill:rgb(26, 188, 156,0);"></circle>
                    <circle r="50.5" cx="100" cy="100"
                        style="fill: rgba(26, 188, 156, 0); stroke: url(&quot;#${imgId}&quot;); stroke-width:${cw}px; stroke-dasharray: ${percent}px, 316.673px;">
                    </circle>
                </svg>
            </figure>
            <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                <defs>
                    <pattern id="${imgId}" x="0" y="0" width="1" height="1" viewBox="0 0 100 100"
                        preserveAspectRatio="xMidYMid slice">
                        <image width="100" height="100" xlink:href="${src}"></image>
                    </pattern>
                </defs>
                <!-- 使用模式填充圆形 -->
                <circle cx="100" style="display: none;" cy="100" r="50" fill="url(#${imgId})"></circle>
            </svg>
        </div>
        `
        htmlWidget.addHTMLToInnerAfter(`.aid_container_${aid}`, html)
    }

}

module.exports = new Winget()

