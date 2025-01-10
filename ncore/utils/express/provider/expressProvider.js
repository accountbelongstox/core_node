const expressOrigin = require('express');
const fs = require('fs');

/**
 * Express provider class
 * Provides configured express instance with common middleware and settings
 */
class ExpressProvider {
    constructor() {
        this.app = expressOrigin();
        this.server = null
        this.configureMiddleware();
        this.wsToken = false
    }

    configureMiddleware() {
        // Parse JSON bodies
        this.app.use(expressOrigin.json());
        
        // Parse URL-encoded bodies
        this.app.use(expressOrigin.urlencoded({ extended: true }));
        
        // Add security headers
        this.app.use((req, res, next) => {
            res.header('X-Content-Type-Options', 'nosniff');
            res.header('X-Frame-Options', 'DENY');
            res.header('X-XSS-Protection', '1; mode=block');
            next();
        });

        // Add CORS headers
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            next();
        });

        // Handle OPTIONS requests
        this.app.options('*', (req, res) => {
            res.sendStatus(200);
        });

        // Error handling middleware
        this.app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).send('Something broke!');
        });
    }

    /**
     * Get configured express instance
     */
    getApp() {
        return this.app;
    }

    getExpress() {
        return expressOrigin;
    }

    getWsToken(){
        return this.wsToken
    }

    /**
     * Get express module
     */
    getExpressApp() {
        return this.app;
    }

    setExpressApp(app){
        this.app = app
    }

    setWsToken(wsToken){
        this.wsToken = wsToken
    }

    getServerApp() {
        return this.server;
    }

    setServerApp(server){
        this.server = server
    }

    
}

const expressProvider = new ExpressProvider();

// Export both the provider instance and express module
module.exports = expressProvider;
