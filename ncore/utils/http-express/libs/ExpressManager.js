const express = require('express');
    const https = require('https');
    const http = require('http');
    const WebSocket = require('ws');
    const logger = require('#@utils_logger');
    const RouterManager = require('./RouterManager.js');
    const MiddlewareUtil = require('./MiddlewareUtil.js');
    const { getConfig } = require('../config/index.js');

    class ExpressManager {
        constructor() {
            this.app = express();
            this.server = null;
            this.wss = null;
            this.config = null;
            this.init();
        }

        async init() {
            try {
                // Get latest configuration
                this.config = await getConfig();
                
                // Set basic middlewares
                this.setupBasicMiddlewares();
                
                // Set express instance to RouterManager
                RouterManager.setExpress(this.app);
                
                // Initialize server (HTTP/HTTPS)
                this.initServer();
                
                // Initialize WebSocket if enabled
                this.initWebSocket();
                
                logger.success('Express Manager initialized successfully');
                return this;
            } catch (error) {
                logger.error('Failed to initialize Express Manager:', error);
                throw error;
            }
        }

        setupBasicMiddlewares() {
            // Add common middlewares
            MiddlewareUtil.getCommonMiddlewares(this.config).forEach(middleware => {
                this.app.use(middleware);
            });
        }

        initServer() {
            if (this.config.SSL_ENABLED) {
                this.server = https.createServer({
                    key: this.config.SSL_KEY,
                    cert: this.config.SSL_CERT,
                    rejectUnauthorized: this.config.SSL_REJECT_UNAUTHORIZED
                }, this.app);
                logger.info('HTTPS server initialized');
            } else {
                this.server = http.createServer(this.app);
                logger.info('HTTP server initialized');
            }
        }

        initWebSocket() {
            if (this.config.WEBSOCKET_ENABLED) {
                this.wss = new WebSocket.Server({ 
                    server: this.server,
                    path: this.config.WEBSOCKET_PATH,
                    clientTracking: this.config.WEBSOCKET_CLIENT_TRACKING,
                    perMessageDeflate: this.config.WEBSOCKET_DEFLATE,
                    maxPayload: this.config.WEBSOCKET_MAX_PAYLOAD
                });

                this.wss.on('connection', this.handleWebSocket.bind(this));
                logger.info('WebSocket server initialized');
            }
        }

        handleWebSocket(ws, req) {
            logger.info('New WebSocket connection');

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    logger.info('Received WebSocket message:', data);
                    
                    if (data.type && this.wsHandlers[data.type]) {
                        this.wsHandlers[data.type](ws, data);
                    }
                } catch (error) {
                    logger.error('WebSocket message handling error:', error);
                }
            });

            ws.on('close', () => {
                logger.info('Client disconnected');
            });

            ws.on('error', (error) => {
                logger.error('WebSocket error:', error);
            });
        }

        wsHandlers = {
            ping: (ws, data) => {
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }
        };

        broadcast(message) {
            if (!this.wss) return;
            
            this.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            });
        }

        getExpressApp() {
            return this.app;
        }

        getServer() {
            return this.server;
        }

        getWSServer() {
            return this.wss;
        }

        async start(port) {
            if (!this.server) {
                await this.init();
            }

            // Use provided port or get from config
            const serverPort = port || this.config.HTTP_PORT;
            const serverHost = this.config.HTTP_HOST;

            return new Promise((resolve, reject) => {
                try {
                    this.server.listen(serverPort, serverHost, () => {
                        const protocol = this.config.SSL_ENABLED ? 'HTTPS' : 'HTTP';
                        logger.success(`${protocol} Server running on ${serverHost}:${serverPort}`);
                        if (this.wss) {
                            logger.success('WebSocket server is ready');
                        }
                        resolve(this.server);
                    });
                } catch (error) {
                    logger.error('Failed to start server:', error);
                    reject(error);
                }
            });
        }
    }

    // Create singleton instance
    const expressManager = new ExpressManager();

    // Export both ExpressManager instance and RouterManager
    module.exports = { expressManager, RouterManager };


    // Add direct execution logic
    const normalizeFilePath = (filepath) => {
        return filepath.replace(/\\/g, '/');
    };

    const currentFileUrl = __filename;
    const scriptPath = `file:///${normalizeFilePath(process.argv[1])}`;

    if (currentFileUrl === scriptPath) {
        expressManager.start();
    }