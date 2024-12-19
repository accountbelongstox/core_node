const defaults = require('./defaults.js');
    const env = require('./environment.js');

    const config = {
        ...defaults,
        dataFolder: env.DATA_FOLDER,
        logFolder: env.LOG_FOLDER,
        caddyFile: env.CADDY_FILE,
        privateKey: env.PRIVATE_KEY,
        publicKey: env.PUBLIC_KEY,

        log: {
            level: env.LOG_LEVEL,
            format: env.LOG_FORMAT
        },

        server: {
            port: env.PORT,
            host: env.HOST
        },

        env: env.NODE_ENV,

        version: null,
        commit: null,

        isProduction: env.NODE_ENV === 'production',
        isDevelopment: env.NODE_ENV === 'development',
        isTest: env.NODE_ENV === 'test',

        jwt: {
            algorithm: 'RS256',
            expiresIn: '24h'
        },

        log: {
            level: {
                DEBUG: 10,
                INFO: 20,
                WARN: 30,
                ERROR: 40
            },
            format: env.LOG_FORMAT
        }
    };

    module.exports = config;

    // For backward compatibility, maintain the same exports as vars.js
    exports.Configuration = {
        dataFolder: config.dataFolder,
        logFolder: config.logFolder,
        caddyFile: config.caddyFile,
        privateKey: config.privateKey,
        publicKey: config.publicKey,
        log: config.log
    };

    let isSetup = false;
    exports.getIsSetup = () => isSetup;
    exports.setIsSetup = (value) => { isSetup = value; };