const jwt = require('jsonwebtoken');
    const { getPrivateKey } = require('./keys.js');
    const config = require('../../config/index.js');
    const logger = require('../logger/logger.js');

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

    const generate = async (userObj) => {
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

    exports.generate = generate;
    exports.UserJWTClaims = UserJWTClaims;
    exports.GeneratedResponse = GeneratedResponse;