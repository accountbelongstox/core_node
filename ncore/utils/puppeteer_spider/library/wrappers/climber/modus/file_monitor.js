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

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('#@logger');

// Declare variables
const homeDir = os.homedir();
const defaultDownloadDirs = [
    path.join(homeDir, 'Downloads'),
    path.join(homeDir, 'downloads'),
    path.join(homeDir, 'Desktop'),
    '/tmp/downloads'
];

class FileMonitor {
    constructor() {
        this.downloadDirs = [...defaultDownloadDirs];
        this.pollInterval = 2000; // 2 seconds
        this.maxWaitTime = 300000; // 5 minutes
        this.stableTime = 3000; // 3 seconds
        this.minFileSize = 1024 * 1024; // 1MB
    }

    // Add custom download directory
    addDownloadDir(dir) {
        if (fs.existsSync(dir) && !this.downloadDirs.includes(dir)) {
            this.downloadDirs.push(dir);
            logger.info(`Added download directory: ${dir}`);
        }
    }

    // Set monitoring configuration
    setConfig(config) {
        if (config.pollInterval) this.pollInterval = config.pollInterval;
        if (config.maxWaitTime) this.maxWaitTime = config.maxWaitTime;
        if (config.stableTime) this.stableTime = config.stableTime;
        if (config.minFileSize) this.minFileSize = config.minFileSize;
        if (config.downloadDirs) this.downloadDirs = [...config.downloadDirs];
    }

    // Find files matching pattern in all download directories
    findFilesByPattern(pattern, options = {}) {
        const {
            includePartial = false,
            sortByDate = true,
            maxAge = null
        } = options;

        const matchedFiles = [];
        const now = Date.now();

        for (const dir of this.downloadDirs) {
            if (!fs.existsSync(dir)) {
                continue;
            }

            try {
                const files = fs.readdirSync(dir);
                
                for (const fileName of files) {
                    // Skip backup files (containing numbers in parentheses like (1), (2), etc.)
                    if (fileName.match(/\(\d+\)/)) {
                        continue;
                    }

                    if (pattern.test(fileName)) {
                        const filePath = path.join(dir, fileName);
                        const stats = fs.statSync(filePath);
                        
                        // Check file age if maxAge is specified
                        if (maxAge && (now - stats.mtime.getTime()) > maxAge) {
                            continue;
                        }

                        // Check if file is large enough (not a partial download)
                        if (!includePartial && stats.size < this.minFileSize) {
                            continue;
                        }

                        matchedFiles.push({
                            path: filePath,
                            name: fileName,
                            size: stats.size,
                            modified: stats.mtime,
                            directory: dir
                        });
                    }
                }
            } catch (error) {
                logger.warning(`Cannot read directory ${dir}: ${error.message}`);
            }
        }

        // Sort by modification date (newest first)
        if (sortByDate) {
            matchedFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());
        }

        return matchedFiles;
    }

    // Find the most recent file matching pattern
    findLatestFile(pattern, options = {}) {
        const files = this.findFilesByPattern(pattern, options);
        return files.length > 0 ? files[0] : null;
    }

    // Wait for a file matching pattern to appear
    async waitForFile(pattern, options = {}) {
        const {
            timeout = this.maxWaitTime,
            pollInterval = this.pollInterval,
            stableTime = this.stableTime,
            onProgress = null
        } = options;

        const startTime = Date.now();
        
        logger.info(`Waiting for file matching pattern: ${pattern}`);
        
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                
                // Check timeout
                if (elapsed > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error(`Timeout waiting for file (${timeout}ms)`));
                    return;
                }

                // Progress callback
                if (onProgress) {
                    onProgress(elapsed, timeout);
                }

                // Look for matching files
                const file = this.findLatestFile(pattern, { includePartial: false });
                
                if (file) {
                    // Check if file is stable (not being written to)
                    setTimeout(() => {
                        try {
                            const currentStats = fs.statSync(file.path);
                            if (currentStats.size === file.size && currentStats.size >= this.minFileSize) {
                                clearInterval(checkInterval);
                                logger.info(`File found and stable: ${file.path}`);
                                resolve(file);
                            }
                        } catch (error) {
                            // File might have been moved or deleted, continue waiting
                            logger.warning(`File check error: ${error.message}`);
                        }
                    }, stableTime);
                }
            }, pollInterval);
        });
    }

    // Monitor multiple patterns simultaneously
    async waitForAnyFile(patterns, options = {}) {
        const promises = patterns.map(pattern => 
            this.waitForFile(pattern, options).catch(error => ({ error, pattern }))
        );

        try {
            const result = await Promise.race(promises);
            
            if (result.error) {
                throw result.error;
            }
            
            return result;
        } catch (error) {
            throw new Error(`No files found matching any pattern: ${error.message}`);
        }
    }

    // Check if a specific file exists and is complete
    isFileComplete(filePath, expectedMinSize = this.minFileSize) {
        try {
            if (!fs.existsSync(filePath)) {
                return false;
            }

            const stats = fs.statSync(filePath);
            return stats.size >= expectedMinSize;
        } catch (error) {
            logger.warning(`Error checking file completeness: ${error.message}`);
            return false;
        }
    }

    // Get download directory statistics
    getDownloadStats() {
        const stats = {};
        
        for (const dir of this.downloadDirs) {
            if (!fs.existsSync(dir)) {
                stats[dir] = { exists: false };
                continue;
            }

            try {
                const files = fs.readdirSync(dir);
                let totalSize = 0;
                let fileCount = 0;

                for (const fileName of files) {
                    const filePath = path.join(dir, fileName);
                    const fileStats = fs.statSync(filePath);
                    
                    if (fileStats.isFile()) {
                        totalSize += fileStats.size;
                        fileCount++;
                    }
                }

                stats[dir] = {
                    exists: true,
                    fileCount,
                    totalSize,
                    readable: true
                };
            } catch (error) {
                stats[dir] = {
                    exists: true,
                    readable: false,
                    error: error.message
                };
            }
        }

        return stats;
    }

    // Clean up old files matching pattern
    cleanupOldFiles(pattern, maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
        const now = Date.now();
        let cleanedCount = 0;

        for (const dir of this.downloadDirs) {
            if (!fs.existsSync(dir)) {
                continue;
            }

            try {
                const files = fs.readdirSync(dir);
                
                for (const fileName of files) {
                    if (pattern.test(fileName)) {
                        const filePath = path.join(dir, fileName);
                        const stats = fs.statSync(filePath);
                        
                        if ((now - stats.mtime.getTime()) > maxAge) {
                            fs.unlinkSync(filePath);
                            logger.info(`Cleaned up old file: ${filePath}`);
                            cleanedCount++;
                        }
                    }
                }
            } catch (error) {
                logger.warning(`Error cleaning up directory ${dir}: ${error.message}`);
            }
        }

        return cleanedCount;
    }
}

module.exports = FileMonitor;
