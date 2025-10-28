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
