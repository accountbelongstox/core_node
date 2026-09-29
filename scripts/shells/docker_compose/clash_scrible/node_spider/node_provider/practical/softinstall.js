'use strict';
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const fetch = require('node-fetch');
const child_process = require('child_process');
const { gdir } = require('../globalvars.js');
const Base = require('../base/base.js');
const { httptool, zip, file, plattool } = require('../utils.js');

class Softinstall extends Base {
    installQueue = {}
    isQueueRunning = false;
    installation_socket_event_name = `installer`

    constructor() {
        super();
    }

    addInstallQueue(software) {
        if (!software || typeof software !== 'object') {
            console.error('Invalid software object.');
            return;
        }

        if (!software.hasOwnProperty('basename')) {
            console.error('Software object must have a basename property.');
            return;
        }

        const { basename } = software;

        if (basename in this.installQueue) {
            console.warn(`${basename} is already in the installation queue.`);
            return;
        }

        this.installQueue[basename] = software;

        httptool.eggSocket(this.installation_socket_event_name, {
            type: 'add',
            message: `Added ${basename} to the installation queue`,
            progress: 0,
            basename,
            aid: software.aid,
        });

        if (!this.isQueueRunning) {
            this.popInstallQueue();
        }
    }

    popInstallQueue() {
        const queueLength = Object.keys(this.installQueue).length;
        if (queueLength > 0) {
            const keys = Object.keys(this.installQueue);
            const firstKey = keys[0];
            const software = this.installQueue[firstKey];
            delete this.installQueue[firstKey];
            const basename = software.basename;
            httptool.eggSocket(this.installation_socket_event_name, {
                type: 'pop',
                installMessage: `Installing ${software.basename}`,
                progress: 1,
                basename,
                aid: software.aid,
            });
            this.installSoftware(software, (installingProgress, installMessage) => {
                installMessage = installMessage ? installMessage : `Installing ${software.basename}`
                httptool.eggSocket(this.installation_socket_event_name, {
                    type: 'progress',
                    installMessage,
                    installingProgress,
                    ...software
                });
            }
                ,
                () => {
                    software.isExist = file.isFile(software.target);
                    httptool.eggSocket(this.installation_socket_event_name, {
                        type: 'done',
                        installMessage: `Installed ${software.basename}`,
                        installingProgress: 100,
                        ...software
                    });
                    this.popInstallQueue()
                });
        } else {
            this.isQueueRunning = false
        }
    }

    compareJSON(objA, objB) {
        if (typeof objA !== 'object' || typeof objB !== 'object') {
            return false;
        }
        const keysA = Object.keys(objA);
        const keysB = Object.keys(objB);
        if (keysA.length !== keysB.length) {
            return false;
        }
        for (const key of keysA) {
            if (typeof objA[key] === 'object' && typeof objB[key] === 'object') {
                if (!this.compareJSON(objA[key], objB[key])) {
                    return false;
                }
            } else if (objA[key] !== objB[key]) {
                return false;
            }
        }
        return true;
    }

    parseSoftwareGroups(mergedSoftwareGroups) {
        const parsedSoftwareGroups = {};
        for (const groupName in mergedSoftwareGroups) {
            const group = mergedSoftwareGroups[groupName];
            parsedSoftwareGroups[groupName] = {};
            for (const softwareName in group) {
                const softwareObject = group[softwareName];
                if (softwareObject.basename && softwareObject.target) {
                    parsedSoftwareGroups[groupName][softwareName] = softwareObject;
                    const targetPath = softwareObject.target;
                    if (fs.existsSync(targetPath)) {
                        softwareObject.localFileExists = true;
                    } else {
                        softwareObject.localFileExists = false;
                    }
                }
            }
        }
        return parsedSoftwareGroups;
    }

