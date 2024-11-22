const { exec, execSync } = require('child_process');
const { spawn } = require('child_process');

const path = require('path');
const fs = require('fs');
const Base = require('../base/base.js');
const os = require('os');
const crypto = require('crypto');

class Zip extends Base {
    callbacks = {}
    maxTasks = 10;
    pendingTasks = [];
    concurrentTasks = 0;
    execCountTasks = 0
    execTaskEvent = null
    libraryDir = path.join(__dirname, '../library');
    zipQueueTokens = []

    constructor() {
        super()
    }

    get_md5(value) {
        const hash = crypto.createHash('md5');
        hash.update(value);
        return hash.digest('hex');
    }

    createString(length = 10) {
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return result;
    }

    create_id(value) {
        if (!value) value = this.createString(128)
        const _id = this.get_id(value);
        return _id;
    }

    get_id(value, pre) {
        value = `` + value
        const md5 = this.get_md5(value);
        let _id = `id${md5}`
        if (pre) _id = pre + _id
        return _id;
    }

    getCurrentOS() {
        return os.platform();
    }

    isWindows() {
        return this.getCurrentOS() === 'win32';
    }

    get7zExeName() {
        let exeFile = `7zz`
        if (this.isWindows()) {
            exeFile = `7z.exe`
        }
        return exeFile
    }

    get7zExe() {
        let folder = `linux`
        let exeFile = this.get7zExeName()
        if (this.isWindows()) {
            folder = `win32`
        }
        return path.join(this.libraryDir, `${folder}/${exeFile}`)
    }

    mkdirSync(directoryPath) {
        return this.mkdir(directoryPath)
    }

    mkdir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    isFileLocked(filePath) {
        if (!fs.existsSync(filePath)) {
            return false
        }
        try {
            const fd = fs.openSync(filePath, 'r+');
            fs.closeSync(fd);
            return false;
        } catch (error) {
            if (error.code === 'EBUSY' || error.code === 'EPERM') {
                return true;
            }
            return false
        }
    }

    getModificationTime(fp) {
        if (!this.existsSync(fp)) {
            return 0
        }
        try {
            const stats = fs.statSync(fp);
            return stats.mtime.getTime();
        } catch (error) {
            console.error(`Error getting modification time: ${error.message}`);
            return 0;
        }
    }

    getFileSize(filePath) {
        if (!this.existsSync(filePath)) {
            return -1
        }
        try {
            const stats = fs.statSync(filePath);
            const fileSizeInBytes = stats.size;
            return fileSizeInBytes;
        } catch (error) {
            return -1;
        }
    }

    setMode(mode) {
        this.mode = mode
    }

    log(msg, event) {
        if (event) {
            this.success(msg)
        }
    }

    async compressDirectory(srcDir, outDir, token, callback) {
        const srcAbsPath = path.resolve(srcDir);
        const outAbsPath = path.resolve(outDir);
        if (!fs.existsSync(srcAbsPath)) {
            return;
        }
        if (!fs.existsSync(outAbsPath)) {
            this.mkdirSync(outAbsPath)
        }
        const subDirectories = fs.readdirSync(srcAbsPath, { withFileTypes: true }).filter(entry => entry.isDirectory());
        for (const subDir of subDirectories) {
            const subDirName = subDir.name;
            if (subDirName.startsWith(`.`)) {
                continue
            }
            const subDirPath = path.join(srcAbsPath, subDirName);
            this.putZipQueueTask(subDirPath, outDir, token, callback)
        }
    }

    getZipPath(srcDir, outDir) {
        const srcDirName = path.basename(srcDir);
        const zipFileName = `${srcDirName}.zip`;
        const zipFilePath = path.join(outDir, zipFileName);
        return zipFilePath
    }

    async addToPendingTasks(command, callback, processCallback) {
        this.concurrentTasks++;
        this.execBySpawn(command, callback, processCallback);
    }

