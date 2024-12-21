const path = require('path');

/**
 * Static path configurations for Express
 * Each prefix maps to either a single path or an array of paths
 * All paths will be resolved to absolute paths
 */
const staticPaths = {
    '/public': path.resolve(__dirname, '../../public'),

    // Multiple directories for media files
    '/media': [
        path.resolve(__dirname, '../../uploads/media'),
        path.resolve(__dirname, '../../static/media')
    ],

    '/docs': [
        path.resolve(__dirname, '../../uploads/documents'),
        path.resolve(__dirname, '../../static/documents')
    ],

    '/downloads': path.resolve(__dirname, '../../static/downloads'),

    '/images': [
        path.resolve(__dirname, '../../uploads/images'),
        path.resolve(__dirname, '../../static/images'),
        path.resolve(__dirname, '../../assets/images')
    ],

    '/static': path.resolve(__dirname, '../../static'),

    // Assets directory
    '/assets': path.resolve(__dirname, '../../assets')
};

module.exports = staticPaths; 