    async installationRulesBefore(software, progressCallback, callback) {
        const appDir = software.appDir;
        const target = software.target;
        const mainDir = file.getLevelPath(target, 2);
        const mainDirLow = mainDir.toLowerCase();

        // if (mainDir.startsWith('Adobe')) {
        //     const message = `The installation path is not allowed to be in the C:\\Program Files directory.`
        //     console.log(message)
        //     if (progressCallback) progressCallback(-1, message)
        //     if (callback) callback()
        //     return
        // }
                  
        if (mainDirLow.startsWith('avast')) {
            const links = [
                [gdir.getUserProfileDir('AppData/Local/AVAST Software'), 'AVAST Software'],
                ['C:/Program Files (x86)/AVAST Software', 'AVAST Software'],
            ]
            this.linkToDirs(links, appDir,false)
        }else if (mainDirLow.startsWith('discord')) {
            const links = [
                [gdir.getUserProfileDir('AppData/Local/Discord'), 'Discord'],
            ]
            this.linkToDirs(links, appDir,false)
        }else if (mainDirLow.startsWith('Adobe')) {
            const links = [
                ['C:/Program Files (x86)/Adobe', 'Adobe(x86)'],
                ['C:/Program Files/Adobe', 'Adobe'],
                ['C:/ProgramData/Adobe', 'Adobe_ProgramData'],
            ]
            this.linkToDirs(links, appDir,false)
        }
        else if (mainDirLow.startsWith('bravesoftware')) {
            const links = [
                ['C:/Program Files/BraveSoftware', 'BraveSoftware'],
            ]
            this.linkToDirs(links, appDir,false)
        }
        else if (mainDirLow.startsWith('avg')) {
            const links = [
                [gdir.getUserProfileDir('AppData/Local/AVG'), 'AVG'],
            ]
            this.linkToDirs(links, appDir,false)
        }
        else if (mainDirLow.startsWith('google')) {
            const links = [
                [gdir.getUserProfileDir('AppData/Local/Google'), 'Google'],
                ['C:/Program Files/Google', 'Google'],
                ['C:/Program Files (x86)/Google', 'Google/x86'],
            ]
            this.linkToDirs(links, appDir,false)
        }
        else if (mainDirLow.startsWith('microsoft visual studio')) {
            const links = [
                ['C:/CocosDashboard', 'CocosDashboard'],
                ['C:/Program Files (x86)/Microsoft Visual Studio', 'MicrosoftVisualStudio_x86Dir'],
                ['C:/Program Files/Microsoft Visual Studio', 'MicrosoftVisualStudio'],
                ['C:/Program Files (x86)/Unity Hub', 'UnityHub_x86Dir'],
                ['C:/Program Files/Unity Hub', 'UnityHub'],
                ['C:/Program Files (x86)/Epic Games', 'EpicGames_x86Dir'],
                ['C:/Program Files/Epic Games', 'EpicGames'],
                ['C:/Program Files (x86)/Xamarin', 'Xamarin_x86Dir'],
                ['C:/Program Files/Xamarin', 'Xamarin'],
                ['C:/Program Files (x86)/Microsoft SDKs', 'MicrosoftSDKs_x86Dir'],
                ['C:/Program Files/Microsoft SDKs', 'MicrosoftSDKs'],
                ['C:/Program Files (x86)/Microsoft SQL Server', 'MicrosoftSQLServer_x86Dir'],
                ['C:/Program Files/Microsoft SQL Server', 'MicrosoftSQLServer'],
                ['C:/Program Files (x86)/dotnet', 'dotnet_x86Dir'],
                ['C:/Program Files/dotnet', 'dotnet'],
                ['C:/Program Files (x86)/Android', 'Android_x86Dir'],
                ['C:/Program Files/Android', 'Android'],
                ['C:/ProgramData/Microsoft/VisualStudio', 'VisualStudio_ProgramData'],
                ['C:/ProgramData/Epic', 'Epic_ProgramData'],
                ['C:/ProgramData/Microsoft Visual Studio', 'MicrosoftVisualStudio_ProgramData']
            ]
            this.linkToDirs(links, appDir)
        }
    }

    linkToDirs(links, appDir,force=true) {
        try {
            links.forEach(link => {
                const [targetPath, src] = link;
                let sourcePath = src
                if (!file.isAbsolute(src)) {
                    sourcePath = path.join(appDir, src);
                }
                file.symlinkSync(sourcePath, targetPath,force);
                console.log(`Symbolic link created from ${sourcePath} to ${targetPath}`);
            });
        } catch (error) {
            console.error('Error creating symbolic link:', error);
        }
    }

