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
const crypto = require('crypto');
const logger = require('#@logger');

/**
 * Normalize path for cross-platform and UTF-8 support
 * @param {string} filePath - Path to normalize
 * @returns {string} - Normalized path
 */
function normalizePath(filePath) {
    const absolutePath = path.resolve(filePath);
    return Buffer.from(absolutePath).toString('utf8');
}

/**
 * Safe file operations with UTF-8 support
 */
class FileOperations {
    /**
     * Get cache directory path
     * @param {string} rootDir - Root directory
     * @param {string} [customCacheDir=null] - Optional custom cache directory
     * @returns {string} Cache directory path
     */
    static getCacheDir(rootDir, customCacheDir = null) {
        return customCacheDir || path.join(rootDir, '.vcache');
    }

    /**
     * Initialize cache system
     * @param {string} rootDir - Root directory
     * @param {string} [customCacheDir=null] - Optional custom cache directory
     * @returns {Object} Cache system information
     */
    static initializeCache(rootDir, customCacheDir = null) {
        const cacheDir = this.getCacheDir(rootDir, customCacheDir);
        const dirs = {
            cache: cacheDir,
            temp: path.join(cacheDir, 'temp'),
            completed: path.join(cacheDir, 'completed'),
            deleted: path.join(cacheDir, '.delete')
        };

        // Create all required directories
        Object.values(dirs).forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                logger.info(`Created directory: ${dir}`);
            }
        });

        // Initialize or load database
        const dbFile = path.join(cacheDir, 'video-compression-db.json');
        let db = {};
        
        if (fs.existsSync(dbFile)) {
            try {
                const data = fs.readFileSync(dbFile, 'utf8');
                db = JSON.parse(data);
                logger.info(`Loaded existing database from: ${dbFile}`);
            } catch (error) {
                logger.error(`Error loading database: ${error.message}`);
                logger.info('Continuing with empty database');
            }
        }

        return { dirs, db, dbFile };
    }

    /**
     * Save database
     * @param {string} dbFile - Database file path
     * @param {Object} db - Database object
     */
    static saveDatabase(dbFile, db) {
        try {
            fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
        } catch (error) {
            logger.error(`Error saving database: ${error.message}`);
        }
    }

    /**
     * Find all video files recursively in a directory
     * @param {string} dir - Directory to search
     * @param {Set<string>} videoExtensions - Set of video file extensions
     * @returns {string[]} Array of video file paths
     */
    static findVideoFiles(dir, videoExtensions) {
        let results = [];
        try {
            const normalizedDir = normalizePath(dir);
            const list = fs.readdirSync(normalizedDir, { encoding: 'utf8' });
            
            for (const file of list) {
                const fullPath = path.join(normalizedDir, file);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory() && !file.startsWith('.')) {
                    results = results.concat(this.findVideoFiles(fullPath, videoExtensions));
                } else {
                    const ext = path.extname(file).toLowerCase();
                    if (videoExtensions.has(ext)) {
                        results.push(fullPath);
                    }
                }
            }
        } catch (error) {
            logger.error(`Error scanning directory ${dir}: ${error.message}`);
            throw error;
        }
        
        return results;
    }

    /**
     * Generate file hash for identification
     * @param {string} filePath - Path to file
     * @returns {string} File hash
     */
    static getFileHash(filePath) {
        try {
            const fileBuffer = fs.readFileSync(normalizePath(filePath));
            const hashSum = crypto.createHash('sha256');
            hashSum.update(fileBuffer);
            return hashSum.digest('hex');
        } catch (error) {
            logger.error(`Error generating hash for file ${filePath}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Copy file to completed directory, maintaining file integrity
     * @param {string} sourcePath - Source file path
     * @param {string} completedDir - Completed directory path
     * @param {string} fileHash - File hash for naming
     * @returns {string} Path in completed directory
     */
    static async copyToCompleted(sourcePath, completedDir, fileHash) {
        const normalizedSource = normalizePath(sourcePath);
        const fileExt = path.extname(sourcePath);
        const completedPath = path.join(completedDir, `${fileHash}${fileExt}`);
        const normalizedCompleted = normalizePath(completedPath);

        // Check if file already exists in completed directory
        if (fs.existsSync(normalizedCompleted)) {
            const sourceSize = fs.statSync(normalizedSource).size;
            const completedSize = fs.statSync(normalizedCompleted).size;

            if (sourceSize === completedSize) {
                logger.info(`File already exists in completed directory with same size: ${completedPath}`);
                return completedPath;
            }
        }

        // Copy file to completed directory
        try {
            await fs.promises.copyFile(normalizedSource, normalizedCompleted);
            logger.info(`Successfully copied to completed directory: ${completedPath}`);
            return completedPath;
        } catch (error) {
            logger.error(`Error copying to completed directory: ${error.message}`);
            throw error;
        }
    }

    /**
     * Replace original file with completed file, preserving original in .delete directory
     * @param {string} originalPath - Original file path
     * @param {string} completedPath - Completed file path
     * @param {string} rootDir - Root directory
     * @param {string} deleteDir - Delete directory path
     * @returns {boolean} Success status
     */
    static async replaceWithCompleted(originalPath, completedPath, rootDir, deleteDir) {
        const normalizedOriginal = normalizePath(originalPath);
        const normalizedCompleted = normalizePath(completedPath);
        const relativePath = path.relative(rootDir, originalPath);
        const deletePath = path.join(deleteDir, relativePath);
        const backupPath = `${normalizedOriginal}.bak`;

        try {
            // Create directory structure in delete folder
            await fs.promises.mkdir(path.dirname(deletePath), { recursive: true });

            // Backup original file
            await fs.promises.rename(normalizedOriginal, backupPath);

            try {
                // Copy completed file to original location
                await fs.promises.copyFile(normalizedCompleted, normalizedOriginal);

                // Move backup to delete directory
                await fs.promises.rename(backupPath, deletePath);

                logger.info(`Successfully replaced original file: ${originalPath}`);
                logger.info(`Original file moved to: ${deletePath}`);
                return true;
            } catch (error) {
                // If error occurs during copy, restore original file
                if (fs.existsSync(backupPath)) {
                    await fs.promises.rename(backupPath, normalizedOriginal);
                }
                throw error;
            }
        } catch (error) {
            logger.error(`Error replacing file: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get file size
     * @param {string} filePath - Path to file
     * @returns {number} File size in bytes
     */
    static getFileSize(filePath) {
        try {
            return fs.statSync(normalizePath(filePath)).size;
        } catch (error) {
            logger.error(`Error getting file size: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check video file status
     * @param {string} videoPath - Original video path
     * @param {string} rootDir - Root directory
     * @param {Object} cacheInfo - Cache information
     * @param {boolean} [skipSizeCalculation=false] - Skip file size calculations
     * @returns {Promise<Object>} Video status object
     */
    static async checkVideoStatus(videoPath, rootDir, cacheInfo, skipSizeCalculation = false) {
        const { dirs, db } = cacheInfo;
        const relativePath = path.relative(rootDir, videoPath);
        const fileHash = this.getFileHash(videoPath);
        const fileExt = path.extname(videoPath);

        // Calculate paths
        const tempPath = path.join(dirs.temp, `${fileHash}${fileExt}`);
        const completedPath = path.join(dirs.completed, `${fileHash}${fileExt}`);
        const deletePath = path.join(dirs.deleted, relativePath);

        // Check database status
        const dbEntry = db[relativePath];
        const isInDatabase = dbEntry && dbEntry.hash === fileHash;

        // Check file existence
        const originalExists = fs.existsSync(videoPath);
        const tempExists = fs.existsSync(tempPath);
        const completedExists = fs.existsSync(completedPath);
        const deleteExists = fs.existsSync(deletePath);

        // Initialize sizes as null if skipping calculation
        const sizes = skipSizeCalculation ? {
            original: null,
            temp: null,
            completed: null,
            deleted: null
        } : {
            original: originalExists ? this.getFileSize(videoPath) : 0,
            temp: tempExists ? this.getFileSize(tempPath) : 0,
            completed: completedExists ? this.getFileSize(completedPath) : 0,
            deleted: deleteExists ? this.getFileSize(deletePath) : 0
        };

        // Check if completed file is valid (same size as original or delete)
        const isCompletedValid = skipSizeCalculation ? false : (
            completedExists && 
            ((originalExists && sizes.completed === sizes.original) || 
             (deleteExists && sizes.completed === sizes.deleted))
        );

        // Check if temp file is valid
        const isTempValid = skipSizeCalculation ? false : (
            tempExists && 
            ((originalExists && sizes.temp === sizes.original) || 
             (deleteExists && sizes.temp === sizes.deleted))
        );

        return {
            originalPath: videoPath,
            relativePath,
            fileHash,
            paths: {
                original: videoPath,
                temp: tempPath,
                completed: completedPath,
                deleted: deletePath
            },
            exists: {
                original: originalExists,
                temp: tempExists,
                completed: completedExists,
                deleted: deleteExists
            },
            sizes,
            status: {
                isInDatabase,
                isCompletedValid,
                isTempValid,
                isFullyProcessed: isInDatabase && isCompletedValid && deleteExists,
                needsProcessing: !isInDatabase || !isCompletedValid,
                isPartiallyProcessed: (tempExists || completedExists) && !isInDatabase,
                isDeletedProperly: deleteExists && !originalExists && isCompletedValid
            },
            dbInfo: dbEntry || null
        };
    }

    /**
     * Calculate file sizes for a video status object
     * @param {Object} videoStatus - Video status object
     * @returns {Object} Updated video status object with calculated sizes
     */
    static calculateFileSizes(videoStatus) {
        const { paths, exists } = videoStatus;
        
        // Calculate sizes
        const sizes = {
            original: exists.original ? this.getFileSize(paths.original) : 0,
            temp: exists.temp ? this.getFileSize(paths.temp) : 0,
            completed: exists.completed ? this.getFileSize(paths.completed) : 0,
            deleted: exists.deleted ? this.getFileSize(paths.deleted) : 0
        };

        // Update status checks that depend on sizes
        const isCompletedValid = exists.completed && 
            ((exists.original && sizes.completed === sizes.original) || 
             (exists.deleted && sizes.completed === sizes.deleted));

        const isTempValid = exists.temp && 
            ((exists.original && sizes.temp === sizes.original) || 
             (exists.deleted && sizes.temp === sizes.deleted));

        // Return updated status object
        return {
            ...videoStatus,
            sizes,
            status: {
                ...videoStatus.status,
                isCompletedValid,
                isTempValid,
                isFullyProcessed: videoStatus.status.isInDatabase && isCompletedValid && exists.deleted,
                needsProcessing: !videoStatus.status.isInDatabase || !isCompletedValid,
                isDeletedProperly: exists.deleted && !exists.original && isCompletedValid
            }
        };
    }

    /**
     * Get status summary string
     * @param {Object} status - Video status object
     * @returns {string} Status summary
     */
    static getStatusSummary(status) {
        const lines = [
            `File: ${status.relativePath}`,
            `Hash: ${status.fileHash}`,
            '\nLocations:',
            `  Original: ${status.exists.original ? '✓' : '✗'} ${status.paths.original}`,
            `  Temp: ${status.exists.temp ? '✓' : '✗'} ${status.paths.temp}`,
            `  Completed: ${status.exists.completed ? '✓' : '✗'} ${status.paths.completed}`,
            `  Deleted: ${status.exists.deleted ? '✓' : '✗'} ${status.paths.deleted}`,
            '\nSizes:',
            `  Original: ${(status.sizes.original / 1024 / 1024).toFixed(2)} MB`,
            `  Temp: ${(status.sizes.temp / 1024 / 1024).toFixed(2)} MB`,
            `  Completed: ${(status.sizes.completed / 1024 / 1024).toFixed(2)} MB`,
            `  Deleted: ${(status.sizes.deleted / 1024 / 1024).toFixed(2)} MB`,
            '\nStatus:',
            `  In Database: ${status.status.isInDatabase ? '✓' : '✗'}`,
            `  Completed Valid: ${status.status.isCompletedValid ? '✓' : '✗'}`,
            `  Temp Valid: ${status.status.isTempValid ? '✓' : '✗'}`,
            `  Fully Processed: ${status.status.isFullyProcessed ? '✓' : '✗'}`,
            `  Needs Processing: ${status.status.needsProcessing ? '✓' : '✗'}`,
            `  Partially Processed: ${status.status.isPartiallyProcessed ? '✓' : '✗'}`,
            `  Properly Deleted: ${status.status.isDeletedProperly ? '✓' : '✗'}`
        ];

        if (status.dbInfo) {
            lines.push(
                '\nDatabase Info:',
                `  Processed At: ${status.dbInfo.processedAt}`,
                `  Original Size: ${(status.dbInfo.originalSize / 1024 / 1024).toFixed(2)} MB`,
                `  Compressed Size: ${(status.dbInfo.compressedSize / 1024 / 1024).toFixed(2)} MB`,
                `  Compression Ratio: ${status.dbInfo.compressionRatio}`
            );
        }

        return lines.join('\n');
    }
}

module.exports = {
    FileOperations,
    normalizePath
}; 