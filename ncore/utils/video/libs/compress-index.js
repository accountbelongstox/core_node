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

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const logger = require('#@logger');
const ffmpegSetup = require('./ffmpegSetupBywin');
const VideoCompressor = require('./videoCompressor');
const { FileOperations } = require('./video-file-operations');

// Supported video extensions
const VIDEO_EXTENSIONS = new Set([
    '.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm'
]);

class VideoProcessor {
    constructor(rootDir, cacheDir = null) {
        this.rootDir = rootDir;
        this.cacheDir = cacheDir;
        this.videoExtensions = VIDEO_EXTENSIONS;
        this.cacheInfo = null;
        this.ffmpegPath = null;
    }

    /**
     * Initialize the processor
     */
    async initialize() {
        // Get FFmpeg path
        this.ffmpegPath = await ffmpegSetup.getFFmpegPath();
        
        // Initialize cache system
        this.cacheInfo = FileOperations.initializeCache(this.rootDir, this.cacheDir);
        
        logger.info(`Video processor initialized`);
        logger.info(`Root directory: ${this.rootDir}`);
        logger.info(`Cache directory: ${this.cacheInfo.dirs.cache}`);
        logger.info(`Supported extensions: ${Array.from(this.videoExtensions).join(', ')}`);
    }
/**
 * Step 1: Print current file processing information
 * @param {Object} videoStatus - Video status object
 * @param {number} currentIndex - Current file index
 * @param {number} totalFiles - Total number of files
     * @returns {number} Original file size
 */
    printFileInfo(videoStatus, currentIndex, totalFiles) {
    const originalSize = videoStatus.sizes.original || videoStatus.sizes.deleted;
    
    logger.info('\n=== Processing Video File ===');
    logger.info(`Progress: ${currentIndex}/${totalFiles}`);
    logger.info(`File: ${videoStatus.relativePath}`);
    logger.info(`Size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    
        return originalSize;
}

/**
 * Step 2: Check and print database status
 * @param {Object} videoStatus - Video status object
     * @returns {boolean} Whether file needs processing
 */
    checkDatabaseStatus(videoStatus) {
    const { status } = videoStatus;
    
    if (status.isInDatabase) {
            const dbEntry = this.cacheInfo.db[videoStatus.relativePath];
        logger.info('\nFile found in database:');
        logger.info(`  Processed at: ${dbEntry.processedAt}`);
        logger.info(`  Original size: ${(dbEntry.originalSize / 1024 / 1024).toFixed(2)} MB`);
        logger.info(`  Compressed size: ${(dbEntry.compressedSize / 1024 / 1024).toFixed(2)} MB`);
        logger.info(`  Compression ratio: ${dbEntry.compressionRatio}`);
        
        if (!status.needsProcessing) {
            logger.info(`\nSkipping already processed file: ${videoStatus.relativePath}`);
            return false;
        }
    } else {
        logger.info('\nFile not found in database, will process');
    }
    
    return true;
}

    /**
     * Step 3: Check and handle temp directory operations
     * @param {Object} videoStatus - Video status object
     * @returns {boolean} Whether the file is ready in temp directory
     */
    async checkAndHandleTempFile(videoStatus) {
    const { paths, status } = videoStatus;
    
        if (status.isTempValid) {
            logger.info('\nFile already exists in temp directory with correct size');
            logger.info(`Temp path: ${paths.temp}`);
            return true;
        }

        logger.info('\nFile not found in temp directory or size mismatch');
        logger.info('Copying to temp directory...');
        
        try {
            const startTime = Date.now();
            await FileOperations.copyToCompleted(
                paths.original, 
                path.dirname(paths.temp), 
                videoStatus.fileHash
            );
            const endTime = Date.now();
            
            logger.success(`Successfully copied to temp directory in ${((endTime - startTime) / 1000).toFixed(2)}s`);
            logger.info(`Temp path: ${paths.temp}`);
            return true;
        } catch (error) {
            logger.error(`Failed to copy to temp directory: ${error.message}`);
            return false;
        }
    }

    /**
     * Step 4: Compress video file and verify results
     * @param {Object} videoStatus - Video status object
     * @returns {Object} Compression results
     */
    async compressAndVerifyVideo(videoStatus) {
        const { paths, status } = videoStatus;
        
        if (status.isCompletedValid) {
            logger.info('\nCompressed file already exists and is valid');
            logger.info(`Compressed path: ${paths.completed}`);
            return {
                success: true,
                originalSize: videoStatus.sizes.original || videoStatus.sizes.deleted,
                compressedSize: videoStatus.sizes.completed,
                timeTaken: 0
            };
        }

        logger.info('\nStarting video compression...');
        const startTime = Date.now();
        
        try {
            await VideoCompressor.compressVideo(paths.temp, paths.completed);
            const endTime = Date.now();
            
            if (!fs.existsSync(paths.completed)) {
                throw new Error('Compressed file was not created');
            }

            const originalSize = videoStatus.sizes.original || videoStatus.sizes.deleted;
            const compressedSize = FileOperations.getFileSize(paths.completed);
            const timeTaken = (endTime - startTime) / 1000;
            const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);

            logger.success('\nCompression completed successfully:');
            logger.info(`Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
            logger.info(`Compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`);
            logger.info(`Compression ratio: ${compressionRatio}%`);
            logger.info(`Time taken: ${timeTaken.toFixed(2)}s`);

            return {
                success: true,
                originalSize,
                compressedSize,
                timeTaken,
                compressionRatio
            };
        } catch (error) {
            logger.error(`Compression failed: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Step 5: Backup original file to .delete directory
     * @param {Object} videoStatus - Video status object
     * @returns {Object} Backup results
     */
    async backupOriginalFile(videoStatus) {
        const { paths, status } = videoStatus;
        
        if (status.isDeletedProperly) {
            logger.info('\nOriginal file already backed up properly');
            logger.info(`Backup path: ${paths.deleted}`);
            return {
                success: true,
                backupPath: paths.deleted
            };
        }

        logger.info('\nBacking up original file...');
        const startTime = Date.now();
        
        try {
            await FileOperations.replaceWithCompleted(
                paths.original,
                paths.completed,
                this.rootDir,
                path.dirname(paths.deleted)
            );
            const endTime = Date.now();

            logger.success(`Successfully backed up original file in ${((endTime - startTime) / 1000).toFixed(2)}s`);
            logger.info(`Backup path: ${paths.deleted}`);
            
            return {
                success: true,
                backupPath: paths.deleted,
                timeTaken: (endTime - startTime) / 1000
            };
        } catch (error) {
            logger.error(`Failed to backup original file: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Step 6: Replace original file and update database
     * @param {Object} videoStatus - Video status object
     * @param {Object} compressionResult - Results from compression
     * @returns {Object} Replacement results
     */
    async replaceAndUpdateDb(videoStatus, compressionResult) {
        const { paths } = videoStatus;
        
        try {
            // Update database entry
            this.cacheInfo.db[videoStatus.relativePath] = {
            hash: videoStatus.fileHash,
            processedAt: new Date().toISOString(),
                originalSize: compressionResult.originalSize,
                compressedSize: compressionResult.compressedSize,
                compressionRatio: compressionResult.compressionRatio + '%'
        };
    
        // Save database
            FileOperations.saveDatabase(this.cacheInfo.dbFile, this.cacheInfo.db);
            
            logger.success('\nFile processing completed:');
            logger.info(`Original file backed up to: ${paths.deleted}`);
            logger.info(`Compressed file at: ${paths.original}`);
            logger.info(`Original size: ${(compressionResult.originalSize / 1024 / 1024).toFixed(2)} MB`);
            logger.info(`Final size: ${(compressionResult.compressedSize / 1024 / 1024).toFixed(2)} MB`);
            logger.info(`Compression ratio: ${compressionResult.compressionRatio}%`);
            logger.info(`Total time: ${compressionResult.timeTaken.toFixed(2)}s`);
        
        return {
                success: true,
                dbEntry: this.cacheInfo.db[videoStatus.relativePath]
            };
    } catch (error) {
            logger.error(`Failed to update database: ${error.message}`);
        return {
                success: false,
            error: error.message
        };
    }
}

    /**
     * Process a single video file
     * @param {Object} videoStatus - Video status object
     * @param {number} currentIndex - Current file index
     * @param {number} totalFiles - Total number of files
     */
    async processFile(videoStatus, currentIndex, totalFiles) {
        // Calculate file sizes before processing
        videoStatus = FileOperations.calculateFileSizes(videoStatus);
        
        // Step 1: Print current file information
        const originalSize = this.printFileInfo(videoStatus, currentIndex, totalFiles);
        
        // Step 2: Check database status
        if (!this.checkDatabaseStatus(videoStatus)) {
            return {
                status: 'skipped',
                reason: 'already_processed'
            };
        }

        // Step 3: Handle temp directory operations
        if (!await this.checkAndHandleTempFile(videoStatus)) {
            return {
                status: 'error',
                reason: 'temp_copy_failed'
            };
        }

        // Step 4: Compress video
        const compressionResult = await this.compressAndVerifyVideo(videoStatus);
        if (!compressionResult.success) {
            return {
                status: 'error',
                reason: 'compression_failed',
                error: compressionResult.error
            };
        }

        // Step 5: Backup original file
        const backupResult = await this.backupOriginalFile(videoStatus);
        if (!backupResult.success) {
            return {
                status: 'error',
                reason: 'backup_failed',
                error: backupResult.error
            };
        }

        // Step 6: Replace and update database
        const updateResult = await this.replaceAndUpdateDb(videoStatus, compressionResult);
        if (!updateResult.success) {
            return {
                status: 'error',
                reason: 'update_failed',
                error: updateResult.error
            };
        }

        return {
            status: 'success',
            originalSize: compressionResult.originalSize,
            compressedSize: compressionResult.compressedSize,
            compressionRatio: compressionResult.compressionRatio,
            timeTaken: compressionResult.timeTaken,
            backupPath: backupResult.backupPath,
            dbEntry: updateResult.dbEntry
        };
    }

    /**
     * Process all video files in the directory
     */
    async processAllFiles() {
        try {
        // Find all video files
            const videoFiles = FileOperations.findVideoFiles(this.rootDir, this.videoExtensions);
        logger.info(`Found ${videoFiles.length} video files`);

        // Process results
        const results = {
                total: videoFiles.length,
            processed: 0,
            skipped: 0,
            errors: 0,
            totalSaved: 0
        };
        // Process each video file
            for (let i = 0; i < videoFiles.length; i++) {
                const status = await FileOperations.checkVideoStatus(videoFiles[i], this.rootDir, this.cacheInfo, true);
                const result = await this.processFile(status, i + 1, videoFiles.length);
            switch (result.status) {
                case 'success':
                    results.processed++;
                    results.totalSaved += (result.originalSize - result.compressedSize);
                    break;
                case 'skipped':
                    results.skipped++;
                    break;
                case 'error':
                    results.errors++;
                    break;
            }
        }

        return {
            success: true,
            results,
                cacheDir: this.cacheInfo.dirs.cache,
                dbFile: this.cacheInfo.dbFile
        };
    } catch (error) {
        logger.error('Fatal error:', error);
        return {
            success: false,
            error: error.message
        };
    }
    }
}

// Main function to start processing
async function compressVideos(rootDir, cacheDir = null) {
    const processor = new VideoProcessor(rootDir, cacheDir);
    await processor.initialize();
    return processor.processAllFiles();
}

module.exports = {
    compressVideos,
    VideoProcessor,
    VIDEO_EXTENSIONS,
    // Export UTF-8 safe functions for external use
};