'use strict';

const logger = require('#@logger');

class IDownloader {
    constructor() {
        this.isInitialized = false;
        this.downloadPath = null;
        this.activeDownloads = new Map();
    }

    async initialize(options = {}) {
        throw new Error('IDownloader.initialize() must be implemented by subclass');
    }

    async download(url, options = {}) {
        throw new Error('IDownloader.download() must be implemented by subclass');
    }

    async downloadImage(url, options = {}) {
        throw new Error('IDownloader.downloadImage() must be implemented by subclass');
    }

    async downloadAudio(url, options = {}) {
        throw new Error('IDownloader.downloadAudio() must be implemented by subclass');
    }

    async downloadVideo(url, options = {}) {
        throw new Error('IDownloader.downloadVideo() must be implemented by subclass');
    }

    async getDownloadStatus(downloadId) {
        throw new Error('IDownloader.getDownloadStatus() must be implemented by subclass');
    }

    async cancelDownload(downloadId) {
        throw new Error('IDownloader.cancelDownload() must be implemented by subclass');
    }

    async cleanup() {
        throw new Error('IDownloader.cleanup() must be implemented by subclass');
    }

    getInfo() {
        return {
            isInitialized: this.isInitialized,
            downloadPath: this.downloadPath,
            activeDownloads: this.activeDownloads.size
        };
    }
}

module.exports = IDownloader;
