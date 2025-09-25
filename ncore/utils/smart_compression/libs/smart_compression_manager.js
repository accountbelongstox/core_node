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

const path = require('path');
const fs = require('fs');
const { gdir, isWindows, isLinux, isMac } = require('#@global_vars');

// Fallback logger if not available
let logger, commander, ftools;
try {
    logger = require('#@logger');
} catch (e) {
    logger = console;
}

try {
    commander = require('#@commander');
} catch (e) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    commander = {
        exec: promisify(exec),
        execSync: require('child_process').execSync
    };
}

try {
    ftools = require('#@ftools');
} catch (e) {
    ftools = {
        ensureDirectoryExists: (dirPath) => {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        }
    };
}

class SmartCompressionManager {
    constructor() {
        this.sevenZipPath = this.find7ZipPath();
        this.supportedFormats = {
            compression: ['.7z', '.zip', '.tar', '.gz', '.bz2', '.xz'],
            extraction: ['.7z', '.zip', '.rar', '.tar', '.gz', '.bz2', '.xz', '.cab', '.iso']
        };
    }

    find7ZipPath() {
        const possiblePaths = [];

        if (isWindows) {
            possiblePaths.push(
                path.join(gdir.LANG_COMPILER_DIR, '7z', '7z.exe'),
                path.join('C:', 'Program Files', '7-Zip', '7z.exe'),
                path.join('C:', 'Program Files (x86)', '7-Zip', '7z.exe'),
                '7z.exe'
            );
        } else if (isLinux || isMac) {
            possiblePaths.push(
                path.join(gdir.LANG_COMPILER_DIR, '7z', '7z'),
                '/usr/bin/7z',
                '/usr/local/bin/7z',
                '/opt/7z/7z',
                '7z'
            );
        }

        for (const testPath of possiblePaths) {
            try {
                if (fs.existsSync(testPath)) {
                    logger.info(`Found 7-Zip at: ${testPath}`);
                    return testPath;
                }
            } catch (error) {
                continue;
            }
        }

        try {
            commander.execSync('7z', { stdio: 'ignore' });
            logger.info('Using system 7-Zip from PATH');
            return '7z';
        } catch (error) {
            logger.warn('7-Zip not found in system PATH');
        }

        logger.error('7-Zip not found. Please install 7-Zip or ensure it is in PATH');
        return null;
    }

    async compressFile(task) {
        if (!this.sevenZipPath) {
            throw new Error('7-Zip not available for compression');
        }

        const { sourcePath, targetPath, compressionLevel = 'normal', forceOverwrite = false } = task;

        if (!fs.existsSync(sourcePath)) {
            throw new Error(`Source path does not exist: ${sourcePath}`);
        }

        const finalTargetPath = targetPath || this.generateTargetPath(sourcePath, 'compression');

        if (fs.existsSync(finalTargetPath) && !forceOverwrite) {
            throw new Error(`Target file already exists: ${finalTargetPath}`);
        }

        const compressionLevels = {
            'fastest': '1',
            'fast': '3',
            'normal': '5',
            'maximum': '7',
            'ultra': '9'
        };

        const level = compressionLevels[compressionLevel] || '5';

        const command = `"${this.sevenZipPath}" a -t7z -mx=${level} "${finalTargetPath}" "${sourcePath}"`;

        if (forceOverwrite) {
            command += ' -y';
        }

        logger.info(`Starting compression: ${sourcePath} -> ${finalTargetPath}`);
        logger.info(`Compression level: ${compressionLevel} (${level})`);

        try {
            const result = await commander.exec(command);

            if (fs.existsSync(finalTargetPath)) {
                const originalSize = this.getPathSize(sourcePath);
                const compressedSize = fs.statSync(finalTargetPath).size;
                const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);

                logger.success(`Compression completed successfully`);
                logger.info(`Original size: ${this.formatSize(originalSize)}`);
                logger.info(`Compressed size: ${this.formatSize(compressedSize)}`);
                logger.info(`Compression ratio: ${compressionRatio}%`);

                return {
                    success: true,
                    sourcePath,
                    targetPath: finalTargetPath,
                    originalSize,
                    compressedSize,
                    compressionRatio: parseFloat(compressionRatio),
                    output: result.stdout
                };
            } else {
                throw new Error('Compression completed but target file not found');
            }
        } catch (error) {
            logger.error(`Compression failed: ${error.message}`);
            throw error;
        }
    }

    async extractFile(task) {
        if (!this.sevenZipPath) {
            throw new Error('7-Zip not available for extraction');
        }

        const { archivePath, targetPath, forceOverwrite = false } = task;

        if (!fs.existsSync(archivePath)) {
            throw new Error(`Archive file does not exist: ${archivePath}`);
        }

        const finalTargetPath = targetPath || this.generateTargetPath(archivePath, 'extraction');

        if (fs.existsSync(finalTargetPath) && !forceOverwrite) {
            throw new Error(`Target directory already exists: ${finalTargetPath}`);
        }

        ftools.ensureDirectoryExists(finalTargetPath);

        let command = `"${this.sevenZipPath}" x "${archivePath}" -o"${finalTargetPath}"`;

        if (forceOverwrite) {
            command += ' -y';
        }

        logger.info(`Starting extraction: ${archivePath} -> ${finalTargetPath}`);

        try {
            const result = await commander.exec(command);

            if (fs.existsSync(finalTargetPath)) {
                const archiveSize = fs.statSync(archivePath).size;
                const extractedSize = this.getPathSize(finalTargetPath);

                logger.success(`Extraction completed successfully`);
                logger.info(`Archive size: ${this.formatSize(archiveSize)}`);
                logger.info(`Extracted size: ${this.formatSize(extractedSize)}`);

                return {
                    success: true,
                    archivePath,
                    targetPath: finalTargetPath,
                    archiveSize,
                    extractedSize,
                    output: result.stdout
                };
            } else {
                throw new Error('Extraction completed but target directory not found');
            }
        } catch (error) {
            logger.error(`Extraction failed: ${error.message}`);
            throw error;
        }
    }

    generateTargetPath(sourcePath, operation) {
        const parsedPath = path.parse(sourcePath);

        if (operation === 'compression') {
            return path.join(parsedPath.dir, `${parsedPath.name}.7z`);
        } else if (operation === 'extraction') {
            return path.join(parsedPath.dir, parsedPath.name);
        }

        throw new Error(`Unknown operation: ${operation}`);
    }

    getPathSize(targetPath) {
        try {
            const stats = fs.statSync(targetPath);
            if (stats.isFile()) {
                return stats.size;
            } else if (stats.isDirectory()) {
                return this.getDirectorySize(targetPath);
            }
        } catch (error) {
            logger.warn(`Failed to get size for: ${targetPath}`);
            return 0;
        }
        return 0;
    }

    getDirectorySize(dirPath) {
        let totalSize = 0;
        try {
            const items = fs.readdirSync(dirPath);
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stats = fs.statSync(itemPath);
                if (stats.isFile()) {
                    totalSize += stats.size;
                } else if (stats.isDirectory()) {
                    totalSize += this.getDirectorySize(itemPath);
                }
            }
        } catch (error) {
            logger.warn(`Failed to calculate directory size: ${dirPath}`);
        }
        return totalSize;
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    isFormatSupported(filePath, operation) {
        const ext = path.extname(filePath).toLowerCase();
        return this.supportedFormats[operation].includes(ext);
    }

    get7ZipPath() {
        return this.sevenZipPath;
    }
}

module.exports = SmartCompressionManager;
