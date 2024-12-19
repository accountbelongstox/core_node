const jwt = require('jsonwebtoken');
    const { getPublicKey } = require('../../auth/keys.js');
    const { AppError } = require('../../errors/errors.js');
    const logger = require('../../logger/logger.js');
    const config = require('../../../config/index.js');

    exports.authMiddleware = async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                throw new AppError('no token provided', 'UNAUTHORIZED');
            }

            const token = authHeader.substring(7);
            const publicKey = await getPublicKey();

            try {
                const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
                req.user = decoded;
                next();
            } catch (error) {
                logger.error('TokenVerificationError', error);
                throw new AppError('invalid token', 'UNAUTHORIZED');
            }
        } catch (error) {
            next(error);
        }
    };