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

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const logger = require('#@logger');
const { RPC_CONSTANTS, getSessionManager, getRequestManager, getResponseCache } = require('../common');
const AuthManager = require('../ws_rpc/libs/AuthManager');
const RateLimiter = require('../ws_rpc/libs/RateLimiter');
const PerformanceMonitor = require('../ws_rpc/libs/PerformanceMonitor');
const MiddlewareChain = require('../ws_rpc/libs/MiddlewareChain');
const InterceptorManager = require('../ws_rpc/libs/InterceptorManager');

const MSG_TYPES = RPC_CONSTANTS.MESSAGE_TYPES;
const ERROR_CODES = RPC_CONSTANTS.ERROR_CODES;
const EVENTS = RPC_CONSTANTS.EVENTS;

class HttpRpcServer extends EventEmitter {
    constructor(expressApp, options = {}) {
        super();

        if (!expressApp) {
            throw new Error('Express app instance is required');
        }

        this.app = expressApp;
        this.basePath = options.basePath || '/rpc';
        this.requestTimeout = options.requestTimeout || 30000;
        this.maxPayloadSize = options.maxPayloadSize || 1048576;

        this.routes = new Map();
        this.started = false;

        this.sessionManager = getSessionManager();
        this.requestManager = getRequestManager();
        this.responseCache = getResponseCache();
        this.subAppManager = require('../common').getSubAppManager();

        this.auth = new AuthManager({
            enabled: options.auth?.enabled,
            secret: options.auth?.secret,
            tokenExpiry: options.auth?.tokenExpiry,
            authHandler: options.auth?.handler
        });

        this.rateLimiter = new RateLimiter({
            enabled: options.rateLimit?.enabled,
            maxRequests: options.rateLimit?.maxRequests,
            windowMs: options.rateLimit?.windowMs,
            onLimitReached: (sessionId) => this.emit('rateLimitReached', sessionId)
        });

        this.performance = new PerformanceMonitor({
            enabled: options.performance?.enabled !== false,
            sampleRate: options.performance?.sampleRate,
            maxHistorySize: options.performance?.maxHistorySize
        });

        this.middleware = new MiddlewareChain();
        this.interceptors = new InterceptorManager();

        this.options = options;
    }

    start() {
        if (this.started) {
            logger.warn('HTTP RPC Server already started');
            return;
        }

        this.app.post(this.basePath, async (req, res) => {
            await this._handleRequest(req, res);
        });

        this.app.get(`${this.basePath}/query/:requestId`, async (req, res) => {
            await this._handleQuery(req, res);
        });

        this.app.get(`${this.basePath}/client.js`, (req, res) => {
            const path = require('path');
            const clientPath = path.join(__dirname, '../client/UnifiedRpcClient.js');
            res.type('application/javascript');
            res.sendFile(clientPath);
        });

        this.app.get(`${this.basePath}/health`, (req, res) => {
            const subAppStats = this.subAppManager.getStats();
            res.json({
                status: 'ok',
                timestamp: Date.now(),
                routeCount: this.routes.size,
                subAppRoutesCount: subAppStats.routesCount,
                subAppsCount: subAppStats.subAppsCount,
                sessions: this.sessionManager.getSessionCount(),
                cachedResponses: this.responseCache.size()
            });
        });

        this.app.get(`${this.basePath}/subapps`, (req, res) => {
            const stats = this.subAppManager.getStats();
            res.json(stats);
        });

        this.started = true;
        logger.success(`HTTP RPC Server started at ${this.basePath}`);
        logger.success(`RPC Client library available at: ${this.basePath}/client.js`);

        if (this.subAppManager.subApps.size > 0) {
            logger.success(`SubApps registered: ${this.subAppManager.getAllSubApps().join(', ')}`);
        }
    }

    stop() {
        this.rateLimiter.destroy();
        this.responseCache.stopAutoCleanup();
        this.started = false;
        logger.info('HTTP RPC Server stopped');
    }

    use(middleware) {
        this.middleware.use(middleware);
        return this;
    }

    useError(errorHandler) {
        this.middleware.useError(errorHandler);
        return this;
    }

    addRequestInterceptor(onFulfilled, onRejected) {
        return this.interceptors.addRequestInterceptor(onFulfilled, onRejected);
    }

    addResponseInterceptor(onFulfilled, onRejected) {
        return this.interceptors.addResponseInterceptor(onFulfilled, onRejected);
    }

    addErrorInterceptor(handler) {
        return this.interceptors.addErrorInterceptor(handler);
    }

    route(routeName, handler) {
        if (typeof handler !== 'function') {
            logger.error(`Handler for route "${routeName}" must be a function`);
            return this;
        }

        this.routes.set(routeName, handler);
        logger.debug(`HTTP RPC Route registered: ${routeName}`);
        return this;
    }

    getPerformanceStats() {
        return this.performance.getGlobalStats();
    }

    getRouteStats(routeName) {
        return this.performance.getRouteStats(routeName);
    }

    getSessionStats(sessionId) {
        return this.performance.getClientStats(sessionId);
    }

    getRateLimitStats(sessionId) {
        return this.rateLimiter.getStats(sessionId);
    }

