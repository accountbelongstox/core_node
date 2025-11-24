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

const EventEmitter = require('events');
const WebSocket = require('ws');
const logger = require('#@logger');

let sharedInstance = null;

/**
 * Tampermonkey Service (No HTTP Server)
 * Manages WebSocket connections and page data processing for DocumentOffline Crawler
 */
class TampermonkeyService extends EventEmitter {
    constructor(options = {}) {
        super();
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
            startTime: new Date(),
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

        logger.info('[TAMPERMONKEY-SERVICE] Service initialized');
    }

    static getInstance(options = {}) {
        if (!sharedInstance) {
            sharedInstance = new TampermonkeyService(options);
        }
        return sharedInstance;
    }

    /**
     * Handle WebSocket connection
     */
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

        logger.info(`[TAMPERMONKEY-SERVICE] WS client connected (${clientId}) from ${address}`);
        this.emit('client:connected', clientInfo);

        socket.on('message', (raw) => this.handleWebSocketMessage(socket, raw));
        socket.on('close', (code, reason) => {
            this.clients.delete(socket);
            this.emit('client:disconnected', { ...clientInfo, code, reason: reason?.toString() });
            logger.info(`[TAMPERMONKEY-SERVICE] WS client disconnected (${clientId})`);
        });
        socket.on('error', (error) => {
            logger.warn(`[TAMPERMONKEY-SERVICE] WS client error (${clientId}): ${error.message}`);
        });

        this.flushPendingMessages(socket);
        this.sendWsMessage(socket, 'server-ready', {
            timestamp: Date.now()
        });
    }

    handleWebSocketMessage(socket, raw) {
        let message = null;

        try {
            message = JSON.parse(raw);
        } catch (error) {
            logger.warn('[TAMPERMONKEY-SERVICE] Invalid WS payload received');
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
                this.processPagePayload(payload).catch((error) => this.handleServiceError(error));
                break;
            case 'complete':
                this.processCompletionPayload(payload).catch((error) => this.handleServiceError(error));
                break;
            case 'log':
                logger.info(`[TAMPERMONKEY] ${payload.level || 'info'}: ${payload.message || ''}`);
                break;
            case 'pong':
                break;
            default:
                logger.warn(`[TAMPERMONKEY-SERVICE] Unknown WS message type: ${type}`);
        }
    }

    sendWsMessage(socket, type, payload) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            socket.send(JSON.stringify({ type, payload }));
        } catch (error) {
            logger.warn('[TAMPERMONKEY-SERVICE] Failed to send WS message:', error.message);
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
                    logger.warn('[TAMPERMONKEY-SERVICE] Failed to broadcast WS message:', error.message);
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
                logger.warn('[TAMPERMONKEY-SERVICE] Failed to flush pending WS message:', error.message);
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

    handleServiceError(error) {
        logger.error('[TAMPERMONKEY-SERVICE] Service error:', error);
        this.emit('error', error);
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

        logger.info(`[TAMPERMONKEY-SERVICE] Received page: ${pageData.url}`);
        logger.info(`  Source: ${sourceType}, Depth: ${pageData.depth}, Content length: ${pageData.contentLength}`);

        this.receivedPages.push(pageData);
        if (this.receivedPages.length > 2000) {
            this.receivedPages.shift();
        }

        this.emit('page', pageData);

        return {
            success: true,
            message: 'Page received',
            totalPages: this.statistics.totalPages
        };
    }

    async processCompletionPayload(payload = {}) {
        const completionSource = (payload.sourceType || 'page').toLowerCase();
        logger.success('[TAMPERMONKEY-SERVICE] Crawl completed');
        logger.info(`  Mode: ${completionSource}`);
        logger.info(`  Total pages: ${payload.totalPages}`);
        logger.info(`  Failed URLs: ${payload.failedUrls?.length || 0}`);

        this.statistics.endTime = new Date();
        this.emit('complete', payload);

        return {
            success: true,
            message: 'Completion acknowledged'
        };
    }

    getStatus() {
        const uptime = this.statistics.startTime
            ? (Date.now() - this.statistics.startTime.getTime()) / 1000
            : 0;

        return {
            isRunning: true,
            statistics: {
                ...this.statistics,
                uptime: uptime,
                receivedPagesCount: this.receivedPages.length,
                connectedClients: this.clients.size,
                sourceCount: this.statistics.sourceCount
            }
        };
    }

    getPing() {
        return { pong: true };
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

module.exports = TampermonkeyService;
