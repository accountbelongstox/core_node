// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const crypto = require('crypto');
const logger = require('#@logger');
const { WS_RPC_CONSTANTS } = require('#@global_vars');

const ERROR_CODES = WS_RPC_CONSTANTS.ERROR_CODES;

class AuthManager {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.secret = options.secret || this._generateSecret();
        this.tokenExpiry = options.tokenExpiry || 3600000;
        this.authHandler = options.authHandler || null;
        this.tokens = new Map();
        this.clientAuth = new Map();
        this.permissions = new Map();
    }

    async authenticate(clientId, credentials) {
        if (!this.enabled) {
            return { success: true, token: null };
        }

        try {
            let isValid = false;
            let userData = null;

            if (this.authHandler) {
                const result = await this.authHandler(credentials);
                isValid = result.success;
                userData = result.user;
            } else {
                isValid = this._defaultAuth(credentials);
                userData = credentials;
            }

            if (!isValid) {
                logger.warn(`Authentication failed for client ${clientId}`);
                return {
                    success: false,
                    error: ERROR_CODES.UNAUTHORIZED,
                    message: 'Invalid credentials'
                };
            }

            const token = this._generateToken(clientId, userData);
            this.clientAuth.set(clientId, {
                token,
                user: userData,
                authenticatedAt: Date.now(),
                expiresAt: Date.now() + this.tokenExpiry
            });

            this.tokens.set(token, clientId);

            logger.info(`Client ${clientId} authenticated successfully`);

            return {
                success: true,
                token,
                expiresIn: this.tokenExpiry
            };

        } catch (error) {
            logger.error(`Authentication error for client ${clientId}:`, error);
            return {
                success: false,
                error: ERROR_CODES.INTERNAL_ERROR,
                message: error.message
            };
        }
    }

    verifyToken(token) {
        const clientId = this.tokens.get(token);
        if (!clientId) {
            return { valid: false, error: ERROR_CODES.UNAUTHORIZED };
        }

        const authData = this.clientAuth.get(clientId);
        if (!authData) {
            this.tokens.delete(token);
            return { valid: false, error: ERROR_CODES.UNAUTHORIZED };
        }

        if (Date.now() > authData.expiresAt) {
            this.revoke(clientId);
            return { valid: false, error: ERROR_CODES.UNAUTHORIZED };
        }

        return {
            valid: true,
            clientId,
            user: authData.user
        };
    }

    isAuthenticated(clientId) {
        if (!this.enabled) {
            return true;
        }

        const authData = this.clientAuth.get(clientId);
        if (!authData) {
            return false;
        }

        if (Date.now() > authData.expiresAt) {
            this.revoke(clientId);
            return false;
        }

        return true;
    }

    hasPermission(clientId, permission) {
        if (!this.enabled) {
            return true;
        }

        const authData = this.clientAuth.get(clientId);
        if (!authData) {
            return false;
        }

        const clientPermissions = this.permissions.get(clientId) || [];
        return clientPermissions.includes(permission) || clientPermissions.includes('*');
    }

    setPermissions(clientId, permissions) {
        this.permissions.set(clientId, permissions);
        logger.debug(`Permissions set for client ${clientId}:`, permissions);
    }

    revoke(clientId) {
        const authData = this.clientAuth.get(clientId);
        if (authData) {
            this.tokens.delete(authData.token);
            this.clientAuth.delete(clientId);
            this.permissions.delete(clientId);
            logger.info(`Authentication revoked for client ${clientId}`);
        }
    }

    refreshToken(clientId) {
        const authData = this.clientAuth.get(clientId);
        if (!authData) {
            return null;
        }

        this.tokens.delete(authData.token);
        const newToken = this._generateToken(clientId, authData.user);

        authData.token = newToken;
        authData.expiresAt = Date.now() + this.tokenExpiry;

        this.clientAuth.set(clientId, authData);
        this.tokens.set(newToken, clientId);

        logger.debug(`Token refreshed for client ${clientId}`);
        return newToken;
    }

    getAuthData(clientId) {
        return this.clientAuth.get(clientId);
    }

    _generateToken(clientId, userData) {
        const payload = {
            clientId,
            user: userData,
            timestamp: Date.now()
        };

        const dataStr = JSON.stringify(payload);
        const hash = crypto
            .createHmac('sha256', this.secret)
            .update(dataStr)
            .digest('hex');

        return `${Buffer.from(dataStr).toString('base64')}.${hash}`;
    }

    _generateSecret() {
        return crypto.randomBytes(32).toString('hex');
    }

    _defaultAuth(credentials) {
        return credentials && credentials.username && credentials.password;
    }
}

module.exports = AuthManager;
