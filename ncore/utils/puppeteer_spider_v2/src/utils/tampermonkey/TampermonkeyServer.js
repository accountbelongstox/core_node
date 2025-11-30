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
const EventEmitter = require('events');
const WebSocket = require('ws');
const logger = require('#@logger');
const { getThreadBus } = require('#@thread_bus');

let sharedInstance = null;
let sharedStartPromise = null;

class TampermonkeyServer extends EventEmitter {
    constructor(options = {}) {
        super();
        this.port = options.port || 8765;
        this.host = options.host || '127.0.0.1';
        this.wsPath = options.wsPath || '/ws';
        this.server = null;
        this.wsServer = null;
        this.isRunning = false;
        this.autoStart = options.autoStart !== false;
        this.onPageReceived = options.onPageReceived || null;
        this.onComplete = options.onComplete || null;
        this.onError = options.onError || null;
        this.receivedPages = [];
        this.clients = new Set();
        this.pendingOutboundMessages = [];
        this.maxPendingMessages = 50;
        this.lastClientId = 0;
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

        if (this.onPageReceived) {
            this.on('page', this.onPageReceived);
        }
        if (this.onComplete) {
            this.on('complete', this.onComplete);
        }
        if (this.onError) {
            this.on('error', this.onError);
        }
    }

    static getInstance(options = {}) {
        if (!sharedInstance) {
            sharedInstance = new TampermonkeyServer(options);
            if (sharedInstance.autoStart) {
                sharedInstance.ensureStarted().catch((error) => {
                    logger.error('[TAMPERMONKEY-SERVER] Auto-start failed:', error);
                });
            }
        } else if (options && (options.port || options.host || options.wsPath)) {
            logger.warn('[TAMPERMONKEY-SERVER] Singleton already initialized, ignoring configuration override');
        }
        return sharedInstance;
    }

    static ensureStarted(options = {}) {
        const instance = TampermonkeyServer.getInstance(options);
        return instance.ensureStarted();
    }

    static sendCommand(action, payload = {}) {
        return TampermonkeyServer.getInstance().sendCommand(action, payload);
    }

    async ensureStarted() {
        if (this.isRunning) {
            return this;
        }

        if (!sharedStartPromise) {
            sharedStartPromise = this.start().catch((error) => {
                sharedStartPromise = null;
                throw error;
            });
        }

        await sharedStartPromise;
        return this;
    }

    async start() {
        if (this.isRunning) {
            return this;
        }

        return new Promise((resolve, reject) => {
            try {
                this.server = http.createServer((req, res) => this.handleRequest(req, res));

                this.server.listen(this.port, this.host, () => {
                    this.isRunning = true;
                    this.statistics.startTime = new Date();
                    logger.success(`[TAMPERMONKEY-SERVER] Listening on http://${this.host}:${this.port}`);
                    this.setupWebSocketServer();

                    // Register with ThreadBus
                    const threadBus = getThreadBus();
                    threadBus.register('tampermonkey-server', {
                        priority: 30,
                        onShutdown: async () => {
                            logger.info('[TAMPERMONKEY-SERVER] ThreadBus shutdown signal received');
                            await this.stop();
                        }
                    });

                    resolve(this);
                });

                this.server.on('error', (error) => {
                    if (error.code === 'EADDRINUSE') {
                        logger.warn(`[TAMPERMONKEY-SERVER] Port ${this.port} is already in use, skipping start`);
                        this.isRunning = false;
                        resolve(this);
                    } else {
                        this.handleServerError(error);
                        reject(error);
                    }
                });
            } catch (error) {
                this.handleServerError(error);
                reject(error);
            }
        });
    }

    setupWebSocketServer() {
        if (this.wsServer || !this.server) {
            return;
        }

        this.wsServer = new WebSocket.Server({ server: this.server, path: this.wsPath });
        this.wsServer.on('connection', (socket, req) => this.handleWebSocketConnection(socket, req));
        this.wsServer.on('error', (error) => this.handleServerError(error));
    }

    async stop() {
        if (!this.server || !this.isRunning) {
            return;
        }

        // Unregister from ThreadBus
        const threadBus = getThreadBus();
        threadBus.unregister('tampermonkey-server');

        await new Promise((resolve) => {
            this.server.close(() => {
                this.isRunning = false;
                this.statistics.endTime = new Date();
                logger.info('[TAMPERMONKEY-SERVER] HTTP server stopped');
                resolve();
            });
        });

        if (this.wsServer) {
            this.wsServer.close();
            this.wsServer = null;
        }

        this.clients.forEach((client) => {
            try {
                client.terminate();
            } catch (error) {
                logger.warn('[TAMPERMONKEY-SERVER] Failed to terminate WS client:', error.message);
            }
        });
        this.clients.clear();
        sharedStartPromise = null;
    }

    handleServerError(error) {
        logger.error('[TAMPERMONKEY-SERVER] Server error:', error);
        this.emit('error', error);
    }

