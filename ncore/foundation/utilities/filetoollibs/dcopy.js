// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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

async function copyDirectory(src, out) {
    const stats = {
        src,
        out,
        fileTotal: countFilesInDirectory(src),
        usetime: 0,
        success: 0,
        skipped: 0,
        fail: 0,
        startTime: Date.now()
    };

    const result = await copyDirectoryQueue(src, out, stats);
    stats.usetime = Date.now() - stats.startTime;

    if (result.error) {
        return { ...stats, error: result.error };
    }
    return stats;
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
                if (result.success) {
                    if (!stats.success) stats.success = 0
                    stats.success++;
                } else if (result.skipped) {
                    if (!stats.skipped) stats.skipped = 0
                    stats.skipped++;
                } else {
                    console.error(`Error copying ${currentSourcePath}:`, result.error);
                    if (!stats.fail) stats.fail = 0
                    stats.fail++;
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
        // Check if source exists
        if (!fs.existsSync(sourcePath)) {
            return { error: `No such file: ${sourcePath}` };
        }

        // Check if destination exists
        if (fs.existsSync(destinationPath)) {
            try {
                const sourceStats = fs.statSync(sourcePath);
                const destinationStats = fs.statSync(destinationPath);

                // If sizes match, skip copying
                if (sourceStats.size === destinationStats.size) {
                    return {
                        success: true,
                        path: destinationPath,
                        skipped: true,
                        message: 'File already exists with same size - skipped'
                    };
                }
            } catch (e) {
                // If we can't check sizes, continue with copying
                console.warn(`Could not compare file sizes: ${e.message}`);
            }
        }

        // Create destination directory if needed
        const destinationPathDirname = path.dirname(destinationPath);
        if (!fs.existsSync(destinationPathDirname)) {
            fs.mkdirSync(destinationPathDirname, { recursive: true });
        }

        // Perform the copy
        fs.copyFileSync(sourcePath, destinationPath);

        return {
            success: true,
            path: destinationPath,
            copied: true
        };
    } catch (error) {
        return {
            error: error.message,
            details: error
        };
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
