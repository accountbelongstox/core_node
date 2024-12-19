const fs = require('fs');
const path = require('path');
const VideoCompressor = require('./videoCompressor');

class VideoCompressionScanner {
    constructor() {
        this.videoExtensions = [
            '.mp4', '.mkv', '.avi', '.mov',
            '.wmv', '.flv', '.webm', '.m4v',
            '.mpeg', '.mpg', '.3gp', '.rmvb'
        ];
        this.backupSuffix = '.bak';
        this.compressedSuffix = '_compressed';
        this.scanResults = {
            needCompression: [],
            alreadyCompressed: []
        };
    }

    /**
     * Format file size to human readable format
     */
    _formatSize(bytes) {
        if (bytes >= 1024 * 1024 * 1024) {
            return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
    }

    /**
     * Calculate compression ratio
     */
    _calculateCompressionRatio(originalSize, compressedSize) {
        const reduction = originalSize - compressedSize;
        const ratio = (reduction / originalSize) * 100;
        return {
            reduction: this._formatSize(reduction),
            ratio: ratio.toFixed(2)
        };
    }

    /**
     * Check if file is a video
     */
    _isVideoFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.videoExtensions.includes(ext);
    }

    /**
     * Get file details
     */
    _getFileDetails(filePath) {
        const stats = fs.statSync(filePath);
        return {
            path: filePath,
            name: path.basename(filePath),
            size: stats.size,
            formattedSize: this._formatSize(stats.size),
            modifiedTime: stats.mtime
        };
    }

    /**
     * Scan directory for videos
     */
    async scanDirectory(dirPath) {
        try {
            this.scanResults = {
                needCompression: [],
                alreadyCompressed: []
            };

            await this._scanRecursive(dirPath);

            // Generate report
            this._generateReport();

            return this.scanResults;
        } catch (error) {
            console.error('Error scanning directory:', error);
            return null;
        }
    }

    /**
     * Recursive scan implementation
     */
    async _scanRecursive(dirPath) {
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            
            try {
                const stats = fs.statSync(fullPath);

                if (stats.isDirectory()) {
                    await this._scanRecursive(fullPath);
                } else if (this._isVideoFile(fullPath)) {
                    const fileDetails = this._getFileDetails(fullPath);
                    
                    // Check if this is a compressed version
                    if (fullPath.includes(this.compressedSuffix)) {
                        continue;
                    }

                    // Check for backup and compressed versions
                    const backupPath = fullPath + this.backupSuffix;
                    const ext = path.extname(fullPath);
                    const baseName = path.basename(fullPath, ext);
                    const compressedPath = path.join(
                        path.dirname(fullPath),
                        `${baseName}${this.compressedSuffix}${ext}`
                    );

                    if (fs.existsSync(compressedPath)) {
                        const compressedDetails = this._getFileDetails(compressedPath);
                        const compressionStats = this._calculateCompressionRatio(
                            fileDetails.size,
                            compressedDetails.size
                        );

                        this.scanResults.alreadyCompressed.push({
                            original: fileDetails,
                            compressed: compressedDetails,
                            compressionStats
                        });
                    } else {
                        this.scanResults.needCompression.push(fileDetails);
                    }
                }
            } catch (error) {
                console.error(`Error processing ${fullPath}:`, error);
            }
        }
    }

    /**
     * Generate scan report
     */
    _generateReport() {
        console.log('\nVideo Compression Scan Report');
        console.log('============================\n');

        // Files needing compression
        console.log('Files Needing Compression:');
        console.log('--------------------------');
        if (this.scanResults.needCompression.length === 0) {
            console.log('No files need compression.\n');
        } else {
            this.scanResults.needCompression.forEach((file, index) => {
                console.log(`${index + 1}. ${file.name}`);
                console.log(`   Size: ${file.formattedSize}`);
                console.log(`   Path: ${file.path}\n`);
            });
        }

        // Already compressed files
        console.log('Already Compressed Files:');
        console.log('------------------------');
        if (this.scanResults.alreadyCompressed.length === 0) {
            console.log('No compressed files found.\n');
        } else {
            this.scanResults.alreadyCompressed.forEach((item, index) => {
                console.log(`${index + 1}. ${item.original.name}`);
                console.log(`   Original Size: ${item.original.formattedSize}`);
                console.log(`   Compressed Size: ${item.compressed.formattedSize}`);
                console.log(`   Space Saved: ${item.compressionStats.reduction} (${item.compressionStats.ratio}%)`);
                console.log(`   Path: ${item.original.path}\n`);
            });
        }

        // Summary
        console.log('Summary:');
        console.log('--------');
        console.log(`Total files found: ${this.scanResults.needCompression.length + this.scanResults.alreadyCompressed.length}`);
        console.log(`Files needing compression: ${this.scanResults.needCompression.length}`);
        console.log(`Already compressed files: ${this.scanResults.alreadyCompressed.length}\n`);
    }
}

module.exports = VideoCompressionScanner; 