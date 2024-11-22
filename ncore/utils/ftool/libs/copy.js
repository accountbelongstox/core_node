import fs from 'fs';
import path from 'path';
import Base from '#@base';

class FCopy extends Base {
    constructor() {
        super();
        this.callbacks = {};
        this.pendingTasks = [];
        this.maxTasks = 1;
        this.execCountTasks = 0;
        this.copyDirectoryCallbacks = {};
    }

    copyDirectory(src, out, callback) {
        let fileTotal = this.countFilesInDirectory(src);
        this.execCountTasks += fileTotal;
        this.copyDirectoryCallbacks[src] = {
            callback,
            fileTotal,
            usetime: 0,
            success: 0,
            fail: 0,
        };
        this.copyDirectoryQueue(src, out, callback, src);
    }

    async copyDirectoryQueue(sourcePath, destinationPath, callback, originalPath) {
        let startTime = new Date();
        try {
            if (!fs.existsSync(destinationPath)) {
                await this.mkdir(destinationPath);
            }
            let items = fs.readdirSync(sourcePath);
            for (let currentItem of items) {
                let currentSourcePath = path.join(sourcePath, currentItem);
                let currentDestinationPath = path.join(destinationPath, currentItem);

                if (fs.statSync(currentSourcePath).isDirectory()) {
                    await this.copyDirectoryQueue(currentSourcePath, currentDestinationPath, callback, originalPath);
                } else {
                    this.copyFile(currentSourcePath, currentDestinationPath, (dest, success, usetime) => {
                        this.execCountTasks--;
                        this.copyDirectoryCallbacks[originalPath].fileTotal--;
                        this.copyDirectoryCallbacks[originalPath].usetime += usetime;
                        if (success) {
                            this.copyDirectoryCallbacks[originalPath].success++;
                        } else {
                            this.copyDirectoryCallbacks[originalPath].fail++;
                        }
                        if (this.copyDirectoryCallbacks[originalPath].fileTotal === 0) {
                            let callbackOption = this.copyDirectoryCallbacks[originalPath];
                            delete this.copyDirectoryCallbacks[originalPath];
                            console.log(`Copy directory success, files ${callbackOption.fileTotal}, usetime ${callbackOption.usetime}, success ${callbackOption.success}, fail ${callbackOption.fail}`);
                            if (callback) callback(destinationPath, callbackOption.success, callbackOption.usetime, callbackOption.fail);
                        }
                    });
                }
            }
        } catch (error) {
            let callbackOption = this.copyDirectoryCallbacks[originalPath];
            delete this.copyDirectoryCallbacks[originalPath];
            console.log(`Copy directory error ${error}, files ${callbackOption.fileTotal}, usetime ${callbackOption.usetime}, success ${callbackOption.success}, fail ${callbackOption.fail}`);
            if (callback) callback(destinationPath, callbackOption.success, callbackOption.usetime, callbackOption.fail);
        }
    }

    async copyFile(sourcePath, destinationPath, callback) {
        let startTime = new Date();
        try {
            if (!fs.existsSync(sourcePath)) {
                console.log(`no such file or directory, ${sourcePath}`);
                if (callback) return callback(destinationPath, false, 0);
                return;
            }
            if (fs.existsSync(destinationPath)) {
                if (fs.existsSync(sourcePath)) {
                    let sourcePathSize = this.getFileSize(sourcePath);
                    let destinationPathSize = this.getFileSize(destinationPath);
                    if (sourcePathSize === destinationPathSize) {
                        if (callback) return callback(destinationPath, true, new Date() - startTime);
                    }
                }
            }
            const destinationPathDirname = path.dirname(destinationPath);
            await this.mkdir(destinationPathDirname);
            const sourceStream = fs.createReadStream(sourcePath);
            const destinationStream = fs.createWriteStream(destinationPath);
            sourceStream.on('error', (error) => {
                console.log(`error: ${error}`);
                if (callback) return callback(null, false, new Date() - startTime);
            });
            destinationStream.on('error', (error) => {
                console.log(`error: ${error}`);
                if (callback) return callback(null, false, new Date() - startTime);
            });
            sourceStream.on('end', () => {
                console.log(`Copy success: ${sourcePath} to ${destinationPath}`);
                if (callback) return callback(destinationPath, true, new Date() - startTime);
            });
            sourceStream.pipe(destinationStream, { end: true });
        } catch (error) {
            console.error(`Copy error: ${error}`);
            if (callback) return callback(null, false, new Date() - startTime);
        }
    }

