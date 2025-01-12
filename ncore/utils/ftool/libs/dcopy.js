const fs = require('fs');
const path = require('path');

function countFilesInDirectory(dir) {
    let count = 0;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            count += countFilesInDirectory(fullPath);
        } else {
            count++;
        }
    }
    return count;
}

// Directory operations
async function mkdir(dir) {
    return new Promise((resolve, reject) => {
        fs.mkdir(dir, { recursive: true }, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}


function copyDirectory(src, out, callback) {
    let fileTotal = countFilesInDirectory(src);
    let copyDirectoryCallbacks = {
        callback,
        fileTotal,
        usetime: 0,
        success: 0,
        fail: 0,
    };
    return copyDirectoryQueue(src, out, callback, src, copyDirectoryCallbacks);
}

async function copyDirectoryQueue(sourcePath, destinationPath, callback, originalPath, copyDirectoryCallbacks) {
    let startTime = new Date();
    try {
        if (!fs.existsSync(destinationPath)) {
            await mkdir(destinationPath);
        }
        let items = fs.readdirSync(sourcePath);
        for (let currentItem of items) {
            let currentSourcePath = path.join(sourcePath, currentItem);
            let currentDestinationPath = path.join(destinationPath, currentItem);

            if (fs.statSync(currentSourcePath).isDirectory()) {
                await copyDirectoryQueue(currentSourcePath, currentDestinationPath, callback, originalPath, copyDirectoryCallbacks);
            } else {
                await copyFile(currentSourcePath, currentDestinationPath);
                copyDirectoryCallbacks.fileTotal--;
                copyDirectoryCallbacks.usetime += (new Date() - startTime);
                copyDirectoryCallbacks.success++;
            }
        }
        if (copyDirectoryCallbacks.fileTotal === 0 && callback) {
            callback(destinationPath, copyDirectoryCallbacks.success, copyDirectoryCallbacks.usetime, copyDirectoryCallbacks.fail);
        }
    } catch (error) {
        console.error(`Copy directory error:`, error);
        if (callback) {
            callback(destinationPath, copyDirectoryCallbacks.success, copyDirectoryCallbacks.usetime, copyDirectoryCallbacks.fail);
        }
    }
}

async function copyFile(sourcePath, destinationPath) {
    return new Promise((resolve, reject) => {
        try {
            if (!fs.existsSync(sourcePath)) {
                reject(new Error(`No such file: ${sourcePath}`));
                return;
            }
            const destinationPathDirname = path.dirname(destinationPath);
            fs.mkdirSync(destinationPathDirname, { recursive: true });
            fs.copyFileSync(sourcePath, destinationPath);
            resolve(destinationPath);
        } catch (error) {
            reject(error);
        }
    });
}

function syncCopy(source, destination) {
    try {
        const data = fs.readFileSync(source);
        fs.writeFileSync(destination, data);
        return true;
    } catch (error) {
        console.error(`Error copying file: ${error.message}`);
        return false;
    }
}

function putCopyTask(src, out) {
    return new Promise((resolve, reject) => {
        try {
            if (fs.existsSync(src)) {
                const destDir = path.dirname(out);
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }
                fs.copyFileSync(src, out);
                resolve(true);
            } else {
                resolve(false);
            }
        } catch (error) {
            reject(error);
        }
    });
}


module.exports = {
    // File counting
    countFilesInDirectory,
    // Copy operations
    copyDirectory,
    copyDirectoryQueue,
    copyFile,
    syncCopy,
    putCopyTask,
};
    