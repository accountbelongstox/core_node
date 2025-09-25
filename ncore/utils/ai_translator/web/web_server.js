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

const logger = require('#@logger');
const expressProvider = require('#@ncore/foundation/express_utils/provider/expressProvider.js');
const { expressManager } = require('#@ncore/foundation/express_utils/libs/ExpressManager.js');
const { updateConfig } = require('#@ncore/foundation/express_utils/config/index.js');
const ApiRoutes = require('./routes/api.js');
const WebRoutes = require('./routes/web.js');
const path = require('path');

class WebServer {
    constructor(config, translationManager) {
        this.config = config;
        this.translationManager = translationManager;
        this.app = null;
        this.server = null;
        this.isRunning = false;
        this.startTime = null;
    }

    async start() {
        try {
            logger.info('[AI Translator Web] Starting web server...');
            
            // Update express_utils config
            updateConfig({
                HTTP_PORT: this.config.webConfig.port,
                HTTP_HOST: this.config.webConfig.host,
                SSL_ENABLED: false
            });

            // Get Express app from provider
            this.app = expressProvider.getExpressApp();
            
            await this.setupMiddleware();
            await this.setupRoutes();
            
            // Start the express manager
            this.server = await expressManager.start(this.config.webConfig.port);
            
            this.isRunning = true;
            this.startTime = new Date();
            
            logger.info(`[AI Translator Web] Web server started on ${this.config.webConfig.host}:${this.config.webConfig.port}`);
            
        } catch (error) {
            logger.error(`[AI Translator Web] Failed to start web server: ${error.message}`);
            throw error;
        }
    }

    async setupMiddleware() {
        const express = require('express');
        
        // JSON parsing middleware
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // CORS middleware
        if (this.config.webConfig.enableCors) {
            this.app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
                
                if (req.method === 'OPTIONS') {
                    res.sendStatus(200);
                } else {
                    next();
                }
            });
        }

        // Request logging middleware
        this.app.use((req, res, next) => {
            logger.debug(`[AI Translator Web] ${req.method} ${req.path} - ${req.ip}`);
            next();
        });

        // Error handling middleware
        this.app.use((error, req, res, next) => {
            logger.error(`[AI Translator Web] Request error: ${error.message}`);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        });
    }

    async setupRoutes() {
        // Initialize route handlers
        const apiRoutes = new ApiRoutes(this.translationManager, this.config);
        const webRoutes = new WebRoutes(this.translationManager, this.config);
        
        // Setup API routes
        this.app.use(this.config.webConfig.apiPrefix || '/api', apiRoutes.getRouter());
        
        // Setup web interface routes
        this.app.use('/', webRoutes.getRouter());
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                service: 'AI Translator Web Interface'
            });
        });
        
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Not found',
                path: req.originalUrl
            });
        });
    }

    async stop() {
        if (!this.isRunning) {
            logger.warn('[AI Translator Web] Web server is not running');
            return;
        }

        try {
            logger.info('[AI Translator Web] Stopping web server...');
            
            if (this.server && this.server.close) {
                await new Promise((resolve) => {
                    this.server.close(resolve);
                });
            }
            
            this.isRunning = false;
            this.startTime = null;
            this.server = null;
            
            logger.info('[AI Translator Web] Web server stopped successfully');
            
        } catch (error) {
            logger.error(`[AI Translator Web] Error stopping web server: ${error.message}`);
            throw error;
        }
    }

    async getStatus() {
        return {
            isRunning: this.isRunning,
            startTime: this.startTime,
            uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
            port: this.config.webConfig.port,
            host: this.config.webConfig.host,
            endpoints: {
                dashboard: `http://${this.config.webConfig.host}:${this.config.webConfig.port}/`,
                api: `http://${this.config.webConfig.host}:${this.config.webConfig.port}${this.config.webConfig.apiPrefix || '/api'}`,
                health: `http://${this.config.webConfig.host}:${this.config.webConfig.port}/health`
            }
        };
    }

    async restart() {
        logger.info('[AI Translator Web] Restarting web server...');
        await this.stop();
        await this.start();
        logger.info('[AI Translator Web] Web server restarted successfully');
    }
}

module.exports = WebServer;