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

const expressOrigin = require('express');
const logger = require('#@logger');
const localRpcGuard = require('#@foundation/common/local_rpc_guard.js');
const rpcCommon = require('../../common');

const INTERNAL_ERROR_CODE = rpcCommon.RPC_CONSTANTS.ERROR_CODES.INTERNAL_ERROR;

function guardOptions() {
    const config = rpcCommon.getConfig();

    return {
        allowedOrigins: config.ALLOWED_ORIGINS || [],
        credentials: Boolean(config.CORS_CREDENTIALS)
    };
}


class ExpressProvider {
    constructor() {
        this.app = expressOrigin();
        this.server = null
        this.configureMiddleware();
        this.wsToken = false
    }

    configureMiddleware() {
        // Loopback trust or client-key signature (K7), CORS for allowed origins only
        this.app.use((req, res, next) => localRpcGuard.createExpressGuard(guardOptions())(req, res, next));

        // Parse JSON and URL-encoded bodies, keeping the exact bytes for the signed body digest
        this.app.use(expressOrigin.json({ verify: localRpcGuard.captureRawBody }));
        this.app.use(expressOrigin.urlencoded({ extended: true, verify: localRpcGuard.captureRawBody }));
        this.app.use(localRpcGuard.createExpressBodyDigestCheck());

        // Add security headers
        this.app.use((req, res, next) => {
            res.header('X-Content-Type-Options', 'nosniff');
            res.header('X-Frame-Options', 'DENY');
            res.header('X-XSS-Protection', '1; mode=block');
            next();
        });

        // Error handling middleware
        this.app.use((err, req, res, next) => {
            logger.error('Express middleware error: ' + (err && err.message));
            if (res.headersSent) {
                return;
            }
            res.status((err && err.status) || 500).json({ success: false, code: INTERNAL_ERROR_CODE, error: INTERNAL_ERROR_CODE });
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
