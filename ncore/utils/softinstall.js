'use strict';
const fs = require('fs');
const path = require('path');
const { gdir } = require('../globalvars.js');
const Base = require('#@base');
const { httptool, zip, file, plattool, strtool, fpath } = require('../utils.js');
const { execSync } = require('child_process');
const os = require('os')
const shoticon = require('./shoticon.js');

class Softinstall extends Base {
    installQueue = {}
    installSchedulingQueue = {}
    isQueueRunning = false;
    installation_socket_event_name = `installer`
    installingSoftware = null

    constructor() {
        super();
        this.powershellPath = os.platform() === 'win32' ? this.findPowerShellPath() : null;
    }

    findPowerShellPath() {
        const standardPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
        const corePath = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';

        if (fs.existsSync(corePath)) {
            return corePath;
        } else if (fs.existsSync(standardPath)) {
            return standardPath;
        } else {
            console.error('PowerShell not found. Please ensure PowerShell is installed.');
            return null;
        }
    }
    addInstallQueue(softwareOrg) {
        if (!softwareOrg || typeof softwareOrg !== 'object') {
            console.error('Invalid software object.');
            return;
        }
        if (!softwareOrg.hasOwnProperty('basename')) {
            console.error('Software object must have a basename property.');
            return;
        }

        const { basename } = softwareOrg;

        if (basename in this.installQueue) {
            console.warn(`${basename} is already in the installation queue.`);
            return;
        }

        this.installQueue[basename] = {
            installingProgress: 0,
            ...softwareOrg
        };

        const software = this.installQueue[basename];
        const installingSoftware = {
            setProgress: (val, notify = true) => {
                if (val === undefined) {
                    software.installingProgress = val
                }
                if (notify) this.notifyBySocket(software, "install", `The current installation progress.`)
            },
            addProgress: (max = 100, notify = true) => {
                if (software.installingProgress < max) {
                    software.installingProgress++
                }
                if (notify) this.notifyBySocket(software, "install", `The current installation progress.`)
            },
            doneProgress: (notify = false) => {
                software.installingProgress = 100
                if (notify) this.notifyBySocket(software, "install", `The installation has been completed and the installation was successful..`)
            },
            fail: (msg = `The current installation status is failed...`, notify = true) => {
                software.installingProgress = -1
                delete this.installSchedulingQueue[basename]
                if (notify) this.notifyBySocket(software, "install", msg)
                this.popInstallQueue()
            },
            done: (notify = true) => {
                delete this.installSchedulingQueue[basename]
                software.isExist = file.isFile(software.target);
                this.installationRulesAfter(installingSoftware, (success, message = `The installation has been completed and the installation was successful..`) => {
                    software.installResultStatus = success
                    if (success) {
                        software.installingProgress = 100
                    } else {
                        software.installingProgress = -1
                    }
                    if (notify) this.notifyBySocket(software, "install", message)
                    this.clearDesktopShortcuts(software)
                    this.popInstallQueue()
                })
            },
            ...softwareOrg
        };

        this.installSchedulingQueue[basename] = installingSoftware
        this.notifyBySocket(software, "install", `Added ${basename} to the installation queue`)

        if (!this.isQueueRunning) {
            this.popInstallQueue();
        }
    }

    notifyBySocket(software, notifyType = "install", message) {
        if (!message) message = `Added ${basename} to the installation queue`
        const basename = software.basename;
        httptool.eggSocket(this.installation_socket_event_name, {
            notifyType: notifyType,
            message,
            ...software,

        });
    }

    popInstallQueue() {
        const queueLength = Object.keys(this.installQueue).length;
        if (queueLength > 0) {
            const keys = Object.keys(this.installQueue);
            const firstKey = keys[0];
            const software = this.installSchedulingQueue[firstKey];
            this.installingSoftware = software
            delete this.installQueue[firstKey];
            const basename = software.basename;
            this.notifyBySocket(software, "install", `Added ${basename} to the installation queue`)
            this.installSoftware(software);
        } else {
            this.isQueueRunning = false
        }
    }

