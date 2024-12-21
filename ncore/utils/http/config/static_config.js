const path = require('path');

/**
 * Default configuration for static server
 */
module.exports = {
    // Static path mappings
    staticPaths: {
        '/public': path.resolve(__dirname, '../public'),
        '/assets': [
            path.resolve(__dirname, '../assets'),
            path.resolve(__dirname, '../uploads')
        ]
    },

    // CORS configuration
    cors: {
        enabled: true,
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        headers: 'Content-Type, Authorization'
    },

    // Cache configuration
    cache: {
        enabled: true,
        maxAge: 86400 // 24 hours in seconds
    },

    // Server configuration
    server: {
        port: 3000,
        host: 'localhost'
    }
}; 