    syncCopy(source, destination) {
        try {
            const data = fs.readFileSync(source);
            fs.writeFileSync(destination, data);
            console.log(`File copied from ${source} to ${destination}`);
        } catch (error) {
            console.error(`Error copying file from ${source} to ${destination}: ${error.message}`);
        }
    }

    isCopyTask(sid) {
        return this.pendingTasks.some(item => item.sid === sid);
    }

    deleteCopyTask(sid) {
        const index = this.pendingTasks.findIndex(item => item.sid === sid);
        if (index > -1) {
            this.pendingTasks.splice(index, 1);
        }
    }

    async execTask(callback, message) {
        if (!this.execTaskEvent) {
            this.execTaskEvent = setInterval(() => {
                if (this.execCountTasks >= this.maxTasks) {
                    console.log(`copying tasks is full. current tasks: ${this.execCountTasks}, waiting...`);
                } else if (this.pendingTasks.length > 0) {
                    let {
                        src,
                        out,
                        sid,
                        before,
                        callback,
                        info
                    } = this.pendingTasks.shift();
                    if (!this.isFileLocked(src) && !this.isFileLocked(out)) {
                        if (before) before(src, out);
                        if (this.isFile(src)) {
                            this.execCountTasks++;
                            if (message) message(`copying: ${src} to ${out}.`, true);
                            this.copyFile(src, out, (destinationPath, copySuccess, timeDifference) => {
                                this.deleteCopyTask(sid);
                                if (info) {
                                    if (message) message(`copied: ${src} to ${out}.`, true);
                                } else {
                                    console.log(`copied: ${src} to ${out}.`);
                                }
                                this.execCountTasks--;
                                if (callback) {
                                    callback(destinationPath, copySuccess, timeDifference);
                                }
                            });
                        } else {
                            if (info) {
                                if (message) message(`copying Directory: ${src} to ${out}.`, true);
                            } else {
                                console.log(`copying Directory: ${src} to ${out}.`);
                            }
                            this.copyDirectory(src, out, (destinationPath, success, usetime, fail) => {
                                this.deleteCopyTask(sid);
                                if (callback) {
                                    callback(destinationPath, success, usetime, fail);
                                }
                            }, src);
                        }
                    } else {
                        if (info) {
                            if (message) message(`File is locked, requeue, file: ${src}`, true);
                        } else {
                            console.log(`File is locked, requeue, file: ${src}`);
                        }
                        this.pendingTasks.push({
                            src,
                            out,
                            sid,
                            before,
                            callback,
                            info
                        });
                    }
                } else {
                    if (this.execCountTasks < 1) {
                        clearInterval(this.execTaskEvent);
                        this.execTaskEvent = null;
                        console.log(`copying task, end monitoring.`);
                    } else {
                        console.log(`There are still ${this.execCountTasks} copying tasks, waiting`);
                    }
                }
            }, 1000);
        }
    }

    putCopyTask(src, out, before, callback, info = true) {
        let startTime = new Date();
        if (fs.existsSync(out) && this.isFile(out)) {
            if (fs.existsSync(src) && this.isFile(src)) {
                let sourcePathSize = this.getFileSize(src);
                let destinationPathSize = this.getFileSize(out);
                if (sourcePathSize === destinationPathSize) {
                    if (callback) return callback(out, true, new Date() - startTime);
                }
            }
        }
        let sid = this.get_id(src);

        if (!this.isCopyTask(sid)) {
            this.pendingTasks.push({
                src,
                out,
                sid,
                before,
                callback,
                info
            });
        }
        this.execTask();
    }

    moveFolder(srcDir, destDir, callback) {
        const srcParent = path.dirname(srcDir);
        const destParent = path.dirname(destDir);
        if (srcParent === destParent) {
            fs.renameSync(srcDir, destDir);
        } else {
            this.putCopyTask(srcDir, destDir, null, (destinationPath, success, usetime, fail) => {
                setTimeout(() => {
                    this.deleteFolderAsync(srcDir);
                    if (callback) callback(destinationPath, success, usetime, fail);
                }, 500);
            }, false);
        }
    }
}

export default new FCopy();