    async installationRulesBefore(software, progressCallback, callback) {
        const appDir = software.appDir;
        const target = software.target;
        const mainDir = file.getLevelPath(target, 2);
        console.log(`target`, target)
        console.log(`mainDir`, mainDir)
        const mainDirLow = mainDir.toLowerCase();

        // if (mainDir.startsWith('Adobe')) {
        //     const message = `The installation path is not allowed to be in the C:\\Program Files directory.`
        //     console.log(message)
        //     if (progressCallback) progressCallback(-1, message)
        //     if (callback) callback()
        //     return
        // }
        let isBeforeRule = true
        if (mainDirLow.startsWith('avast')) {
            const links = [
                [gdir.getUserProfileDir('AppData/Local/AVAST Software'), 'AVASTSoftware'],
                ['C:/Program Files (x86)/AVAST Software', 'AVASTSoftware'],
            ]
            console.log(`links`, links)
            this.linkToDirs(links, appDir, true)
        } else if (mainDirLow.startsWith('discord')) {
            const links = [
                [gdir.getUserProfileDir('AppData/Local/Discord'), 'Discord'],
            ]
            this.linkToDirs(links, appDir, true)
        } else if (mainDirLow.startsWith('adobe')) {
            const links = [
                ['C:/Program Files (x86)/Adobe', 'Adobe(x86)'],
                ['C:/Program Files/Adobe', 'Adobe'],
                ['C:/ProgramData/Adobe', 'Adobe_ProgramData'],
            ]
            this.linkToDirs(links, appDir, true)
        } else if (mainDirLow.startsWith('bravesoftware')) {
            const links = [
                ['C:/Program Files/BraveSoftware', 'BraveSoftware'],
            ]
            this.linkToDirs(links, appDir, true)
        } else if (mainDirLow.startsWith('avg')) {
            const links = [
                [gdir.getUserProfileDir('AppData/Local/AVG'), 'AVG'],
            ]
            this.linkToDirs(links, appDir, true)
        } else if (mainDirLow.startsWith('google')) {
            const links = [
                [gdir.getUserProfileDir('AppData/Local/Google'), 'Google'],
                ['C:/Program Files/Google', 'Google'],
                ['C:/Program Files (x86)/Google', 'Google/x86'],
            ]
            this.linkToDirs(links, appDir, true)
        } else if (mainDirLow.startsWith('oray')) {
            const links = [
                ['C:/Program Files/Oray', 'Oray'],
                ['C:/Program Files (x86)/Oray', 'Oray/Oray_x86'],
            ]
            this.linkToDirs(links, appDir, true)
        } else if (mainDirLow.startsWith('microsoft visual studio')) {
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
        } else if (mainDirLow.startsWith('nero')) {
            const links = [
                [gdir.getUserProfileDir('AppData/Local/Google'), 'Google'],
                ['C:/Program Files/Google', 'Google'],
                ['C:/Program Files (x86)/Google', 'Google/x86'],
            ]
            this.linkToDirs(links, appDir, true)
        } else {
            isBeforeRule = false
        }
        if (isBeforeRule) {
            software.addProgress(1, true)
        }
    }

    getShortcutTarget(shortcutPath) {
        const result = execSync(`powershell -Command "(New-Object -ComObject WScript.Shell).CreateShortcut('${shortcutPath}').TargetPath"`).toString().trim();
        return result;
    }

    linkToDirs(links, appDir, force = true) {
        try {
            links.forEach(link => {
                const [targetPath, src] = link;
                let sourcePath = src
                if (!file.isAbsolute(src)) {
                    sourcePath = path.join(appDir, src);
                }
                console.log(`isSymbolicLink`, targetPath, file.isSymbolicLink(targetPath))
                if (!file.isSymbolicLink(targetPath)) {
                    file.symlinkSync(sourcePath, targetPath, force);
                    console.log(`Symbolic link created from ${sourcePath} to ${targetPath}`);
                }
            });
        } catch (error) {
            console.error('Error creating symbolic link:', error);
        }
    }

