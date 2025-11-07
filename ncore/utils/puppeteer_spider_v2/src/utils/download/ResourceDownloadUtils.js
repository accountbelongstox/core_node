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
const path = require('path');
const fs = require('fs');
const os = require('os');
const ResourceProxyServer = require('./ResourceProxyServer');

class ResourceDownloadUtils {
    constructor(page, options = {}) {
        this.page = page;
        this.downloadPath = options.downloadPath || path.join(os.homedir(), 'Downloads', 'spider_downloads');
        this.minFileSize = options.minFileSize || 100;
        this.downloadTimeout = options.downloadTimeout || 60000;
        this.pollInterval = options.pollInterval || 500;
        this.stableTime = options.stableTime || 2000;
        this.proxyServer = options.proxyServer || null;
        this.useProxy = options.useProxy !== false;

        this.ensureDownloadDirectory();
    }

    ensureDownloadDirectory() {
        if (!fs.existsSync(this.downloadPath)) {
            fs.mkdirSync(this.downloadPath, { recursive: true });
            logger.info(`Created download directory: ${this.downloadPath}`);
        }
    }

    async downloadResourceViaInjectedButton(resourceUrl, targetPath, options = {}) {
        const fileName = options.fileName || this.generateFileName(resourceUrl);
        const expectedPattern = this.escapeRegExp(fileName);
        const startTime = Date.now();

        try {
            logger.debug(`Downloading resource: ${resourceUrl}`);
            logger.debug(`Expected file name: ${fileName}`);
            logger.debug(`Target path: ${targetPath}`);

            const buttonId = `spider_download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            await this.page.evaluate((url, id) => {
                const link = document.createElement('a');
                link.id = id;
                link.href = url;
                link.download = '';
                link.style.display = 'none';
                link.target = '_blank';
                document.body.appendChild(link);
            }, resourceUrl, buttonId);

            logger.debug(`Injected download button with id: ${buttonId}`);

            await this.page.evaluate((id) => {
                const link = document.getElementById(id);
                if (link) {
                    link.click();
                }
            }, buttonId);

            logger.debug(`Clicked download button`);

            const downloadedFile = await this.waitForDownloadComplete(expectedPattern, {
                timeout: options.timeout || this.downloadTimeout,
                pollInterval: this.pollInterval,
                stableTime: this.stableTime
            });

            logger.debug(`Download completed: ${downloadedFile.path}`);

            if (targetPath) {
                const targetDir = path.dirname(targetPath);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                fs.copyFileSync(downloadedFile.path, targetPath);
                logger.debug(`Copied file to: ${targetPath}`);

                try {
                    fs.unlinkSync(downloadedFile.path);
                    logger.debug(`Cleaned up temporary file: ${downloadedFile.path}`);
                } catch (cleanupError) {
                    logger.warn(`Failed to cleanup temporary file: ${cleanupError.message}`);
                }
            }

            await this.page.evaluate((id) => {
                const link = document.getElementById(id);
                if (link) {
                    link.remove();
                }
            }, buttonId);

            const duration = Date.now() - startTime;
            logger.success(`Resource downloaded successfully in ${duration}ms: ${resourceUrl} -> ${targetPath}`);

            return {
                success: true,
                sourcePath: downloadedFile.path,
                targetPath: targetPath,
                fileName: fileName,
                size: downloadedFile.size,
                duration: duration
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`Failed to download resource after ${duration}ms: ${resourceUrl}`, error);
            return {
                success: false,
                error: error.message,
                duration: duration
            };
        }
    }

    async downloadResourceBatch(resources, targetDir, options = {}) {
        const results = [];
        const concurrency = options.concurrency || 1;
        const delay = options.delay || 1000;

        logger.info(`Starting batch download of ${resources.length} resources with concurrency: ${concurrency}`);

        for (let i = 0; i < resources.length; i += concurrency) {
            const batch = resources.slice(i, i + concurrency);
            const batchPromises = batch.map(async (resource) => {
                const targetPath = path.join(targetDir, resource.targetFileName || this.generateFileName(resource.url));
                const result = await this.downloadResourceViaInjectedButton(resource.url, targetPath, {
                    fileName: resource.targetFileName,
                    timeout: options.timeout
                });
                return {
                    url: resource.url,
                    targetPath: targetPath,
                    ...result
                };
            });

            const batchResults = await Promise.allSettled(batchPromises);
            results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason }));

            if (i + concurrency < resources.length && delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failedCount = results.length - successCount;

        logger.info(`Batch download completed: ${successCount} succeeded, ${failedCount} failed`);

        return {
            total: results.length,
            succeeded: successCount,
            failed: failedCount,
            results: results
        };
    }

    async waitForDownloadComplete(filePattern, options = {}) {
        const startTime = Date.now();
        const timeout = options.timeout || this.downloadTimeout;
        const pollInterval = options.pollInterval || this.pollInterval;
        const stableTime = options.stableTime || this.stableTime;

        let lastFileSize = 0;
        let stableStartTime = null;
        let lastFoundFile = null;

        while (Date.now() - startTime < timeout) {
            try {
                const files = this.findFilesByPattern(filePattern);

                if (files.length > 0) {
                    const latestFile = files[0];
                    lastFoundFile = latestFile;

                    if (latestFile.size < this.minFileSize) {
                        await new Promise(resolve => setTimeout(resolve, pollInterval));
                        continue;
                    }

                    const currentSize = latestFile.size;

                    if (currentSize === lastFileSize && currentSize >= this.minFileSize) {
                        if (stableStartTime === null) {
                            stableStartTime = Date.now();
                        } else if (Date.now() - stableStartTime >= stableTime) {
                            logger.debug(`File download stable: ${latestFile.path} (${currentSize} bytes)`);
                            return latestFile;
                        }
                    } else {
                        stableStartTime = null;
                        lastFileSize = currentSize;
                        logger.debug(`File downloading: ${latestFile.name} (${currentSize} bytes)`);
                    }
                }

                await new Promise(resolve => setTimeout(resolve, pollInterval));
            } catch (error) {
                logger.warn('Error monitoring download:', error);
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }

        if (lastFoundFile) {
            logger.warn(`Download timeout but file exists: ${lastFoundFile.path} (${lastFoundFile.size} bytes)`);
            return lastFoundFile;
        }

        throw new Error(`Timeout waiting for download: ${filePattern}`);
    }

    findFilesByPattern(pattern) {
        const matchedFiles = [];
        const regex = new RegExp(pattern, 'i');

        try {
            if (!fs.existsSync(this.downloadPath)) {
                return matchedFiles;
            }

            const files = fs.readdirSync(this.downloadPath);

            for (const fileName of files) {
                if (fileName.match(/\(\d+\)/) || fileName.endsWith('.crdownload') || fileName.endsWith('.tmp')) {
                    continue;
                }

                if (regex.test(fileName)) {
                    const filePath = path.join(this.downloadPath, fileName);
                    const stats = fs.statSync(filePath);

                    matchedFiles.push({
                        path: filePath,
                        name: fileName,
                        size: stats.size,
                        modified: stats.mtime,
                        directory: this.downloadPath
                    });
                }
            }
        } catch (error) {
            logger.error(`Cannot read directory ${this.downloadPath}:`, error);
        }

        return matchedFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    }

    generateFileName(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            let fileName = path.basename(pathname);

            if (!fileName || fileName === '/') {
                fileName = 'index.html';
            }

            const ext = path.extname(fileName);
            if (!ext) {
                fileName += '.html';
            }

            return fileName;
        } catch (error) {
            logger.warn(`Failed to generate filename from URL: ${url}`, error);
            return `download_${Date.now()}.html`;
        }
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    setDownloadPath(newPath) {
        this.downloadPath = newPath;
        this.ensureDownloadDirectory();
    }

    getDownloadPath() {
        return this.downloadPath;
    }

    cleanupDownloadDirectory() {
        try {
            if (fs.existsSync(this.downloadPath)) {
                const files = fs.readdirSync(this.downloadPath);
                let cleanedCount = 0;

                for (const file of files) {
                    const filePath = path.join(this.downloadPath, file);
                    const stats = fs.statSync(filePath);
                    const age = Date.now() - stats.mtime.getTime();

                    if (age > 3600000) {
                        fs.unlinkSync(filePath);
                        cleanedCount++;
                    }
                }

                if (cleanedCount > 0) {
                    logger.info(`Cleaned up ${cleanedCount} old files from download directory`);
                }
            }
        } catch (error) {
            logger.warn('Failed to cleanup download directory:', error);
        }
    }

    async downloadResourceViaProxy(resourceUrl, targetPath, options = {}) {
        if (!this.proxyServer || !this.proxyServer.isRunning) {
            logger.warn('Proxy server not available, falling back to button method');
            return await this.downloadResourceViaInjectedButton(resourceUrl, targetPath, options);
        }

        const fileName = options.fileName || this.generateFileName(resourceUrl);
        const downloadId = this.proxyServer.generateDownloadId();
        const proxyUrl = this.proxyServer.getServerUrl();
        const startTime = Date.now();

        try {
            logger.debug(`[PROXY-DOWNLOAD] Starting: ${resourceUrl}`);

            const injectionCode = `
                (async function(url, fileName, downloadId, proxyUrl) {
                    try {
                        const response = await fetch(url);
                        if (!response.ok) {
                            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                        }

                        const blob = await response.blob();
                        const arrayBuffer = await blob.arrayBuffer();

                        const uploadResponse = await fetch(proxyUrl + '/upload', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/octet-stream',
                                'X-Resource-Url': url,
                                'X-Resource-Name': fileName,
                                'X-Download-Id': downloadId
                            },
                            body: arrayBuffer
                        });

                        const result = await uploadResponse.json();
                        return { success: true, result: result };
                    } catch (error) {
                        return { success: false, error: error.message };
                    }
                })(${JSON.stringify(resourceUrl)}, ${JSON.stringify(fileName)}, ${JSON.stringify(downloadId)}, ${JSON.stringify(proxyUrl)});
            `;

            const injectionResult = await this.page.evaluate(injectionCode);

            if (!injectionResult.success) {
                throw new Error(`Injection failed: ${injectionResult.error}`);
            }

            logger.debug(`[PROXY-DOWNLOAD] Injection succeeded, waiting for server...`);

            const downloadInfo = await this.proxyServer.waitForDownload(downloadId, options.timeout || this.downloadTimeout);

            if (targetPath) {
                const targetDir = path.dirname(targetPath);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                fs.copyFileSync(downloadInfo.filePath, targetPath);
                logger.debug(`[PROXY-DOWNLOAD] Copied to: ${targetPath}`);

                try {
                    fs.unlinkSync(downloadInfo.filePath);
                } catch (cleanupError) {
                    logger.warn(`Failed to cleanup temp file: ${cleanupError.message}`);
                }
            }

            const duration = Date.now() - startTime;
            logger.success(`[PROXY-DOWNLOAD] Completed in ${duration}ms: ${resourceUrl}`);

            return {
                success: true,
                sourcePath: downloadInfo.filePath,
                targetPath: targetPath,
                fileName: fileName,
                size: downloadInfo.size,
                duration: duration,
                method: 'proxy'
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`[PROXY-DOWNLOAD] Failed after ${duration}ms: ${resourceUrl}`, error);
            return {
                success: false,
                error: error.message,
                duration: duration,
                method: 'proxy'
            };
        }
    }

    async downloadResourceBatchViaProxy(resources, targetDir, options = {}) {
        if (!this.proxyServer || !this.proxyServer.isRunning) {
            logger.warn('Proxy server not available, falling back to batch button method');
            return await this.downloadResourceBatch(resources, targetDir, options);
        }

        const results = [];
        const concurrency = options.concurrency || 3;
        const delay = options.delay || 500;

        logger.info(`Starting proxy batch download of ${resources.length} resources with concurrency: ${concurrency}`);

        for (let i = 0; i < resources.length; i += concurrency) {
            const batch = resources.slice(i, i + concurrency);
            const batchPromises = batch.map(async (resource) => {
                const targetPath = path.join(targetDir, resource.targetFileName || this.generateFileName(resource.url));
                const result = await this.downloadResourceViaProxy(resource.url, targetPath, {
                    fileName: resource.targetFileName,
                    timeout: options.timeout
                });
                return {
                    url: resource.url,
                    targetPath: targetPath,
                    ...result
                };
            });

            const batchResults = await Promise.allSettled(batchPromises);
            results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason }));

            if (i + concurrency < resources.length && delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failedCount = results.length - successCount;

        logger.info(`Proxy batch download completed: ${successCount} succeeded, ${failedCount} failed`);

        return {
            total: results.length,
            succeeded: successCount,
            failed: failedCount,
            results: results,
            method: 'proxy'
        };
    }

    setProxyServer(proxyServer) {
        this.proxyServer = proxyServer;
        logger.info('Proxy server set for resource downloads');
    }
}

module.exports = ResourceDownloadUtils;
