const express = require('express');
    const { authMiddleware } = require('./middleware/auth.js');
    const hostHandler = require('./handler/hosts.js');
    const userHandler = require('./handler/user.js');
    const { getSystemInfo } = require('../system/info.js');
    const logger = require('../logger/logger.js');
    const config = require('../../config/index.js');

    const router = express.Router();

    // Root route - System Information
    router.get('/', async (req, res) => {
        try {
            const systemInfo = await getSystemInfo();
            res.json({
                status: 'success',
                message: 'Caddy Proxy Manager API',
                version: process.env.npm_package_version || '1.0.0',
                systemInfo
            });
        } catch (error) {
            logger.error('SystemInfoError', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to retrieve system information',
                error: error.message
            });
        }
    });

    // Public routes
    router.post('/api/login', userHandler.login);
    router.get('/api/setup', userHandler.getSetup);
    router.post('/api/setup', userHandler.setup);

    // Protected routes
    router.use('/api', authMiddleware);

    // Host routes
    router.get('/api/hosts', hostHandler.list);
    router.post('/api/hosts', hostHandler.create);
    router.get('/api/hosts/:id', hostHandler.get);
    router.put('/api/hosts/:id', hostHandler.update);
    router.delete('/api/hosts/:id', hostHandler.remove);

    // User routes
    router.get('/api/users', userHandler.list);
    router.post('/api/users', userHandler.create);
    router.get('/api/users/:id', userHandler.get);
    router.put('/api/users/:id', userHandler.update);
    router.delete('/api/users/:id', userHandler.remove);

    // Error handling
    router.use((err, req, res, next) => {
        logger.error('RouterError', err);
        res.status(err.status || 500).json({
            error: err.code || 'INTERNAL_ERROR',
            message: err.message
        });
    });

    module.exports = router;