    async installSoftware(software, progressCallback, callback) {
        const installDir = software.appDir;
        const basename = software.basename;
        const target = software.target;
        const mainDir = file.getLevelPath(target, 2);
        const source_local = software.source_local;
        const applications = 'softlist/static_src/applications/';
        const software_library = 'softlist/static_src/software_library/';
        const installProgress = { value: 0 };
        const download = gdir.getCustomTempDir('Downloads');
        this.installationRulesBefore(software, progressCallback)

        if (software.winget_id) {
            const installCommand = `winget install --id ${software.winget_id} --location "${installDir}"`;
            child_process.exec(installCommand);
        } else if (software.install_type === 'installer') {
            const installPath = path.join(installDir, basename);
            if (!fs.existsSync(installPath)) {
                const fileUrl = gdir.getLocalStaticApiUrl(`${software_library}/${source_local}.exe`);
                const localFilePath = await httptool.downloadFile(fileUrl, progressCallback);
                zip.putUnZipTask(localFilePath, installDir, progressCallback);
            }
        } else if (software.source_local || typeof software.source_local === 'string') {

            let installer = false
            const destDir = path.join(download, software.source_local);
            if (software.source_local === 'installer') {
                installer = true
            }
            let zipDir = installer ? destDir : installDir;
            if (!fs.existsSync(target)) {
                const downloadUrl = gdir.getLocalStaticApiUrl(`${software_library}/${software.source_local}`);
                const localFilePath = await httptool.downloadFile(downloadUrl, destDir, (progress, readyDownload, downloading, message) => {
                    if (progress == -1) {
                        if (progressCallback) progressCallback(-1, message)
                        if (callback) callback();
                        return
                    } else {
                        installProgress.value = progress / 3
                        if (progressCallback) progressCallback(installProgress.value)
                    }
                });
                if (localFilePath && localFilePath.dest) {
                    const dest = localFilePath.dest
                    const timer = setInterval(() => {
                        if (installProgress.value < 99) {
                            installProgress.value++;
                            if (progressCallback) progressCallback(installProgress.value);
                        } else {
                            if (timer) clearInterval(timer);
                            if (callback) callback();
                            return
                        }
                    }, 1000);

                    if (file.isCompressedFile(dest)) {
                        zip.putUnZipTask(dest, installDir, () => {
                            if (progressCallback) progressCallback(100);
                            if (timer) clearInterval(timer);
                            file.delete(dest)
                            if (callback) callback()
                            return
                        }, (progress) => {
                            console.log(`progress`, progress)
                        });
                    } else {
                        plattool.runAsAdmin(dest, (progress, message) => {
                            if (progressCallback) progressCallback(100);
                            if (timer) clearInterval(timer);
                            if (callback) callback()
                        })
                    }
                } else {
                    const message = `Download and decompression errors.`
                    console.log(message)
                    if (progressCallback) progressCallback(-1, message)
                    if (callback) callback()
                    return
                }
            } else {
                const message = `Software ${basename} is already installed in ${target}`
                console.log(message)
                if (progressCallback) progressCallback(100, message)
                if (callback) callback()
                return
            }

        } else if (software.install_type === '') {
            if (!fs.existsSync(target)) {
                const softwareZipName = `${mainDir}.zip`
                const downloadUrl = gdir.getLocalStaticApiUrl(`${applications}/${softwareZipName}`);
                const destDir = path.join(download, softwareZipName);
                const localFilePath = await httptool.downloadFile(downloadUrl, destDir, (progress, readyDownload, downloading, message) => {
                    if (progress == -1) {
                        if (progressCallback) progressCallback(-1, message)
                        if (callback) callback();
                        return
                    } else {
                        installProgress.value = progress / 3
                        if (progressCallback) progressCallback(installProgress.value)
                    }
                });
                if (localFilePath && localFilePath.dest) {
                    const dest = localFilePath.dest

                    const timer = setInterval(() => {
                        if (installProgress.value < 99) {
                            installProgress.value++;
                            if (progressCallback) progressCallback(installProgress.value);
                        } else {
                            if (timer) clearInterval(timer);
                            if (callback) callback();
                            return
                        }
                    }, 1000);
                    zip.putUnZipTask(dest, installDir, () => {
                        if (progressCallback) progressCallback(100);
                        if (timer) clearInterval(timer);
                        if (callback) callback()
                        return
                    }, (progress) => {
                        console.log(`progress`, progress)
                    });
                } else {
                    const message = `Download and decompression errors.`
                    console.log(message)
                    if (progressCallback) progressCallback(-1, message)
                    file.delete(dest)
                    if (callback) callback()
                    return
                }
            } else {
                const message = `Software ${basename} is already installed in ${target}`
                console.log(message)
                if (progressCallback) progressCallback(100, message)
                if (callback) callback()
                return
            }
        } else {
            return { error: { code: 'UNSUPPORTED_INSTALL_METHOD', message: 'Unsupported installation method' } };
        }
    }
}



Softinstall.toString = () => '[class Softinstall]';
module.exports = new Softinstall()
