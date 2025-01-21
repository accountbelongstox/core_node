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

/**
 * Create directory synchronously
 * @param {string} dir - Directory path to create
 * @returns {boolean} True if directory was created or already exists
 */
function mkdir(dir) {
    try {
        fs.mkdirSync(dir, { recursive: true });
        return true;
    } catch (error) {
        console.error(`Error creating directory ${dir}:`, error.message);
        return false;
    }
}

/**
 * Copy a directory and its contents
 * @param {string} src - Source directory path
 * @param {string} out - Destination directory path
 * @returns {Promise<{destinationPath: string, success: number, usetime: number, fail: number}>} Copy results
 */
async function copyDirectory(src, out) {
    const stats = {
        fileTotal: countFilesInDirectory(src),
        usetime: 0,
        success: 0,
        fail: 0,
        startTime: Date.now()
    };

    const result = await copyDirectoryQueue(src, out, stats);
    const finalStats = {
        destinationPath: out,
        success: stats.success,
        usetime: Date.now() - stats.startTime,
        fail: stats.fail
    };

    if (result.error) {
        return { ...finalStats, error: result.error };
    }
    return finalStats;
}

async function copyDirectoryQueue(sourcePath, destinationPath, stats) {
    if (!fs.existsSync(destinationPath)) {
        if (!mkdir(destinationPath)) {
            return { error: `Failed to create directory: ${destinationPath}` };
        }
    }

    const items = fs.readdirSync(sourcePath);
    for (const item of items) {
        const currentSourcePath = path.join(sourcePath, item);
        const currentDestinationPath = path.join(destinationPath, item);

        try {
            if (fs.statSync(currentSourcePath).isDirectory()) {
                const result = await copyDirectoryQueue(currentSourcePath, currentDestinationPath, stats);
                if (result && result.error) {
                    return result;
                }
            } else {
                const result = await copyFile(currentSourcePath, currentDestinationPath);
                if (result.error) {
                    stats.fail++;
                    console.error(`Error copying ${currentSourcePath}:`, result.error);
                } else {
                    stats.success++;
                }
            }
        } catch (error) {
            stats.fail++;
            console.error(`Error copying ${currentSourcePath}:`, error.message);
        }
    }
    return { success: true };
}

async function copyFile(sourcePath, destinationPath) {
    try {
        if (!fs.existsSync(sourcePath)) {
            return { error: `No such file: ${sourcePath}` };
        }
        const destinationPathDirname = path.dirname(destinationPath);
        fs.mkdirSync(destinationPathDirname, { recursive: true });
        fs.copyFileSync(sourcePath, destinationPath);
        return { success: true, path: destinationPath };
    } catch (error) {
        return { error: error.message };
    }
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
    countFilesInDirectory,
    copyDirectory,
    copyFile,
    mkdir,
    syncCopy,
    putCopyTask
};
    