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

const http = require('http');
const logger = require('#@logger');

class TampermonkeyServer {
    constructor(options = {}) {
        this.port = options.port || 8765;
        this.host = options.host || '127.0.0.1';
        this.server = null;
        this.isRunning = false;
        this.onPageReceived = options.onPageReceived || null;
        this.onComplete = options.onComplete || null;
        this.onError = options.onError || null;
        this.receivedPages = [];
        this.statistics = {
            totalPages: 0,
            totalBytes: 0,
            startTime: null,
            endTime: null,
            sourceCount: {
                page: 0,
                iframe: 0
            }
        };
    }

    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = http.createServer((req, res) => {
                    this.handleRequest(req, res);
                });

                this.server.listen(this.port, this.host, () => {
                    this.isRunning = true;
                    this.statistics.startTime = new Date();
                    logger.success(`[TAMPERMONKEY-SERVER] Listening on http://${this.host}:${this.port}`);
                    resolve();
                });

                this.server.on('error', (error) => {
                    logger.error('[TAMPERMONKEY-SERVER] Server error:', error);
                    if (this.onError) {
                        this.onError(error);
                    }
                    reject(error);
                });
            } catch (error) {
                logger.error('[TAMPERMONKEY-SERVER] Failed to start server:', error);
                reject(error);
            }
        });
    }

    async stop() {
        return new Promise((resolve) => {
            if (!this.server || !this.isRunning) {
                resolve();
                return;
            }

            this.server.close(() => {
                this.isRunning = false;
                this.statistics.endTime = new Date();
                logger.info('[TAMPERMONKEY-SERVER] Server stopped');
                resolve();
            });
        });
    }

    async handleRequest(req, res) {
        if (req.method === 'OPTIONS') {
            this.handleCORS(res);
            res.writeHead(200);
            res.end();
            return;
        }

        if (req.method === 'POST' && req.url === '/page') {
            await this.handlePageUpload(req, res);
        } else if (req.method === 'POST' && req.url === '/complete') {
            await this.handleComplete(req, res);
        } else if (req.method === 'GET' && req.url === '/status') {
            this.handleStatus(req, res);
        } else if (req.method === 'GET' && req.url === '/ping') {
            this.handlePing(req, res);
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not Found' }));
        }
    }

    handleCORS(res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    async handlePageUpload(req, res) {
        this.handleCORS(res);

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const pageData = JSON.parse(body);
                const sourceType = (pageData.sourceType || 'page').toLowerCase();
                if (!this.statistics.sourceCount[sourceType]) {
                    this.statistics.sourceCount[sourceType] = 0;
                }
                this.statistics.sourceCount[sourceType]++;
                this.statistics.totalPages++;
                this.statistics.totalBytes += pageData.contentLength || 0;

                logger.info(`[TAMPERMONKEY-SERVER] Received page: ${pageData.url}`);
                logger.info(`  Source: ${sourceType}, Depth: ${pageData.depth}, Content length: ${pageData.contentLength}`);

                this.receivedPages.push(pageData);

                if (this.onPageReceived) {
                    await this.onPageReceived(pageData);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Page received',
                    totalPages: this.statistics.totalPages,
                    sourceType: sourceType
                }));
            } catch (error) {
                logger.error('[TAMPERMONKEY-SERVER] Failed to process page:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });
    }

    async handleComplete(req, res) {
        this.handleCORS(res);

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const completeData = JSON.parse(body);
                const completionSource = (completeData.sourceType || 'page').toLowerCase();
                logger.success(`[TAMPERMONKEY-SERVER] Crawl completed!`);
                logger.info(`  Mode: ${completionSource}`);
                logger.info(`  Total pages: ${completeData.totalPages}`);
                logger.info(`  Failed URLs: ${completeData.failedUrls?.length || 0}`);

                if (this.onComplete) {
                    await this.onComplete(completeData);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Completion acknowledged',
                    sourceType: completionSource
                }));
            } catch (error) {
                logger.error('[TAMPERMONKEY-SERVER] Failed to process completion:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });
    }

    handleStatus(req, res) {
        this.handleCORS(res);

        const uptime = this.statistics.startTime
            ? (new Date() - this.statistics.startTime) / 1000
            : 0;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            isRunning: this.isRunning,
            statistics: {
                ...this.statistics,
                uptime: uptime,
                receivedPagesCount: this.receivedPages.length,
                sourceCount: this.statistics.sourceCount
            }
        }));
    }

    handlePing(req, res) {
        this.handleCORS(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ pong: true }));
    }

    getStatistics() {
        return {
            ...this.statistics,
            receivedPagesCount: this.receivedPages.length
        };
    }

    getReceivedPages() {
        return this.receivedPages;
    }

    clearReceivedPages() {
        this.receivedPages = [];
        this.statistics.totalPages = 0;
        this.statistics.totalBytes = 0;
    }
}

module.exports = TampermonkeyServer;
