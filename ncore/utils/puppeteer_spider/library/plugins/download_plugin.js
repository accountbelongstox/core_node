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
const fs = require('fs');
const path = require('path');

// Declare variables
let downloadCounter = 0;

class DownloadPlugin {
    constructor(options = {}) {
        this.id = 'download_plugin';
        this.name = 'Download Plugin';
        this.version = '1.0.0';
        this.options = {
            downloadPath: './downloads',
            autoCreateDir: true,
            ...options
        };
        this.spider = null;
        this.isInitialized = false;
    }

    async initialize(spider) {
        try {
            this.spider = spider;
            
            // Create download directory if needed
            if (this.options.autoCreateDir) {
                await this.ensureDownloadDirectory();
            }
            
            // Extend spider with download methods
            this.extendSpider();
            
            this.isInitialized = true;
            logger.info('DownloadPlugin initialized');
            
            return this;
        } catch (error) {
            logger.error(`Failed to initialize DownloadPlugin: ${error.message}`);
            throw error;
        }
    }

    extendSpider() {
        // Add download methods to spider
        this.spider.downloadFile = this.downloadFile.bind(this);
        this.spider.downloadImage = this.downloadImage.bind(this);
        this.spider.downloadAudio = this.downloadAudio.bind(this);
        this.spider.downloadVideo = this.downloadVideo.bind(this);
        this.spider.downloadApplication = this.downloadApplication.bind(this);
        this.spider.downloadFromUrl = this.downloadFromUrl.bind(this);
        this.spider.downloadFromSelector = this.downloadFromSelector.bind(this);
    }

    async ensureDownloadDirectory() {
        try {
            if (!fs.existsSync(this.options.downloadPath)) {
                fs.mkdirSync(this.options.downloadPath, { recursive: true });
                logger.info(`Download directory created: ${this.options.downloadPath}`);
            }
        } catch (error) {
            logger.error(`Failed to create download directory: ${error.message}`);
            throw error;
        }
    }

    async downloadFile(url, filename = null) {
        try {
            const page = this.spider.getPage();
            const response = await page.goto(url, { waitUntil: 'networkidle0' });
            
            const downloadId = `download_${++downloadCounter}_${Date.now()}`;
            const finalFilename = filename || `${downloadId}.file`;
            const filePath = path.join(this.options.downloadPath, finalFilename);
            
            // For now, just return the URL and file path
            // In a real implementation, you would handle the actual download
            logger.info(`File download initiated: ${url} -> ${filePath}`);
            
            return {
                success: true,
                url,
                filePath,
                downloadId,
                response
            };
        } catch (error) {
            logger.error(`Failed to download file: ${error.message}`);
            throw error;
        }
    }

    async downloadImage(selector, filename = null) {
        try {
            const page = this.spider.getPage();
            await page.waitForSelector(selector, { timeout: 10000 });
            
            const src = await page.evaluate((sel) => {
                const img = document.querySelector(sel);
                return img ? img.src : null;
            }, selector);
            
            if (!src) {
                throw new Error(`No image found for selector: ${selector}`);
            }
            
            const downloadId = `image_${++downloadCounter}_${Date.now()}`;
            const finalFilename = filename || `${downloadId}.jpg`;
            const filePath = path.join(this.options.downloadPath, finalFilename);
            
            logger.info(`Image download initiated: ${src} -> ${filePath}`);
            
            return {
                success: true,
                src,
                filePath,
                downloadId,
                selector
            };
        } catch (error) {
            logger.error(`Failed to download image: ${error.message}`);
            throw error;
        }
    }

    async downloadAudio(selector, filename = null) {
        try {
            const page = this.spider.getPage();
            await page.waitForSelector(selector, { timeout: 10000 });
            
            const src = await page.evaluate((sel) => {
                const audio = document.querySelector(sel);
                return audio ? audio.src : null;
            }, selector);
            
            if (!src) {
                throw new Error(`No audio found for selector: ${selector}`);
            }
            
            const downloadId = `audio_${++downloadCounter}_${Date.now()}`;
            const finalFilename = filename || `${downloadId}.mp3`;
            const filePath = path.join(this.options.downloadPath, finalFilename);
            
            logger.info(`Audio download initiated: ${src} -> ${filePath}`);
            
            return {
                success: true,
                src,
                filePath,
                downloadId,
                selector
            };
        } catch (error) {
            logger.error(`Failed to download audio: ${error.message}`);
            throw error;
        }
    }

    async downloadVideo(selector, filename = null) {
        try {
            const page = this.spider.getPage();
            await page.waitForSelector(selector, { timeout: 10000 });
            
            const src = await page.evaluate((sel) => {
                const video = document.querySelector(sel);
                return video ? video.src : null;
            }, selector);
            
            if (!src) {
                throw new Error(`No video found for selector: ${selector}`);
            }
            
            const downloadId = `video_${++downloadCounter}_${Date.now()}`;
            const finalFilename = filename || `${downloadId}.mp4`;
            const filePath = path.join(this.options.downloadPath, finalFilename);
            
            logger.info(`Video download initiated: ${src} -> ${filePath}`);
            
            return {
                success: true,
                src,
                filePath,
                downloadId,
                selector
            };
        } catch (error) {
            logger.error(`Failed to download video: ${error.message}`);
            throw error;
        }
    }

    async downloadApplication(target, options = {}) {
        try {
            // This would integrate with the existing download system
            const page = this.spider.getPage();
            
            // Navigate to download page if needed
            if (options.url) {
                await page.goto(options.url, { waitUntil: 'networkidle2' });
            }
            
            // Find and click download link
            if (options.selector) {
                await page.click(options.selector);
            }
            
            const downloadId = `app_${++downloadCounter}_${Date.now()}`;
            const filename = options.filename || `${target}_${downloadId}.exe`;
            const filePath = path.join(this.options.downloadPath, filename);
            
            logger.info(`Application download initiated: ${target} -> ${filePath}`);
            
            return {
                success: true,
                target,
                filePath,
                downloadId
            };
        } catch (error) {
            logger.error(`Failed to download application: ${error.message}`);
            throw error;
        }
    }

    async downloadFromUrl(url, filename = null) {
        return await this.downloadFile(url, filename);
    }

    async downloadFromSelector(selector, filename = null) {
        try {
            const page = this.spider.getPage();
            await page.waitForSelector(selector, { timeout: 10000 });
            
            const href = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                return element ? element.href : null;
            }, selector);
            
            if (!href) {
                throw new Error(`No link found for selector: ${selector}`);
            }
            
            return await this.downloadFile(href, filename);
        } catch (error) {
            logger.error(`Failed to download from selector: ${error.message}`);
            throw error;
        }
    }

    async cleanup() {
        try {
            this.spider = null;
            this.isInitialized = false;
            logger.info('DownloadPlugin cleaned up');
            
            return true;
        } catch (error) {
            logger.error(`Failed to cleanup DownloadPlugin: ${error.message}`);
            throw error;
        }
    }
}

module.exports = DownloadPlugin;
