const fs = require('fs');
    const path = require('path');
    const os = require('os');

    exports.getFileNameFromUrl = function(url) {
        const parsedUrl = new URL(url);
        let fileName = path.basename(parsedUrl.pathname) || 'index.html';
        fileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        return fileName;
    }

    exports.ensureDirExists = function(directoryPath) {
        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, { recursive: true });
        }
    }

    exports.formatBytes = function(bytes) {
        if (bytes >= 1024 * 1024) {
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        } else if (bytes >= 1024) {
            return (bytes / 1024).toFixed(2) + ' KB';
        } else {
            return bytes + ' B';
        }
    }

    exports.getDownloadProgress = function(receivedBytes, totalBytes, startTime) {
        const elapsedTime = (Date.now() - startTime) / 1000; // in seconds
        const downloadSpeed = receivedBytes / elapsedTime; // bytes per second

        const remainingBytes = totalBytes - receivedBytes;
        const estimatedRemainingTime = remainingBytes / downloadSpeed; // in seconds

        const percentage = ((receivedBytes / totalBytes) * 100).toFixed(2);
        const formattedSpeed = exports.formatBytes(downloadSpeed) + '/s';
        const formattedDownloaded = exports.formatBytes(receivedBytes);
        const formattedTotal = exports.formatBytes(totalBytes);

        return {
            percentage,
            downloadSpeed: formattedSpeed,
            currentTime: new Date().toLocaleTimeString(),
            estimatedRemainingTime: estimatedRemainingTime.toFixed(2) + ' s',
            downloaded: `${formattedDownloaded} / ${formattedTotal}`
        };
    }