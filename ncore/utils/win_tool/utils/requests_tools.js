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
    const os = require('os');

    exports.getFileNameFromUrl = function(url) {
        const parsedUrl = new URL(url);
        let fileName = path.basename(parsedUrl.pathname) || 'index.html';
        fileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        return fileName;
    };

    exports.ensureDirExists = function(directoryPath) {
        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, { recursive: true });
        }
    };

    exports.formatBytes = function(bytes) {
        if (bytes >= 1024 * 1024) {
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        } else if (bytes >= 1024) {
            return (bytes / 1024).toFixed(2) + ' KB';
        } else {
            return bytes + ' B';
        }
    };

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
    };