    getAllStats() {
        return {
            performance: this.getPerformanceStats(),
            middlewareCount: this.middleware.count(),
            interceptorCount: this.interceptors.getCount(),
            routeCount: this.routes.size,
            sessionCount: this.sessionManager.getSessionCount(),
            requestStats: this.requestManager.getStats(),
            cacheStats: this.responseCache.getStats()
        };
    }

    async _handleRequest(req, res) {
        let requestId = null;
        let sessionId = null;
        let clientId = null;

        try {
            if (!req.body || typeof req.body !== 'object') {
                return this._sendError(res, 400, ERROR_CODES.INTERNAL_ERROR, 'Invalid request body');
            }

            const message = req.body;
            requestId = message.id || uuidv4();
            clientId = message.clientId || this._getSessionId(req);
            sessionId = this.sessionManager.createSession(clientId);

            this.sessionManager.updateActivity(sessionId);
            this.sessionManager.addToGroup(clientId, sessionId);

            if (message.type !== MSG_TYPES.REQUEST) {
                return this._sendError(res, 400, ERROR_CODES.INTERNAL_ERROR, 'Invalid message type');
            }

            const rateLimitCheck = this.rateLimiter.check(sessionId);
            if (!rateLimitCheck.allowed) {
                logger.warn(`Rate limit exceeded for session ${sessionId}`);
                return this._sendError(res, 429, ERROR_CODES.FORBIDDEN, 'Rate limit exceeded');
            }

            if (this.auth.enabled && !this.auth.isAuthenticated(sessionId)) {
                logger.warn(`Unauthorized request from session ${sessionId}`);
                return this._sendError(res, 401, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
            }

            let handler = this.routes.get(message.route);
            let isSubAppRoute = false;

            if (!handler) {
                if (this.subAppManager.routes.has(message.route)) {
                    handler = async (params, sessionId, ctx) => {
                        return await this.subAppManager.executeRoute(
                            message.route,
                            params,
                            requestId,
                            { ...ctx, sessionId }
                        );
                    };
                    isSubAppRoute = true;
                } else {
                    logger.error(`Route not found: ${message.route}`);
                    return this._sendError(res, 404, ERROR_CODES.ROUTE_NOT_FOUND, `Route not found: ${message.route}`);
                }
            }

            this.performance.startRequest(requestId, message.route, sessionId);

            const context = {
                sessionId,
                requestId,
                route: message.route,
                params: message.params,
                auth: this.auth.getAuthData(sessionId),
                req,
                res
            };

            const result = await this.middleware.execute(context, async (ctx) => {
                return await Promise.resolve(handler(ctx.params, ctx.sessionId, ctx));
            });

            let processedResult = await this.interceptors.executeResponseInterceptors(result);

            const responseData = {
                type: MSG_TYPES.RESPONSE,
                id: requestId,
                success: true,
                result: processedResult,
                timestamp: Date.now()
            };

            this.responseCache.set(requestId, responseData, 1800000);

            this._sendResponse(res, requestId, true, processedResult);
            this.performance.endRequest(requestId, true);

            logger.debug(`HTTP RPC Route executed: ${message.route}, cached response for ${requestId}`);

        } catch (error) {
            logger.error('HTTP RPC request error:', error);

            const handledError = await this.interceptors.executeErrorInterceptors(error, { sessionId });

            const errorData = {
                type: MSG_TYPES.ERROR,
                id: requestId,
                success: false,
                error: handledError.message || error.message,
                code: ERROR_CODES.INTERNAL_ERROR,
                timestamp: Date.now()
            };

            if (requestId) {
                this.responseCache.set(requestId, errorData, 1800000);
                this.performance.endRequest(requestId, false, error);
            }

            this._sendError(res, 500, ERROR_CODES.INTERNAL_ERROR, handledError.message || error.message);
        }
    }

    async _handleQuery(req, res) {
        try {
            const { requestId } = req.params;

            if (!requestId) {
                return res.status(400).json({
                    success: false,
                    error: 'requestId is required'
                });
            }

            const cachedResponse = this.responseCache.get(requestId, true);

            if (!cachedResponse) {
                return res.status(404).json({
                    success: false,
                    error: 'Response not found or expired',
                    requestId
                });
            }

            res.json(cachedResponse);

            logger.debug(`HTTP RPC Query: ${requestId} - response delivered`);

        } catch (error) {
            logger.error('HTTP RPC query error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    _sendResponse(res, requestId, success, result = null, code = null, error = null) {
        res.json({
            type: MSG_TYPES.RESPONSE,
            id: requestId,
            success,
            result,
            code,
            error,
            timestamp: Date.now()
        });
    }

    _sendError(res, httpCode, rpcCode, message) {
        res.status(httpCode).json({
            type: MSG_TYPES.ERROR,
            code: rpcCode,
            error: message,
            timestamp: Date.now()
        });
    }

    _getSessionId(req) {
        return req.session?.id ||
               req.headers['x-session-id'] ||
               req.cookies?.sessionId ||
               req.headers['x-forwarded-for']?.split(',')[0] ||
               req.connection?.remoteAddress ||
               'anonymous';
    }
}

module.exports = HttpRpcServer;
