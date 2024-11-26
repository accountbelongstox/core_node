import jwt from 'jsonwebtoken';
import { getPublicKey } from '../../auth/keys.js';
import { AppError } from '../../errors/errors.js';
import logger from '../../logger/logger.js';
import config from '../../../config/index.js';

export const authMiddleware = async (req, res, next) => {
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