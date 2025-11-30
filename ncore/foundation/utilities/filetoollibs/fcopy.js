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
const { isDebug } = require('#@global_vars');
const fs_promises = require('fs').promises;
let log;
try {
    const logger = require('#@logger');
    log = logger;
} catch (error) {
    log = {
        info: (...args) => log.debug('[INFO]', ...args),
        warn: (...args) => log.debug('[WARN]', ...args),
        error: (...args) => log.error('[ERROR]', ...args),
        success: (...args) => log.debug('[SUCCESS]', ...args),
        progressBar: (current, total, options) => `Progress: ${current / total * 100}%`,
        debug: (...args) => isDebug && log.debug('[DEBUG]', ...args),
    };
}

async function deleteFile(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            await fs.promises.unlink(filePath);
            log.debug(`Removed source file: ${filePath}`);
        } catch (removeError) {
            log.error(`Failed to remove source file: ${filePath}`, removeError);
        }
    }
}

async function copyFileToDir(sourcePath, targetDir, replace = false, removeSource = false) {
    if (!fs.existsSync(sourcePath)) {
        log.error(`Source file not found: ${sourcePath}`);
        return null;
    }

    const sourceStats = fs.statSync(sourcePath);
    if (!sourceStats.isFile()) {
        log.error(`Source is not a file: ${sourcePath}`);
        return null;
    }

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const fileName = path.basename(sourcePath);
    const targetPath = path.join(targetDir, fileName);

    if (fs.existsSync(targetPath)) {
        const targetStats = fs.statSync(targetPath);
        if (targetStats.size === 0 || replace) {
            try {
                deleteFile(sourcePath);
            } catch (error) {
                log.error(`Copy-Replace to copy file: ${error.message}`);
            }
        } else {
            log.debug(`Target file exists and replace is false: ${targetPath}`);
        }
    }

    let result = null
    if (!fs.existsSync(targetPath)) {
        try {
            await fs.promises.copyFile(sourcePath, targetPath);

            result = targetPath;
        } catch (error) {
            log.error(`Failed to copy file: ${error.message}`);
        }
    }
    try {
        if (removeSource) {
            deleteFile(sourcePath);
        }
    } catch (e) {
        log.error(`Copy-removeSource: ${e.message}`);
    }
    return result
}

async function copyFileWithPath(sourcePath, targetPath, replace = false, removeSource = false) {
    if (!fs.existsSync(sourcePath)) {
        log.error(`Source file not found: ${sourcePath}`);
        return null;
    }

    const sourceStats = fs.statSync(sourcePath);
    if (!sourceStats.isFile()) {
        log.error(`Source is not a file: ${sourcePath}`);
        return null;
    }

    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    if (fs.existsSync(targetPath)) {
        const targetStats = fs.statSync(targetPath);
        if (targetStats.size === 0 || replace) {
            try {
                await fs.promises.copyFile(sourcePath, targetPath);
                if (removeSource) {
                    deleteFile(sourcePath);
                }
                return targetPath;
            } catch (error) {
                log.error(`Failed to copy file: ${error.message}`);
                return null;
            }
        }
        log.debug(`Target file exists and replace is false: ${targetPath}`);
        return null;
    }

    try {
        await fs.promises.copyFile(sourcePath, targetPath);
        if (removeSource) {
            deleteFile(sourcePath);
        }
        return targetPath;
    } catch (error) {
        log.error(`Failed to copy file: ${error.message}`);
        return null;
    }
}


async function CopyFile(srcPath, destPath) {
    try {
        const destDir = path.dirname(destPath);
        await fs_promises.mkdir(destDir, { recursive: true });

        const srcStat = await fs_promises.stat(srcPath);
        if (!srcStat.isFile()) {
            log.error(`Source is not a file: ${srcPath}`);
            return false; // Skip this file but continue
        }

        try {
            const destStat = await fs_promises.stat(destPath);
            // If destination exists and is a file with same size, skip
            if (destStat.isFile() && destStat.size === srcStat.size) {
                log.debug(`Skipping (same size): ${destPath}`);
                return false;
            }
        } catch (destErr) {
            // Destination doesn't exist or can't be accessed - proceed with copy
        }

        // Copy the file
        await fs_promises.copyFile(srcPath, destPath);
        log.debug(`Copied: ${destPath}`);
        return true;
    } catch (err) {
        if (err.code !== 'ENOENT') { // Don't log for missing files (already logged in stat)
            log.error(`Error copying ${srcPath} to ${destPath}:`, err.message);
        }
        return false; // Skip this file but continue
    }
}

/**
 * Copy an entire directory recursively
 * @param {string} srcDir - Source directory path
 * @param {string} destDir - Destination directory path
 */
async function CopyDir(srcDir, destDir) {
    try {
        const srcStat = await fs_promises.stat(srcDir);
        if (!srcStat.isDirectory()) {
            log.error(`Source is not a directory: ${srcDir}`);
            return; // Skip this directory but continue
        }

        await fs_promises.mkdir(destDir, { recursive: true });

        const files = await fs_promises.readdir(srcDir);
        await Promise.all(files.map(async (file) => {
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);

            try {
                const stat = await fs_promises.stat(srcPath);
                if (stat.isDirectory()) {
                    // Recursively copy subdirectory
                    await CopyDir(srcPath, destPath);
                } else {
                    // Copy file
                    await CopyFile(srcPath, destPath);
                }
            } catch (statErr) {
                log.error(`Cannot stat ${srcPath}:`, statErr.message);
            }
        }));
    } catch (err) {
        if (err.code === 'ENOENT') {
            log.error(`Cannot read source directory ${srcDir}:`, err.message);
        } else {
            throw err; // Re-throw more serious errors
        }
    }
}

async function Copy(src, dest) {
    try {
        const stats = await fs_promises.stat(src);
        if (stats.isDirectory()) {
            log.debug(`Detected directory, copying recursively: ${src}`);
            await CopyDir(src, dest);
        } else if (stats.isFile()) {
            log.debug(`Detected file, copying: ${src}`);
            await CopyFile(src, dest);
        } else {
            log.error(`Source is neither file nor directory: ${src}`);
        }
    } catch (err) {
        log.error(`Cannot read source ${src}:`, err.message);
    }
}

module.exports = {
    copyFileToDir,
    copyFileWithPath,
    CopyFile,
    CopyDir,
    Copy,
};
