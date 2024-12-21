const path = require('path');
const Base = require('#@/ncore/base/base.js');
const defaultConfig = require('../config/static_config.js');
const expressProvider = require('../common/express_provider');

class StaticServer extends Base {
    constructor() {
        super();
        this.app = expressProvider.getApp();
        this.server = expressProvider.getServer();
        this.config = { ...defaultConfig };
    }

    /**
     * Merge custom config with default config
     */
    mergeConfig(customConfig) {
        if (!customConfig) return;

        Object.keys(customConfig).forEach(key => {
            if (typeof customConfig[key] === 'object' && !Array.isArray(customConfig[key])) {
                this.config[key] = {
                    ...(this.config[key] || {}),
                    ...customConfig[key]
                };
            } else {
                this.config[key] = customConfig[key];
            }
        });
    }

    /**
     * Configure static paths for Express
     */
    setupStaticPaths() {
        const { staticPaths } = this.config;

        if (!staticPaths) {
            console.warn('No static paths configured');
            return;
        }

        Object.entries(staticPaths).forEach(([prefix, paths]) => {
            if (Array.isArray(paths)) {
                paths.forEach(staticPath => {
                    if (typeof staticPath === 'string') {
                        this.app.use(prefix, express.static(staticPath));
                        console.log(`Static path configured: ${prefix} -> ${staticPath}`);
                    }
                });
            } else if (typeof paths === 'string') {
                this.app.use(prefix, express.static(paths));
                console.log(`Static path configured: ${prefix} -> ${paths}`);
            }
        });
    }

    /**
     * Configure CORS if enabled
     */
    setupCORS() {
        const { cors } = this.config;
        if (cors && cors.enabled && cors.customConfig) {
            this.app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', cors.origin || '*');
                res.header('Access-Control-Allow-Methods', cors.methods || 'GET,HEAD,PUT,PATCH,POST,DELETE');
                res.header('Access-Control-Allow-Headers', cors.headers || 'Content-Type, Authorization');
                next();
            });
        }
    }

    /**
     * Configure caching if enabled
     */
    setupCaching() {
        const { cache } = this.config;
        if (cache && cache.enabled) {
            this.app.use((req, res, next) => {
                if (cache.maxAge) {
                    res.setHeader('Cache-Control', `public, max-age=${cache.maxAge}`);
                }
                next();
            });
        }
    }

    async start(customConfig = null, port = 3000) {
        try {
            this.mergeConfig(customConfig);
            this.setupCORS();
            this.setupCaching();
            this.setupStaticPaths();

            this.server = expressProvider.getServer();
            
            return new Promise((resolve, reject) => {
                this.server.listen(port, () => {
                    console.log(`Static server running on port ${port}`);
                    resolve(this.server);
                });

                this.server.on('error', (error) => {
                    console.error('Failed to start static server:', error);
                    reject(error);
                });
            });
        } catch (error) {
            console.error('Error starting static server:', error);
            throw error;
        }
    }
}

module.exports = new StaticServer();