import express from 'express';
import { authMiddleware } from './middleware/auth.js';
import * as hostHandler from './handler/hosts.js';
import * as userHandler from './handler/user.js';
import { getSystemInfo } from '../system/info.js';
import logger from '../logger/logger.js';
import config from '../../config/index.js';

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

export default router; 