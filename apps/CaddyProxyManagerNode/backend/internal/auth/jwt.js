import jwt from 'jsonwebtoken';
import { getPrivateKey } from './keys.js';
import config from '../../config/index.js';
import logger from '../logger/logger.js';

class UserJWTClaims {
    constructor(userId) {
        this.uid = userId;
        this.iat = Math.floor(Date.now() / 1000);
        const expiresInSeconds = parseInt(config.jwt.expiresIn) * 60 * 60;
        this.exp = this.iat + expiresInSeconds;
        this.iss = 'api';
    }
}

class GeneratedResponse {
    constructor(expires, token) {
        this.expires = expires;
        this.token = token;
    }
}

export const generate = async (userObj) => {
    try {
        const privateKey = await getPrivateKey();
        const expiresInSeconds = parseInt(config.jwt.expiresIn) * 60 * 60;
        const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;

        const claims = new UserJWTClaims(userObj.id);
        const token = jwt.sign(claims, privateKey, { 
            algorithm: config.jwt.algorithm 
        });

        return new GeneratedResponse(expires, token);
    } catch (error) {
        logger.error('JWTError', error);
        throw error;
    }
};

export { UserJWTClaims, GeneratedResponse }; 