    handleWebSocketConnection(socket, req) {
        const clientId = ++this.lastClientId;
        const address = req.socket.remoteAddress;
        const clientInfo = {
            id: clientId,
            address: address,
            userAgent: req.headers['user-agent'] || 'unknown',
            connectedAt: new Date()
        };

        socket.__tmClientInfo = clientInfo;
        this.clients.add(socket);

        logger.info(`[TAMPERMONKEY-SERVER] WS client connected (${clientId}) from ${address}`);
        this.emit('client:connected', clientInfo);

        socket.on('message', (raw) => this.handleWebSocketMessage(socket, raw));
        socket.on('close', (code, reason) => {
            this.clients.delete(socket);
            this.emit('client:disconnected', { ...clientInfo, code, reason: reason?.toString() });
            logger.info(`[TAMPERMONKEY-SERVER] WS client disconnected (${clientId})`);
        });
        socket.on('error', (error) => {
            logger.warn(`[TAMPERMONKEY-SERVER] WS client error (${clientId}): ${error.message}`);
        });

        this.flushPendingMessages(socket);
        this.sendWsMessage(socket, 'server-ready', {
            timestamp: Date.now(),
            host: this.host,
            port: this.port
        });
    }

    handleWebSocketMessage(socket, raw) {
        let message = null;

        try {
            message = JSON.parse(raw);
        } catch (error) {
            logger.warn('[TAMPERMONKEY-SERVER] Invalid WS payload received');
            return;
        }

        const type = message?.type;
        const payload = message?.payload ?? message?.data ?? {};

        switch (type) {
            case 'hello':
                socket.__tmClientInfo = { ...socket.__tmClientInfo, ...payload };
                this.sendWsMessage(socket, 'ack', { message: 'hello-received' });
                break;
            case 'page':
                this.processPagePayload(payload).catch((error) => this.handleServerError(error));
                break;
            case 'complete':
                this.processCompletionPayload(payload).catch((error) => this.handleServerError(error));
                break;
            case 'log':
                logger.info(`[TAMPERMONKEY] ${payload.level || 'info'}: ${payload.message || ''}`);
                break;
            case 'pong':
                break;
            default:
                logger.warn(`[TAMPERMONKEY-SERVER] Unknown WS message type: ${type}`);
        }
    }

    sendWsMessage(socket, type, payload) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            socket.send(JSON.stringify({ type, payload }));
        } catch (error) {
            logger.warn('[TAMPERMONKEY-SERVER] Failed to send WS message:', error.message);
        }
    }

    broadcastMessage(message) {
        const serialized = JSON.stringify(message);

        if (this.clients.size === 0) {
            this.queueOutboundMessage(serialized);
            return;
        }

        this.clients.forEach((socket) => {
            if (socket.readyState === WebSocket.OPEN) {
                try {
                    socket.send(serialized);
                } catch (error) {
                    logger.warn('[TAMPERMONKEY-SERVER] Failed to broadcast WS message:', error.message);
                }
            }
        });
    }

    queueOutboundMessage(serializedMessage) {
        this.pendingOutboundMessages.push(serializedMessage);
        if (this.pendingOutboundMessages.length > this.maxPendingMessages) {
            this.pendingOutboundMessages.shift();
        }
    }

    flushPendingMessages(socket) {
        if (!this.pendingOutboundMessages.length || socket.readyState !== WebSocket.OPEN) {
            return;
        }

        this.pendingOutboundMessages.forEach((message) => {
            try {
                socket.send(message);
            } catch (error) {
                logger.warn('[TAMPERMONKEY-SERVER] Failed to flush pending WS message:', error.message);
            }
        });
        this.pendingOutboundMessages = [];
    }

    sendCommand(action, payload = {}) {
        this.broadcastMessage({ type: 'command', action, payload });
    }

    broadcastConfig(config = {}) {
        this.broadcastMessage({ type: 'config', payload: config });
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
        req.on('data', (chunk) => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const pageData = JSON.parse(body);
                await this.processPagePayload(pageData);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Page received',
                    totalPages: this.statistics.totalPages
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

    async processPagePayload(pageData = {}) {
        if (!pageData || !pageData.content || !pageData.url) {
            throw new Error('Invalid page payload received');
        }

        const sourceType = (pageData.sourceType || 'page').toLowerCase();
        if (!this.statistics.sourceCount[sourceType]) {
            this.statistics.sourceCount[sourceType] = 0;
        }
        this.statistics.sourceCount[sourceType]++;
        this.statistics.totalPages++;
        this.statistics.totalBytes += pageData.contentLength || pageData.content.length || 0;

        logger.info(`[TAMPERMONKEY-SERVER] Received page: ${pageData.url}`);
        logger.info(`  Source: ${sourceType}, Depth: ${pageData.depth}, Content length: ${pageData.contentLength}`);

        this.receivedPages.push(pageData);
        if (this.receivedPages.length > 2000) {
            this.receivedPages.shift();
        }

        this.emit('page', pageData);
    }

    async handleComplete(req, res) {
        this.handleCORS(res);

        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const completeData = JSON.parse(body);
                await this.processCompletionPayload(completeData);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Completion acknowledged'
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

    async processCompletionPayload(payload = {}) {
        const completionSource = (payload.sourceType || 'page').toLowerCase();
        logger.success('[TAMPERMONKEY-SERVER] Crawl completed');
        logger.info(`  Mode: ${completionSource}`);
        logger.info(`  Total pages: ${payload.totalPages}`);
        logger.info(`  Failed URLs: ${payload.failedUrls?.length || 0}`);

        this.statistics.endTime = new Date();
        this.emit('complete', payload);
    }

    handleStatus(req, res) {
        this.handleCORS(res);

        const uptime = this.statistics.startTime
            ? (Date.now() - this.statistics.startTime.getTime()) / 1000
            : 0;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            isRunning: this.isRunning,
            statistics: {
                ...this.statistics,
                uptime: uptime,
                receivedPagesCount: this.receivedPages.length,
                connectedClients: this.clients.size,
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
            receivedPagesCount: this.receivedPages.length,
            connectedClients: this.clients.size
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
