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
const expressProvider = require('../provider/expressProvider');
const { processResponse } = require('../tool/response.js');
const { getConfig } = require('../config');
const path = require('path');
const fs = require('fs');
const { APP_TEMPLATE_DIR } = require('#@global_dir');
const { pathToFileURL } = require('url');
const { readText } = require('../tool/reader.js');
const fileQuery = require('./file_query.js');
const app = expressProvider.getExpressApp()
const express = expressProvider.getExpress();
const router = express.Router();

// Serve any static file from APP_TEMPLATE_DIR if it exists, with correct MIME type
const the_mime = require('mime');
app.get(/^\/([\w\-.]+\.[\w]+)$/, (req, res, next) => {
    const requestedFile = req.params[0];
    const filePath = path.join(APP_TEMPLATE_DIR, requestedFile);
    if (fs.existsSync(filePath)) {
        const mimeType = the_mime.getType(filePath) || 'application/octet-stream';
        res.type(mimeType);
        res.sendFile(filePath, err => {
            if (err) {
                logger.error(`Error serving static file: ${err}`);
                res.status(500).send('Server Error');
            }
        });
    } else {
        next();
    }
});

function findFirstAvailableFile(filePaths) {
    for (let filePath of filePaths) {
        const resolvedPath = path.resolve(filePath);
        if (fs.existsSync(resolvedPath)) {
            return resolvedPath;
        }
    }
    return null;
}

function truncateUserAgent(userAgent) {
    const index = userAgent.indexOf(')');
    if (index !== -1) {
        return userAgent.slice(0, index + 1);  // Include the character ')' if needed
    }
    return userAgent;  // Return the full User-Agent if no ')' is found
}

function logRequest(req, res, next) {
    const startTime = Date.now();
    const method = req.method;
    const path = req.originalUrl;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');
    const methodMarker = getMethodMarker(method);
    const truncateUserAgentString = truncateUserAgent(userAgent);

    logger.success(`${methodMarker} ${path} - IP: ${ip} - ${truncateUserAgentString}`);

    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        if (responseTime > 3000) {
            logger.info(`${methodMarker} ${path} - ${responseTime}ms - IP: ${ip} - ${truncateUserAgentString}`);
        } else if (responseTime > 5000) {
            logger.warning(`${methodMarker} ${path} - ${responseTime}ms - IP: ${ip} - ${truncateUserAgentString}`);
        }
    });

    next(); // Proceed to the next middleware or handler
}

// Utility function to return method-specific markers for logging
function getMethodMarker(method) {
    switch (method.toUpperCase()) {
        case 'GET':
            return '[GET]';  // Green (you can change this to your own text format)
        case 'POST':
            return '[POST]';  // Blue
        case 'PUT':
            return '[PUT]';  // Yellow
        case 'DELETE':
            return '[DELETE]';  // Red
        case 'HEAD':
            return '[HEAD]';  // Cyan for HEAD requests
        default:
            return '[OTHER]';  // White for any other method
    }
}

const defaultRouter = {
    "/": findFirstAvailableFile([
        path.join(APP_TEMPLATE_DIR, 'index.html'),
        path.join(__dirname, '../template/index.html')
    ])
}

class RouterManager {
    constructor() {
        this.routes = new Map();
    }

    addDynamicRoutes() {
        for (let route in defaultRouter) {
            const filePathOrFunction = defaultRouter[route];
            if (typeof filePathOrFunction === 'function') {
                app.get(route, filePathOrFunction);
                logger.debug(`Route ${route} added with dynamic function.`);
            } else {
                if (fs.existsSync(filePathOrFunction)) {
                    app.get(route, (req, res) => {
                        res.sendFile(filePathOrFunction, (err) => {
                            if (err) {
                                logger.error(`Error serving file: ${err}`);
                                res.status(500).send('Server Error');
                            }
                        });
                    });
                    logger.debug(`Route ${route} served from file: ${filePathOrFunction}`);
                } else {
                    logger.error(`File not found for route ${route}: ${filePathOrFunction}`);
                }
            }
        }
    }

