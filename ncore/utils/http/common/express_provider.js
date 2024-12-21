const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const compression = require('compression');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

class ExpressProvider {
    constructor() {
        this.app = express();
        this.server = null;
        this.wss = null;
        this.setupMiddleware();
    }

    setupMiddleware() {
        // Basic security with helmet
        this.app.use(helmet({
            contentSecurityPolicy: false, // Disable CSP for development
            crossOriginEmbedderPolicy: false
        }));

        // CORS configuration
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));

        this.app.use(bodyParser.json({ limit: '5000mb' }));
        this.app.use(bodyParser.urlencoded({ extended: true, limit: '5000mb' }));
        
        this.app.use(cookieParser());

        this.app.use(compression());

        if (process.env.NODE_ENV !== 'production') {
            this.app.use(morgan('dev'));
        }

        // Error handling
        this.app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).send('Something broke!');
        });
    }

    setupWebSocket() {
        // Create HTTP server if not exists
        if (!this.server) {
            this.server = http.createServer(this.app);
        }

        // Create WebSocket server
        this.wss = new WebSocket.Server({ server: this.server });

        // WebSocket connection handling
        this.wss.on('connection', (ws) => {
            console.log('New WebSocket connection');

            // Send welcome message
            ws.send(JSON.stringify({
                type: 'connection',
                message: 'Connected to WebSocket server'
            }));

            // Handle incoming messages
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleWebSocketMessage(ws, data);
                } catch (error) {
                    console.error('WebSocket message error:', error);
                }
            });

            // Handle client disconnection
            ws.on('close', () => {
                console.log('Client disconnected');
            });
        });

        return this.wss;
    }

    handleWebSocketMessage(ws, data) {
        // Default message handler
        ws.send(JSON.stringify({
            type: 'response',
            message: 'Message received',
            data: data
        }));
    }

    getApp() {
        return this.app;
    }

    getServer() {
        if (!this.server) {
            this.server = http.createServer(this.app);
        }
        return this.server;
    }

    getWSS() {
        if (!this.wss) {
            this.setupWebSocket();
        }
        return this.wss;
    }

}

// Create and export singleton instance
module.exports = new ExpressProvider();