const expressProvider = require('../provider/expressProvider');
const app = expressProvider.getExpressApp()
const express = expressProvider.getExpress()
const path = require('path');
const fs = require('fs');
const { APP_STATIC_DIR,APP_OUTPUT_DIR, APP_TEMPLATE_DIR, APP_TEMPLATE_STATIC_DIR } = require('#@/ncore/gvar/gdir.js');
const logger = require('#@logger');
const DEFULAT_TEMPLATE_DIR = path.join(__dirname, '..', 'template'); 
const DEFULAT_STATIC_DIR = path.join(DEFULAT_TEMPLATE_DIR, 'static');


const defaultStaticConfig = {
    "/static": [APP_STATIC_DIR,APP_OUTPUT_DIR, APP_TEMPLATE_STATIC_DIR, DEFULAT_STATIC_DIR],

}

function mergeConfigs(config1, config2) {
    if (!config1 && !config2) return null
    if (!config2) return config1
    const result = { ...config1 };

    for (const [key, value2] of Object.entries(config2)) {
        const value1 = result[key];

        if (value1 === undefined) {
            result[key] = value2;
        } else if (Array.isArray(value1) || Array.isArray(value2)) {
            const array1 = Array.isArray(value1) ? value1 : [value1];
            const array2 = Array.isArray(value2) ? value2 : [value2];
            result[key] = Array.from(new Set([...array1, ...array2]));
        } else if (typeof value1 === 'string' && typeof value2 === 'string') {
            result[key] = Array.from(new Set([value1, value2]));
        } else {
            result[key] = value1;
        }
    }
    return result;
}


class StaticServer {
    constructor() {
    }

    configureStaticRoutes(staticPaths) {
        if (!staticPaths || typeof staticPaths !== 'object') {
            logger.warn('No static paths configuration provided');
            return;
        }

        logger.log('Configuring static routes...');

        Object.entries(staticPaths).forEach(([urlPath, paths]) => {
            let express_router = express.Router();
            logger.log(`\nConfiguring route: ${urlPath}`);

            if (Array.isArray(paths)) {
                paths.forEach(staticPath => {
                    express_router = this._addStaticRoute(urlPath, staticPath,express_router);
                });
            } else if (typeof paths === 'string') {
                express_router = this._addStaticRoute(urlPath, paths,express_router  );
            } else {
                logger.warn(`Invalid path configuration for route ${urlPath}`);
            }
            this.applyStaticRoutes(urlPath,express_router);
        });

        logger.log('\nStatic routes configuration completed');
    }

    _addStaticRoute(urlPath, staticPath,express_router) {
        try {
            // Check if path exists
            if (!fs.existsSync(staticPath)) {
                logger.warn(`Warning: Static path does not exist: ${staticPath}`);
                fs.mkdirSync(staticPath, { recursive: true });
                logger.log(`Created directory: ${staticPath}`);
            }
            express_router.use(express.static(staticPath, {
                fallthrough: true,
                lastModified: true,
                etag: true,
                cacheControl: false,
                maxAge: 0,
                setHeaders: (res, path, stat) => {
                    // Disable caching for all static files
                    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
                    res.set('Pragma', 'no-cache');
                    res.set('Expires', '0');
                }
            }));
            // Configure static route
            logger.log(`✓ Added static urlPath: ${urlPath} -> ${staticPath}`);

        } catch (error) {
            logger.error(`Error configuring static route ${urlPath} -> ${staticPath}:`, error);
        }
        return express_router;
    }

    applyStaticRoutes(urlPath,express_router){
        app.use(urlPath, express_router);
    }

    async start(config,) {
        const STATIC_PATHS = mergeConfigs(config.STATIC_PATHS, defaultStaticConfig)
        if (STATIC_PATHS) {
            this.configureStaticRoutes(STATIC_PATHS);
        } else {
            logger.warn('No STATIC_PATHS found in configuration');
        }
        expressProvider.setExpressApp(app)
        return app;
    }
}

module.exports = new StaticServer();