    printRoutes() {
        const routes = [];

        app._router.stack.forEach(middleware => {
            if (middleware.route) { // This is a route
                routes.push({
                    method: Object.keys(middleware.route.methods)[0].toUpperCase(),
                    path: middleware.route.path
                });
            }
        });

        logger.debug('Registered Routes:');
        routes.forEach(route => {
            logger.debug(`${route.method} ${route.path}`);
        });
    }

    addRouteHandler(path, handler, method = 'get', printLog = true) {
        if (!path || !handler) {
            logger.error('Path and handler are required');
            return;
        }

        const validMethods = ['get', 'post', 'put', 'delete', 'head'];
        if (!validMethods.includes(method.toLowerCase())) {
            logger.error(`Invalid HTTP method: ${method}`);
            return;
        }

        const logRequestResult = (req, res, next) => {
            logRequest(req, res, next);
            next(); // Proceed to the actual handler
        };

        router[method.toLowerCase()](path, logRequest, handler);
        this.routes.set(path, { handler, method });
        app.use('/', router);
        expressProvider.setExpressApp(app);
        if(printLog) {
            logger.success(`Route added: [${method.toUpperCase()}] ${path}`);
        }
    }

    get(path, handler, printLog = true) {
        return this.addRouteHandler(path, handler, 'get', printLog);
    }

    post(path, handler, printLog = true) {
        return this.addRouteHandler(path, handler, 'post', printLog);
    }

    put(path, handler, printLog = true) {
        return this.addRouteHandler(path, handler, 'put', printLog);
    }

    delete(path, handler, printLog = true) {
        return this.addRouteHandler(path, handler, 'delete', printLog);
    }

    // Extended HEAD method (independent of download functionality)
    head(path, handler, printLog = true) {
        return this.addRouteHandler(path, handler, 'head', printLog);
    }

    // Download method - supports both file path and handler function
    download(path, filePathOrHandler, printLog = true) {
        // Create download handlers using fileQuery
        const { getHandler, headHandler } = fileQuery.createDownloadHandlers(filePathOrHandler);

        // Add GET route
        this.addRouteHandler(path, getHandler, 'get', printLog);
        
        // Add HEAD route
        this.addRouteHandler(path, headHandler, 'head', false); // Don't log HEAD separately
        
        if (printLog) {
            const type = typeof filePathOrHandler === 'function' ? 'handler function' : 'file path';
            logger.success(`Download route added: [GET/HEAD] ${path} -> ${type}`);
        }
        
        return this;
    }

    api(path, handler, printLog = true) {
        this.addRouteHandler(path, async (req, res, next) => {
            try {
                const result = await handler(req, res, next);
                res.json(processResponse(result));
            } catch (error) {
                logger.error(`Error in API route handler [GET] ${path}:`, error);
                res.status(500).json({ error: 'Internal server error' + error });
            }
        }, "get", printLog);
        this.addRouteHandler(path, async (req, res, next) => {
            try {
                const result = await handler(req, res, next);
                res.json(processResponse(result));
            } catch (error) {
                logger.error(`Error in API route handler [POST] ${path}:`, error);
                res.status(500).json({ error: 'Internal server error' + error });
            }
        }, "post", printLog);
    }

    getExpressRouter() {
        return router;
    }

    getRoutes() {
        return Array.from(this.routes.keys());
    }

    clearRoutes() {
        this.routes.clear();
        if (app && app._router) {
            app._router.stack = app._router.stack.filter(layer => {
                return layer.route === undefined;
            });
        }
        logger.info('All routes cleared');
        return this;
    }

    async start(config) {
        this.addDynamicRoutes()
        this.printRoutes()
    }

}

module.exports = new RouterManager();