    getSoftwareDownloadUrl(software,) {
        const source_local = software.source_local;
        const applications = 'softlist/static_src/applications/';
        const software_library = 'softlist/static_src/software_library/';
        if (source_local) {
            const localUrl = gdir.getLocalStaticApiUrl(software_library);
            return `${localUrl}/${source_local}`
        } else {
            const target = software.target;
            const mainDir = file.getLevelPath(target, 2);
            const softwareZipName = `${mainDir}.zip`
            const downloadUrl = gdir.getLocalStaticApiUrl(`${applications}/${softwareZipName}`);
            return downloadUrl
        }
    }

    searchInstallerExe(dir) {
        if (fs.existsSync(dir)) {
            if (dir.endsWith('.exe')) {
                return dir
            }
            const stats = fs.statSync(dir);
            if (stats.isFile()) {
                dir = path.dirname(dir);
            }
            while (file.hasOnlyOneSubdirectory(dir)) {
                dir = path.join(dir, fs.readdirSync(dir)[0]);
            }
            const files = fs.readdirSync(dir);
            let exeCount = 0;
            let installerPath = null;
            for (const file of files) {
                const filePath = path.join(dir, file);
                if (file.endsWith('.exe')) {
                    exeCount++;
                    installerPath = filePath;
                }
                if (file.includes('setup.exe')) {
                    return filePath;
                }
            }
            if (exeCount === 1) {
                return installerPath;
            }
        } else {
            return null;
        }
    }
    async installByWingetId(software) {
        const target = software.target;
        const installDir = path.dirname(target);
        file.mkdir(installDir);
        const installCommand = [
            'winget',
            'install',
            // `--ignore-security-hash`,
            // `--ignore-local-archive-malware-scan`,
            `--accept-source-agreements`,
            `--accept-package-agreements`,
            '--id',
            software.winget_id,
            '--location',
            installDir,
            // `--disable-interactivity`,
            '--silent',
            '--force',
        ];
        console.log(`installCommand`, installCommand.join(' '))
        const progressCallback = () => {
            software.addProgress(80)
        }
        const stdOjb = await plattool.spawnAsync(installCommand, true, null, null, null, 50000, progressCallback)
        software.done(stdOjb);
        return stdOjb
    }

    async installByDownloadBackupZip(software) {
        const installDir = software.appDir;
        const basename = software.basename;
        const target = software.target;
        const mainDir = file.getLevelPath(target, 2);
        const applications = 'softlist/static_src/applications/';
        let intervalProgress = 0;
        const download = gdir.getCustomTempDir('Downloads');
        const downloadProgressCallback = () => {
            software.addProgress(30)
        }
        const zipProgressCallback = () => {
            software.addProgress(90)
        }
        if (!fs.existsSync(target)) {
            const softwareZipName = `${mainDir}.zip`
            const downloadUrl = gdir.getLocalStaticApiUrl(`${applications}/${softwareZipName}`);
            const destDir = path.join(download, softwareZipName);

            const localFilePath = await httptool.downloadFile(downloadUrl, destDir, downloadProgressCallback, true);
            if (localFilePath && localFilePath.dest) {
                const dest = localFilePath.dest
                const timer = setInterval(() => {
                    if (intervalProgress < 90) {
                        intervalProgress++;
                        zipProgressCallback()
                    } else {
                        if (timer) clearInterval(timer);
                    }
                }, 1000);
                zip.putUnZipTask(dest, installDir, () => {
                    if (timer) clearInterval(timer);
                    software.done()
                }, zipProgressCallback);
            } else {
                software.fail(`Just the file download failed.`)
            }
        } else {
            software.done()
        }
    }

