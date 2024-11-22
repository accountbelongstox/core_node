import fs from 'fs';
import path from 'path';
import os from 'os';

export function getFileNameFromUrl(url) {
    const parsedUrl = new URL(url);
    let fileName = path.basename(parsedUrl.pathname) || 'index.html';
    fileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return fileName;
}

export function ensureDirExists(directoryPath) {
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
}

export function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    } else if (bytes >= 1024) {
        return (bytes / 1024).toFixed(2) + ' KB';
    } else {
        return bytes + ' B';
    }
}

export function getDownloadProgress(receivedBytes, totalBytes, startTime) {
    const elapsedTime = (Date.now() - startTime) / 1000; // in seconds
    const downloadSpeed = receivedBytes / elapsedTime; // bytes per second

    const remainingBytes = totalBytes - receivedBytes;
    const estimatedRemainingTime = remainingBytes / downloadSpeed; // in seconds

    const percentage = ((receivedBytes / totalBytes) * 100).toFixed(2);
    const formattedSpeed = formatBytes(downloadSpeed) + '/s';
    const formattedDownloaded = formatBytes(receivedBytes);
    const formattedTotal = formatBytes(totalBytes);

    return {
        percentage,
        downloadSpeed: formattedSpeed,
        currentTime: new Date().toLocaleTimeString(),
        estimatedRemainingTime: estimatedRemainingTime.toFixed(2) + ' s',
        downloaded: `${formattedDownloaded} / ${formattedTotal}`
    };
}
