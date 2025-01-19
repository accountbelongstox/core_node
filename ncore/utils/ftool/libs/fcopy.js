const fs = require('fs');
const path = require('path');
let log;
try {
    const logger = require('#@logger');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args),
        progressBar: (current, total, options) => logger.progressBar(current, total, options)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args),
        progressBar: (current, total, options) => `Progress: ${current / total * 100}%` 
    };
}

async function deleteFile(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            await fs.promises.unlink(filePath);
            log.info(`Removed source file: ${filePath}`);
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
        }else{
            log.warn(`Target file exists and replace is false: ${targetPath}`);
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
    try{
        if (removeSource) {
            deleteFile(sourcePath);
        }
    }catch(e){
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
        log.warn(`Target file exists and replace is false: ${targetPath}`);
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

module.exports = {
    copyFileToDir,
    copyFileWithPath
};