    async installByInstaller(software) {
        const installDir = software.appDir;
        const basename = software.basename;
        const target = software.target;
        const mainDir = file.getLevelPath(target, 2);
        const source_local = software.source_local;
        const source_internet = software.source_internet;
        const software_library = 'softlist/static_src/software_library/';
        let downloadUrl = null
        const downloadProgressCallback = () => {
            software.addProgress(20)
        }
        const zipProgressCallback = () => {
            software.addProgress(30)
        }
        if (source_local) {
            downloadUrl = gdir.getLocalStaticApiUrl(`${software_library}/${source_local}`);
        } else {
            downloadUrl = source_internet
        }
        if (downloadUrl) {
            const installBaseName = path.basename(downloadUrl);
            const download = gdir.getCustomTempDir('Downloads');
            const installPath = path.join(installDir, basename);
            let dest = path.join(download, installBaseName);
            if (!fs.existsSync(installPath)) {
                if (!fs.existsSync(dest)) {
                    const downloadUrl = this.getSoftwareDownloadUrl(software);
                    dest = await httptool.downloadFile(downloadUrl, dest, downloadProgressCallback);
                }
                const unzipDir = path.join(download, path.basename(software.source_local, path.extname(software.source_local)));

                if (fs.existsSync(unzipDir)) {
                    await this.seartchInstallerAndRun(software, unzipDir)
                } else {
                    if (file.isCompressedFile(dest)) {
                        zip.putUnZipTask(dest, unzipDir, async () => {
                            await this.seartchInstallerAndRun(software, unzipDir)
                        }, zipProgressCallback);
                    } else {
                        await this.seartchInstallerAndRun(software, dest)
                    }
                }
            }
        } else {
            software.fail()
        }
    }

    async seartchInstallerAndRun(software, unzipDir) {
        if (software.startClickInstaller) {
            return
        }
        if (!software.startClickInstaller) {
            software.startClickInstaller = true
        }
        let intervalProgress = 0;
        const timerStart = () => {
            const timer = setInterval(() => {
                if (intervalProgress < 90) {
                    intervalProgress++;
                    software.addProgress(90)
                } else {
                    software.done()
                    if (timer) clearInterval(timer);
                }
            }, 1000);
        }
        console.log(`unzipDir`, unzipDir)
        let installerExe = this.searchInstallerExe(unzipDir)
        console.log(`installerExe`, installerExe)
        await plattool.runAsAdmin(installerExe, (progress, message) => {
            timerStart()
        });
    }

    async installSoftware(software) {
        // const installDir = software.appDir;
        // const basename = software.basename;
        // const target = software.target;
        // const mainDir = file.getLevelPath(target, 2);
        // const source_local = software.source_local;
        // const applications = 'softlist/static_src/applications/';
        // const software_library = 'softlist/static_src/software_library/';
        // const installProgress = { value: 0 };
        // const download = gdir.getCustomTempDir('Downloads');
        try {
            this.installationRulesBefore(software)
        } catch (e) {
            this.error(e)
        }
        if (software.winget_id) {
            await this.installByWingetId(software)
        } else if (
            software.install_type === 'installer'
            ||
            (software.source_local && typeof software.source_local === 'string')
        ) {
            await this.installByInstaller(software)
        } else if (software.install_type === '') {
            await this.installByDownloadBackupZip(software)
        } else {
            return { error: { code: 'UNSUPPORTED_INSTALL_METHOD', message: 'Unsupported installation method' } };
        }
    }

