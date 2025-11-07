const logger = require('#@logger');
const { v4: uuidv4 } = require('uuid');

function deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }

    return result;
}

class SubAppManager {
    constructor() {
        this.subApps = new Map();
        this.routes = new Map();
        this.staticPaths = new Map();
        this.configs = new Map();
        this.pendingRequests = new Map();
    }

    registerSubApp(appName, options = {}) {
        if (this.subApps.has(appName)) {
            logger.warn(`SubApp ${appName} already registered, overwriting...`);
        }

        const subApp = {
            name: appName,
            config: options.config || {},
            staticPaths: options.staticPaths || {},
            routes: new Map(),
            middleware: options.middleware || [],
            registeredAt: Date.now()
        };

        this.subApps.set(appName, subApp);
        this.configs.set(appName, subApp.config);

        if (subApp.staticPaths) {
            for (const [urlPath, dirs] of Object.entries(subApp.staticPaths)) {
                if (!this.staticPaths.has(urlPath)) {
                    this.staticPaths.set(urlPath, []);
                }
                const existing = this.staticPaths.get(urlPath);
                const newDirs = Array.isArray(dirs) ? dirs : [dirs];
                this.staticPaths.set(urlPath, [...existing, ...newDirs]);
            }
        }

        logger.success(`SubApp registered: ${appName}`);
        return subApp;
    }

    registerRoute(appName, routeName, handler, options = {}) {
        if (!this.subApps.has(appName)) {
            throw new Error(`SubApp ${appName} not registered`);
        }

        if (typeof handler !== 'function') {
            throw new Error(`Handler for route ${routeName} must be a function`);
        }

        const fullRouteName = options.useFullName !== false
            ? `${appName}.${routeName}`
            : routeName;

        if (this.routes.has(fullRouteName)) {
            logger.warn(`Route ${fullRouteName} already registered, overwriting...`);
        }

        const routeInfo = {
            appName,
            routeName,
            fullRouteName,
            handler,
            options,
            registeredAt: Date.now()
        };

        const subApp = this.subApps.get(appName);
        subApp.routes.set(routeName, routeInfo);
        this.routes.set(fullRouteName, routeInfo);

        logger.debug(`Route registered: ${fullRouteName} (app: ${appName})`);
        return fullRouteName;
    }

    async executeRoute(fullRouteName, params, requestId, context = {}) {
        if (!this.routes.has(fullRouteName)) {
            throw new Error(`Route not found: ${fullRouteName}`);
        }

        const routeInfo = this.routes.get(fullRouteName);
        const { appName, handler } = routeInfo;
        const subApp = this.subApps.get(appName);

        this.pendingRequests.set(requestId, {
            appName,
            routeName: fullRouteName,
            startTime: Date.now(),
            context
        });

        try {
            const enhancedContext = {
                ...context,
                appName,
                routeName: fullRouteName,
                requestId,
                subAppConfig: this.configs.get(appName),
                returnResult: (result) => this._handleResult(requestId, result, null),
                returnError: (error) => this._handleResult(requestId, null, error)
            };

            let result;

            if (subApp.middleware && subApp.middleware.length > 0) {
                result = await this._executeWithMiddleware(
                    subApp.middleware,
                    enhancedContext,
                    async (ctx) => await Promise.resolve(handler(params, ctx))
                );
            } else {
                result = await Promise.resolve(handler(params, enhancedContext));
            }

            this._handleResult(requestId, result, null);
            return result;

        } catch (error) {
            this._handleResult(requestId, null, error);
            throw error;
        }
    }

    async _executeWithMiddleware(middlewareStack, context, finalHandler) {
        let index = 0;

        const next = async (ctx = context) => {
            if (index < middlewareStack.length) {
                const middleware = middlewareStack[index++];
                return await middleware(ctx, next);
            } else {
                return await finalHandler(ctx);
            }
        };

        return await next(context);
    }

    _handleResult(requestId, result, error) {
        const pending = this.pendingRequests.get(requestId);
        if (!pending) {
            logger.warn(`No pending request found for requestId: ${requestId}`);
            return;
        }

        const duration = Date.now() - pending.startTime;

        logger.debug(`Request completed: ${pending.routeName} (${duration}ms)`);

        this.pendingRequests.delete(requestId);

        return {
            success: !error,
            result,
            error: error ? error.message : null,
            duration,
            requestId,
            appName: pending.appName,
            routeName: pending.routeName
        };
    }

    getSubApp(appName) {
        return this.subApps.get(appName);
    }

    getAllSubApps() {
        return Array.from(this.subApps.keys());
    }

    getRoutes(appName = null) {
        if (appName) {
            const subApp = this.subApps.get(appName);
            return subApp ? Array.from(subApp.routes.keys()) : [];
        }
        return Array.from(this.routes.keys());
    }

    getMergedConfig(baseConfig = {}) {
        let merged = { ...baseConfig };

        for (const [appName, config] of this.configs.entries()) {
            merged = deepMerge(merged, config);
        }

        return merged;
    }

    getMergedStaticPaths(basePaths = {}) {
        const merged = { ...basePaths };

        for (const [urlPath, dirs] of this.staticPaths.entries()) {
            if (!merged[urlPath]) {
                merged[urlPath] = [];
            }
            const existing = Array.isArray(merged[urlPath])
                ? merged[urlPath]
                : [merged[urlPath]];
            merged[urlPath] = [...existing, ...dirs];
        }

        return merged;
    }

    getStats() {
        return {
            subAppsCount: this.subApps.size,
            routesCount: this.routes.size,
            staticPathsCount: this.staticPaths.size,
            pendingRequestsCount: this.pendingRequests.size,
            subApps: Array.from(this.subApps.entries()).map(([name, app]) => ({
                name,
                routesCount: app.routes.size,
                registeredAt: app.registeredAt
            }))
        };
    }

    unregisterSubApp(appName) {
        const subApp = this.subApps.get(appName);
        if (!subApp) {
            logger.warn(`SubApp ${appName} not found`);
            return false;
        }

        for (const routeName of subApp.routes.keys()) {
            const fullRouteName = `${appName}.${routeName}`;
            this.routes.delete(fullRouteName);
        }

        this.subApps.delete(appName);
        this.configs.delete(appName);

        logger.info(`SubApp unregistered: ${appName}`);
        return true;
    }

    clear() {
        this.subApps.clear();
        this.routes.clear();
        this.staticPaths.clear();
        this.configs.clear();
        this.pendingRequests.clear();
        logger.info('SubAppManager cleared');
    }
}

const defaultSubAppManager = new SubAppManager();

module.exports = {
    SubAppManager,
    defaultSubAppManager
};
