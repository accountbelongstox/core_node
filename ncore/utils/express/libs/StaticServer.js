
const expressProvider = require('../provider/expressProvider');
const app = expressProvider.getExpressApp()
const express = expressProvider.getExpress()
const path = require('path');
const fs = require('fs');
const { APP_STATIC_DIR,APP_TEMPLATE_DIR } = require('#@/ncore/gvar/gdir.js');
const logger = require('../logger/index.js');

const defaultStaticConfig = {
    "/static": [APP_STATIC_DIR,APP_TEMPLATE_DIR],

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
        this.express = express;
    }

    /**
     * Configure static routes for express app
     * @param {Object} staticPaths - Static paths configuration
     */
    configureStaticRoutes(staticPaths) {
        if (!staticPaths || typeof staticPaths !== 'object') {
            logger.warn('No static paths configuration provided');
            return;
        }

        logger.log('Configuring static routes...');

        // Iterate through all static path entries
        Object.entries(staticPaths).forEach(([route, paths]) => {
            logger.log(`\nConfiguring route: ${route}`);

            if (Array.isArray(paths)) {
                // Handle array of paths
                paths.forEach(staticPath => {
                    this._addStaticRoute(route, staticPath);
                });
            } else if (typeof paths === 'string') {
                // Handle single path
                this._addStaticRoute(route, paths);
            } else {
                logger.warn(`Invalid path configuration for route ${route}`);
            }
        });

        logger.log('\nStatic routes configuration completed');
    }

    /**
     * Add a single static route
     * @param {string} route - Route path
     * @param {string} staticPath - Static files path
     */
    _addStaticRoute(route, staticPath) {
        try {
            // Check if path exists
            if (!fs.existsSync(staticPath)) {
                logger.warn(`Warning: Static path does not exist: ${staticPath}`);
                fs.mkdirSync(staticPath, { recursive: true });
                logger.log(`Created directory: ${staticPath}`);
            }

            // Configure static route
            app.use(route, this.express.static(staticPath));
            logger.log(`✓ Added static route: ${route} -> ${staticPath}`);

        } catch (error) {
            logger.error(`Error configuring static route ${route} -> ${staticPath}:`, error);
        }
    }

    async start(config) {
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