    async installationRulesAfter(software, callback) {
        const basename = software.basename;
        const target = software.target;
        const mainDir = file.getLevelPath(target, 2);
        const appDir = software.appDir;
        let installResultStatus = !!target
        let message = `The installation has been completed and the installation was successful..`
        if (basename.includes(`eric`)) {
            const installerPython = path.join(appDir, mainDir, 'install.py')
            let pipUpdateCommand = `python -m pip install --upgrade pip`
            let result = await plattool.spawnAsync(pipUpdateCommand, true, null, null, null, 50000, () => {
                software.addProgress(92)
            })
            let installCommand = `python ${installerPython}`
            console.log(result)
            console.log(installerPython)
            result = await plattool.spawnAsync(installCommand, true, null, null, null, 50000, () => {
                software.addProgress(99)
            })
            console.log(result)
        }
        else if (basename.includes(`oray`)) {
            if (target) {
                await plattool.runAsAdmin(target)
            }
        }
        if (callback) callback(installResultStatus, message)
    }

    deleteDesktopShortcuts(software) {
        const desktopPath = path.join(os.homedir(), 'Desktop');
        const shortcuts = fs.readdirSync(desktopPath).filter(file => file.endsWith('.lnk'));
        const clearIcons = [
            `Chrome Beta`,
            `Chrome Dev`,
            `Chrome Canary`,

        ]
        this.info(`clearDesktopShortcuts`)
        this.info(`---------------------------------------`)
        shortcuts.forEach(async (shortcut) => {
            const shortcutPath = path.join(desktopPath, shortcut);
            const shortcutLinkInfo = await shoticon.parseLnkFile(shortcutPath);
            const target = shortcutLinkInfo.target;
            this.info(`\t desktop-target : ${target}`)
            this.info(`\t software-target : ${software.target}`)
            if (fpath.equal(target, software.target)) {
                file.delete(shortcutLinkInfo.linkPath)
                this.success(`clear-Shortcuts : ${shortcutLinkInfo.linkPath}`)
            }
            const isDelete = clearIcons.some(item => target.includes(item));
            if (isDelete) {
                file.delete(shortcutLinkInfo.linkPath)
                this.success(`clear-Shortcuts : ${shortcutLinkInfo.linkPath}`)
            }
        });
        this.info(`---------------------------------------`)
    }

    clearDesktopShortcuts(software) {
        const desktopPath = path.join(os.homedir(), 'Desktop');
        if (!fs.existsSync(desktopPath)) {
            console.log(`clearDesktopShortcuts : ${desktopPath} is not exists`)
            return
        }
        const shortcuts = fs.readdirSync(desktopPath).filter(file => file.endsWith('.lnk'));
        shortcuts.forEach(async (shortcut) => {
            const shortcutPath = path.join(desktopPath, shortcut);
            const shortcutLinkInfo = await shoticon.parseLnkFile(shortcutPath);
            let target = shortcutLinkInfo.target;
            if (!target) target = ``
            target = path.normalize(target).toLowerCase();
            let appDir = shortcutLinkInfo.appDir;
            if (!appDir) appDir = ``
            appDir = path.normalize(appDir).toLowerCase();
            let softAppDir = software.appDir;
            if (!softAppDir) softAppDir = ``
            softAppDir = path.normalize(softAppDir).toLowerCase();
            let softTarget = software.target
            if (!softTarget) softTarget = ``
            softTarget = path.normalize(softTarget).toLowerCase();
            if (fpath.equal(target, softTarget)) {
                file.delete(shortcutLinkInfo.linkPath)
            }
            let installDir = file.removePathFrom(softTarget, softAppDir)
            installDir = path.normalize(installDir).toLowerCase()
            if (target.endsWith(installDir)) {
                file.delete(shortcutLinkInfo.linkPath)
            }
            console.log(`installDir`, installDir)
            console.log(`target`, target)
        });
        setTimeout(() => {
            this.deleteDesktopShortcuts(software)
        }, 2000);
        setTimeout(() => {
            this.deleteDesktopShortcuts(software)
        }, 3000);
        setTimeout(() => {
            this.deleteDesktopShortcuts(software)
        }, 5000);
        setTimeout(() => {
            this.deleteDesktopShortcuts(software)
        }, 15000);
    }
}



Softinstall.toString = () => '[class Softinstall]';
module.exports = new Softinstall()
