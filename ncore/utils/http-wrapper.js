// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const logger = require('#@logger');
const { btools } = require('#@btools');
const path = require('path');

class HttpWrapper {
    constructor() {
        this.name = 'HttpWrapper';
        this.server = null;
        this.wsServer = null;
        this.config = {
            port: 8080,
            host: 'localhost',
            enableWs: true,
            staticDir: null,
            cors: true
        };
        this.initialized = false;
    }

    async initialize(config = {}) {
        if (this.initialized) {
            return this;
        }

        try {
            this.config = { ...this.config, ...config };
            this.initialized = true;
            logger.info('HttpWrapper initialized successfully');
            return this;
        } catch (error) {
            logger.error(`Failed to initialize HttpWrapper: ${error.message}`);
            throw error;
        }
    }

    createServer(config = {}) {
        const serverConfig = { ...this.config, ...config };

        // Simple Express server setup
        const express = require('express');
        const app = express();

        // Basic middleware
        app.use(express.json());
        if (serverConfig.cors) {
            app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
                next();
            });
        }

        // API routes
        app.get('/api/status', (req, res) => {
            res.json({
                success: true,
                data: {
                    status: 'running',
                    server: 'HttpWrapper',
                    port: serverConfig.port,
                    timestamp: new Date().toISOString()
                }
            });
        });

        app.get('/api/tools', (req, res) => {
            res.json({
                success: true,
                data: {
                    message: 'Tools API endpoint - placeholder for future implementation',
                    tools: []
                }
            });
        });

        app.get('/', (req, res) => {
            res.send('<h1>Core Node MCP Server</h1><p>HTTP API is running on port ' + serverConfig.port + '</p>');
        });

        this.server = {
            app: app,
            port: serverConfig.port,
            host: serverConfig.host
        };

        return this.server;
    }

    async startServer(serverInstance = null) {
        const server = serverInstance || this.server || this.createServer();

        return new Promise((resolve, reject) => {
            const http = require('http');
            const httpServer = http.createServer(server.app);

            httpServer.listen(server.port, server.host, () => {
                logger.info(`HTTP server started on ${server.host}:${server.port}`);
                this.server = { ...server, http: httpServer };
                resolve(this.server);
            });

            httpServer.on('error', (error) => {
                logger.error(`HTTP server error: ${error.message}`);
                reject(error);
            });
        });
    }

    async stopServer() {
        if (this.server && this.server.http) {
            return new Promise((resolve) => {
                this.server.http.close(() => {
                    logger.info('HTTP server stopped');
                    this.server = null;
                    resolve();
                });
            });
        }
    }

    getStatus() {
        return {
            initialized: this.initialized,
            running: this.server !== null,
            config: this.config
        };
    }
}

let instance = null;

function getInstance() {
    if (!instance) {
        instance = new HttpWrapper();
    }
    return instance;
}

function createServer(config = {}) {
    return getInstance().createServer(config);
}

async function startServer(options = {}) {
    return await getInstance().startServer(null, options);
}

module.exports = {
    getInstance,
    createServer,
    startServer
};