    execBySpawn(command, callback, processCallback) {
        const startTime = new Date();
        const child = spawn(command, { shell: true });

        child.stdout.on('data', (data) => {
            data = this.byteToStr(data)
            if (processCallback) processCallback(data);
        });

        child.stderr.on('data', (data) => {
            data = this.byteToStr(data)
            console.error(`Error: ${data}`);
            if (processCallback) processCallback(-1);
        });

        child.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
            if (callback) callback(new Date() - startTime);
        });
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

    processesCount(processName) {
        const normalizedProcessName = processName.toLowerCase();
        let cmd;

        if (this.isWindows()) {
            cmd = `tasklist /fi "imagename eq ${processName}`;
        } else {
            cmd = `ps aux | grep ${processName}`;
        }
        try {
            const stdout = execSync(cmd, { encoding: 'utf8' });
            const count = stdout.split('\n').filter(line => line.toLowerCase().includes(normalizedProcessName)).length - 1;
            return count;
        } catch (err) {
            console.error('Error executing command:', err);
            return 10000;
        }
    }

    a7zProcessesCount() {
        const processName = this.get7zExeName()
        let processZipCount = this.processesCount(processName)
        return processZipCount
    }

    async execTask() {
        if (!this.execTaskEvent) {
            this.log(`Background compaction task started`, true);
            this.execTaskEvent = setInterval(() => {
                let processZipCount = this.a7zProcessesCount()
                if (processZipCount != 10000) {
                    this.concurrentTasks = processZipCount
                }
                if (this.concurrentTasks >= this.maxTasks) {
                    this.log(`7zProcesse tasks is full. current tasks:${this.concurrentTasks}, waiting...`);
                } else if (this.pendingTasks.length > 0) {

                    const TaskObject = this.pendingTasks.shift();
                    const command = TaskObject.command
                    const isQueue = TaskObject.isQueue
                    const token = TaskObject.token
                    const processCallback = TaskObject.processCallback

                    let zipPath = TaskObject.zipPath
                    let zipName = path.basename(zipPath)
                    if (!this.isFileLocked(zipPath)) {
                        this.log(`Unziping ${zipName}, background:${this.concurrentTasks}`, true);
                        this.execCountTasks++
                        this.addToPendingTasks(command, (usetime) => {
                            this.log(`${zipName} Compressed.runtime: ${usetime / 1000}s`, true);
                            this.deleteTask(zipPath)
                            this.callbacks[token].usetime += usetime
                            this.execCountTasks--;
                            this.concurrentTasks--;
                            if (!isQueue) {
                                this.execTaskCallback(token)
                            }
                        },processCallback)
                    } else {
                        this.pendingTasks.push(TaskObject);
                        this.log(`The file is in use, try again later, "${zipPath}"`)
                    }
                } else {
                    if (this.execCountTasks < 1) {
                        clearInterval(this.execTaskEvent)
                        this.execTaskEvent = null
                        this.log(`There is currently no compression task, end monitoring.`);
                        this.execTaskQueueCallbak()
                    } else {
                        this.log(`There are still ${this.execCountTasks} compression tasks, waiting`)
                    }
                }
            }, 1000)
        }
    }

    execTaskQueueCallbak() {
        this.zipQueueTokens.forEach(token => {
            this.execTaskCallback(token)
        })
    }

    execTaskCallback(token) {
        if (this.callbacks[token]) {
            let callback = this.callbacks[token].callback
            let usetime = this.callbacks[token].usetime
            let src = this.callbacks[token].src
            delete this.callbacks[token]
            if (callback) callback(usetime, src)
        }
    }

    putZipTask(src, out, token, callback) {
        this.putTask(src, out, token, true, callback, false)
    }

    putZipQueueTask(src, out, token, callback) {
        this.putTask(src, out, token, true, callback)
    }

    putUnZipTask(src, out, callback,processCallback) {
        let token = this.get_id(src)
        this.putTask(src, out, token, false, callback, false,processCallback)
    }
    putUnZipQueueTask(src, out, callback,processCallback) {
        let token = this.get_id(src)
        this.putTask(src, out, token, false, callback,true,processCallback)
    }

    putQueueCallback(callback, token) {
        if (callback && !this.callbacks[token]) {
            if (!token) token = this.create_id()
            this.zipQueueTokens.push(token)
            this.callbacks[token] = {
                callback,
                usetime: 0,
                src: ``
            }
        }
    }

    async putUnZipTaskPromise(zipFilePath, targetDirectory) {
        return new Promise((resolve, reject) => {
            this.putUnZipTask(zipFilePath, targetDirectory, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        }).catch((error) => { });
    }

    putTask(src, out, token, isZip = true, callback, isQueue = true,processCallback) {
        if (callback && !this.callbacks[token]) {
            this.callbacks[token] = {
                callback,
                usetime: 0,
                src
            }
        }
        if (isQueue) {
            this.zipQueueTokens.push(token)
        }
        let zipPath
        let command
        if (isZip) {
            zipPath = this.getZipPath(src, out)
            if (fs.existsSync(zipPath)) {
                if (!this.mode) {
                    return
                }
                if (this.mode.update) {
                    let srcModiTime = this.getModificationTime(src)
                    let zipPathModiTime = this.getModificationTime(zipPath)
                    let difTime = srcModiTime - zipPathModiTime
                    if (difTime < 1000 * 60) {
                        return
                    }
                    fs.unlinkSync(zipPath)
                } else if (this.mode.override) {
                    fs.unlinkSync(zipPath)
                } else {
                    return
                }
            }
            let zipSize = this.getFileSize(zipPath)
            if (zipSize == 0) {
                fs.unlinkSync(zipSize)
            }
            command = this.createZipCommand(src, out)
        } else {
            zipPath = src
            command = this.createUnzipCommand(src, out)
        }

        if (!this.isTask(zipPath)) {
            let zipAct = isZip ? `compression` : `unzip`
            let zipName = path.basename(zipPath)
            this.log(`Add a ${zipAct} ${zipName}, background:${this.concurrentTasks}`, true);
            this.pendingTasks.push({
                command,
                zipPath,
                token,
                isQueue,
                processCallback
            })
        }
        this.execTask()
    }

    deleteTask(zipPath) {
        const index = this.pendingTasks.findIndex(item => item.zipPath === zipPath);
        if (index > -1) {
            this.pendingTasks.splice(index, 1);
        }
    }

    isTask(zipPath) {
        return this.pendingTasks.some(item => item.zipPath === zipPath);
    }

    createZipCommand(srcDir, outDir) {
        const srcDirName = path.basename(srcDir);
        const zipFileName = `${srcDirName}.zip`;
        const zipFilePath = path.join(outDir, zipFileName);
        const command = `"${this.get7zExe()}" a "${zipFilePath}" "${srcDir}"`;
        return command
    }

    createUnzipCommand(zipFilePath, destinationPath) {
        const command = `${this.get7zExe()} x "${zipFilePath}" -o"${destinationPath}" -y`;
        return command;
    }

    test(archivePath) {
        try {
            execSync(`${this.get7zExe()} t "${archivePath}"`, { stdio: 'pipe' });
            return true;
        } catch (error) {
            console.error("Error testing the archive:", error);
            return false;
        }
    }
}

Zip.toString = () => '[class Zip]';
module.exports = new Zip();
