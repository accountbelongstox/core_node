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
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class ResourceProxyServer {
    constructor(options = {}) {
        this.port = options.port || 0;
        this.host = options.host || 'localhost';
        this.server = null;
        this.isRunning = false;
        this.downloadedResources = new Map();
        this.pendingDownloads = new Map();
        this.tempDir = options.tempDir || path.join(require('os').tmpdir(), 'spider_proxy');
        this.maxBodySize = options.maxBodySize || 100 * 1024 * 1024;
        this.downloadTimeout = options.downloadTimeout || 60000;

        this.stats = {
            totalRequests: 0,
            successfulDownloads: 0,
            failedDownloads: 0,
            bytesReceived: 0
        };

        this.ensureTempDirectory();
    }

    ensureTempDirectory() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
            logger.info(`Created temp directory: ${this.tempDir}`);
        }
    }

    async start() {
        if (this.isRunning) {
            logger.warn('Resource proxy server is already running');
            return;
        }

        return new Promise((resolve, reject) => {
            this.server = http.createServer(this.handleRequest.bind(this));

            this.server.on('error', (error) => {
                logger.error('Server error:', error);
                reject(error);
            });

            this.server.listen(this.port, this.host, () => {
                const address = this.server.address();
                this.port = address.port;
                this.isRunning = true;
                logger.success(`Resource proxy server started at http://${this.host}:${this.port}`);
                resolve({
                    host: this.host,
                    port: this.port,
                    url: `http://${this.host}:${this.port}`
                });
            });
        });
    }

    async stop() {
        if (!this.isRunning) {
            return;
        }

        return new Promise((resolve) => {
            this.server.close(() => {
                this.isRunning = false;
                logger.info('Resource proxy server stopped');
                resolve();
            });
        });
    }

    handleRequest(req, res) {
        this.stats.totalRequests++;

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Resource-Url, X-Resource-Name, X-Download-Id');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        if (req.method === 'GET' && req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                stats: this.stats,
                isRunning: this.isRunning
            }));
            return;
        }

        if (req.method === 'POST' && req.url === '/upload') {
            this.handleUpload(req, res);
            return;
        }

        if (req.method === 'GET' && req.url.startsWith('/status/')) {
            const downloadId = req.url.substring(8);
            this.handleStatusCheck(downloadId, res);
            return;
        }

        res.writeHead(404);
        res.end('Not Found');
    }

    handleUpload(req, res) {
        const resourceUrl = req.headers['x-resource-url'];
        const resourceName = req.headers['x-resource-name'];
        const downloadId = req.headers['x-download-id'] || this.generateDownloadId();

        if (!resourceUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing X-Resource-Url header' }));
            return;
        }

        logger.debug(`[PROXY] Receiving resource: ${resourceUrl} (${downloadId})`);

        const chunks = [];
        let receivedBytes = 0;

        req.on('data', (chunk) => {
            receivedBytes += chunk.length;
            if (receivedBytes > this.maxBodySize) {
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Resource too large' }));
                return;
            }
            chunks.push(chunk);
        });

        req.on('end', async () => {
            try {
                const buffer = Buffer.concat(chunks);
                const fileName = resourceName || this.generateFileName(resourceUrl);
                const filePath = path.join(this.tempDir, fileName);

                fs.writeFileSync(filePath, buffer);

                this.stats.successfulDownloads++;
                this.stats.bytesReceived += buffer.length;

                const downloadInfo = {
                    downloadId: downloadId,
                    resourceUrl: resourceUrl,
                    fileName: fileName,
                    filePath: filePath,
                    size: buffer.length,
                    timestamp: new Date().toISOString(),
                    success: true
                };

                this.downloadedResources.set(downloadId, downloadInfo);

                if (this.pendingDownloads.has(downloadId)) {
                    const resolver = this.pendingDownloads.get(downloadId);
                    resolver.resolve(downloadInfo);
                    this.pendingDownloads.delete(downloadId);
                }

                logger.success(`[PROXY] Resource received: ${fileName} (${buffer.length} bytes)`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    downloadId: downloadId,
                    fileName: fileName,
                    size: buffer.length
                }));
            } catch (error) {
                this.stats.failedDownloads++;
                logger.error('[PROXY] Failed to save resource:', error);

                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });

        req.on('error', (error) => {
            this.stats.failedDownloads++;
            logger.error('[PROXY] Upload error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        });
    }

    handleStatusCheck(downloadId, res) {
        const downloadInfo = this.downloadedResources.get(downloadId);

        if (downloadInfo) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'completed',
                downloadInfo: downloadInfo
            }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'pending',
                downloadId: downloadId
            }));
        }
    }

    generateDownloadId() {
        return crypto.randomBytes(16).toString('hex');
    }

    generateFileName(url) {
        try {
            const urlObj = new URL(url);
            let fileName = path.basename(urlObj.pathname);

            if (!fileName || fileName === '/') {
                fileName = 'download_' + Date.now();
            }

            const ext = path.extname(fileName);
            if (!ext) {
                fileName += '.bin';
            }

            return fileName;
        } catch (error) {
            return 'download_' + Date.now() + '.bin';
        }
    }

    async waitForDownload(downloadId, timeout = 60000) {
        if (this.downloadedResources.has(downloadId)) {
            return this.downloadedResources.get(downloadId);
        }

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.pendingDownloads.delete(downloadId);
                reject(new Error(`Download timeout: ${downloadId}`));
            }, timeout);

            this.pendingDownloads.set(downloadId, {
                resolve: (info) => {
                    clearTimeout(timeoutId);
                    resolve(info);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });
        });
    }

    getDownloadInfo(downloadId) {
        return this.downloadedResources.get(downloadId);
    }

    getAllDownloads() {
        return Array.from(this.downloadedResources.values());
    }

    getStats() {
        return {
            ...this.stats,
            activeDownloads: this.pendingDownloads.size,
            completedDownloads: this.downloadedResources.size
        };
    }

    clearDownloads() {
        this.downloadedResources.clear();
        logger.info('Cleared all download records');
    }

    cleanupTempFiles() {
        try {
            const files = fs.readdirSync(this.tempDir);
            let cleanedCount = 0;

            for (const file of files) {
                const filePath = path.join(this.tempDir, file);
                try {
                    fs.unlinkSync(filePath);
                    cleanedCount++;
                } catch (error) {
                    logger.warn(`Failed to delete temp file: ${filePath}`, error);
                }
            }

            if (cleanedCount > 0) {
                logger.info(`Cleaned up ${cleanedCount} temp files`);
            }
        } catch (error) {
            logger.warn('Failed to cleanup temp files:', error);
        }
    }

    getServerUrl() {
        if (!this.isRunning) {
            return null;
        }
        return `http://${this.host}:${this.port}`;
    }
}

module.exports = ResourceProxyServer;
