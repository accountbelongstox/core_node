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
const AuthManager = require('#@ncore/utils/ws_rpc/libs/AuthManager');
const RateLimiter = require('#@ncore/utils/ws_rpc/libs/RateLimiter');
const PerformanceMonitor = require('#@ncore/utils/ws_rpc/libs/PerformanceMonitor');
const MiddlewareChain = require('#@ncore/utils/ws_rpc/libs/MiddlewareChain');
const InterceptorManager = require('#@ncore/utils/ws_rpc/libs/InterceptorManager');

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

        this.app.get(`${this.basePath}/health`, (req, res) => {
            res.json({
                status: 'ok',
                timestamp: Date.now(),
                routeCount: this.routes.size,
                sessions: this.sessionManager.getSessionCount(),
                cachedResponses: this.responseCache.size()
            });
        });

        this.started = true;
        logger.success(`HTTP RPC Server started at ${this.basePath}`);
    }

    stop() {
        this.rateLimiter.destroy();
        this.sessions.clear();
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
            sessionCount: this.sessions.size
        };
    }

    async _handleRequest(req, res) {
        let requestId = null;
        let sessionId = null;

        try {
            if (!req.body || typeof req.body !== 'object') {
                return this._sendError(res, 400, ERROR_CODES.INTERNAL_ERROR, 'Invalid request body');
            }

            const message = req.body;
            requestId = message.id || uuidv4();
            sessionId = this._getSessionId(req);

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

            const handler = this.routes.get(message.route);
            if (!handler) {
                logger.error(`Route not found: ${message.route}`);
                return this._sendError(res, 404, ERROR_CODES.ROUTE_NOT_FOUND, `Route not found: ${message.route}`);
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

            this._sendResponse(res, requestId, true, processedResult);
            this.performance.endRequest(requestId, true);

            logger.debug(`HTTP RPC Route executed: ${message.route}`);

        } catch (error) {
            logger.error('HTTP RPC request error:', error);

            const handledError = await this.interceptors.executeErrorInterceptors(error, { sessionId });

            this._sendError(res, 500, ERROR_CODES.INTERNAL_ERROR, handledError.message || error.message);

            if (requestId) {
                this.performance.endRequest(requestId, false, error);
            }
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
