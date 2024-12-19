const fs = require('fs');
const path = require('path');

class VideoBackupChecker {
    constructor() {
        // 支持的视频文件扩展名
        this.videoExtensions = [
            '.mp4', '.mkv', '.avi', '.mov',
            '.wmv', '.flv', '.webm', '.m4v',
            '.mpeg', '.mpg', '.3gp', '.rmvb'
        ];
        // 备份文件的后缀
        this.backupSuffix = '.bak';
        // 存储未压缩的视频文件
        this.uncompressedVideos = [];
    }

    /**
     * 检查是否是视频文件
     */
    isVideoFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.videoExtensions.includes(ext);
    }

    /**
     * 检查是否存在备份文件
     */
    hasBackupFile(filePath) {
        const backupPath = filePath + this.backupSuffix;
        return fs.existsSync(backupPath);
    }

    /**
     * 扫描目录
     */
    scanDirectory(dirPath) {
        try {
            // 重置未压缩视频列表
            this.uncompressedVideos = [];
            this._scanRecursive(dirPath);
            return {
                success: true,
                uncompressedCount: this.uncompressedVideos.length,
                uncompressedVideos: this.uncompressedVideos
            };
        } catch (error) {
            console.error('Error scanning directory:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 递归扫描目录
     */
    _scanRecursive(dirPath) {
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            
            try {
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    // 递归扫描子目录
                    this._scanRecursive(fullPath);
                } else if (stat.isFile() && this.isVideoFile(fullPath)) {
                    // 检查视频文件是否有备份
                    if (!this.hasBackupFile(fullPath)) {
                        this.uncompressedVideos.push({
                            path: fullPath,
                            size: this._formatFileSize(stat.size),
                            modifiedTime: stat.mtime
                        });
                    }
                }
            } catch (error) {
                console.error(`Error processing ${fullPath}:`, error);
            }
        }
    }

    /**
     * 格式化文件大小
     */
    _formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    }

    /**
     * 生成报告
     */
    generateReport(scanResult) {
        if (!scanResult.success) {
            return `Scan failed: ${scanResult.error}`;
        }

        let report = 'Video Compression Check Report\n';
        report += '============================\n\n';

        if (scanResult.uncompressedCount === 0) {
            report += 'All video files have backup files. No uncompressed videos found.\n';
            return report;
        }

        report += `Found ${scanResult.uncompressedCount} uncompressed video files:\n\n`;

        scanResult.uncompressedVideos.forEach((video, index) => {
            report += `${index + 1}. ${video.path}\n`;
            report += `   Size: ${video.size}\n`;
            report += `   Modified: ${video.modifiedTime}\n\n`;
        });

        return report;
    }
}

module.exports = VideoBackupChecker; 