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
const IPlugin = require('../interfaces/IPlugin');
const IDownloader = require('../interfaces/IDownloader');

class HttpDownloader extends IDownloader {
    constructor() {
        super();
        this.axios = require('axios');
        this.fs = require('fs');
        this.path = require('path');
        this.os = require('os');
    }

    async initialize(options = {}) {
        try {
            this.downloadPath = options.path || path.join(this.os.homedir(), 'Downloads', 'spider_downloads');
            
            if (!this.fs.existsSync(this.downloadPath)) {
                this.fs.mkdirSync(this.downloadPath, { recursive: true });
            }
            
            this.isInitialized = true;
            logger.info(`HttpDownloader initialized: ${this.downloadPath}`);
        } catch (error) {
            logger.error('Failed to initialize HttpDownloader:', error);
            throw error;
        }
    }

    async download(url, options = {}) {
        try {
            const filename = options.filename || this.generateFilename(url);
            const filepath = path.join(this.downloadPath, filename);
            
            const response = await this.axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                timeout: options.timeout || 30000
            });
            
            const writer = this.fs.createWriteStream(filepath);
            response.data.pipe(writer);
            
            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    resolve({
                        success: true,
                        filepath: filepath,
                        filename: filename,
                        size: this.fs.statSync(filepath).size
                    });
                });
                
                writer.on('error', reject);
            });
        } catch (error) {
            logger.error(`Failed to download ${url}:`, error);
            throw error;
        }
    }

    async downloadImage(url, options = {}) {
        return this.download(url, { ...options, type: 'image' });
    }

    async downloadAudio(url, options = {}) {
        return this.download(url, { ...options, type: 'audio' });
    }

    async downloadVideo(url, options = {}) {
        return this.download(url, { ...options, type: 'video' });
    }

    generateFilename(url) {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const ext = path.extname(pathname) || '.html';
        const basename = path.basename(pathname, ext) || 'download';
        const timestamp = Date.now();
        
        return `${basename}_${timestamp}${ext}`;
    }

    async getDownloadStatus(downloadId) {
        return this.activeDownloads.get(downloadId) || null;
    }

    async cancelDownload(downloadId) {
        const download = this.activeDownloads.get(downloadId);
        if (download) {
            download.cancel();
            this.activeDownloads.delete(downloadId);
        }
    }

    async cleanup() {
        this.activeDownloads.clear();
        this.isInitialized = false;
    }
}

class DownloadPlugin extends IPlugin {
    constructor() {
        super();
        this.name = 'download';
        this.version = '1.0.0';
        this.downloader = null;
    }

    async initialize(spider) {
        try {
            this.spider = spider;
            this.downloader = new HttpDownloader();
            await this.downloader.initialize();
            
            this.isInitialized = true;
            logger.info(`DownloadPlugin initialized for spider: ${spider.id}`);
        } catch (error) {
            logger.error('Failed to initialize DownloadPlugin:', error);
            throw error;
        }
    }

    async cleanup() {
        try {
            if (this.downloader) {
                await this.downloader.cleanup();
            }
            this.isInitialized = false;
            logger.info('DownloadPlugin cleaned up');
        } catch (error) {
            logger.error('Failed to cleanup DownloadPlugin:', error);
        }
    }

    async downloadFile(url, options = {}) {
        return await this.downloader.download(url, options);
    }

    async downloadImage(url, options = {}) {
        return await this.downloader.downloadImage(url, options);
    }

    async downloadAudio(url, options = {}) {
        return await this.downloader.downloadAudio(url, options);
    }

    async downloadVideo(url, options = {}) {
        return await this.downloader.downloadVideo(url, options);
    }
}

module.exports = DownloadPlugin;
