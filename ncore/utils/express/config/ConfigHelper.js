const crypto = require('crypto');
    const logger = require('../logger/index.js');

    class ConfigHelper {
        // Required fields and their generators
        static requiredFields = {
            SESSION_SECRET: {
                generator: () => crypto.randomBytes(32).toString('hex'),
                description: 'Session secret key'
            },
            JWT_SECRET: {
                generator: () => crypto.randomBytes(32).toString('hex'),
                description: 'JWT secret key'
            },
            API_KEY: {
                generator: () => crypto.randomBytes(24).toString('base64'),
                description: 'API access key'
            }
            // Add more required fields here
        };

        // Generate missing required values
        static async ensureRequiredValues(currentConfig, env) {
            const updates = {};
            const requiredFields = Object.keys(this.requiredFields);

            for (const field of requiredFields) {
                if (!currentConfig[field] || currentConfig[field] === '') {
                    logger.warning(`Missing required configuration: ${field}`);
                    
                    // Generate new value
                    const newValue = this.requiredFields[field].generator();
                    updates[field] = newValue;

                    // Save to environment
                    try {
                        await env.setEnvValue(field, newValue);
                        logger.success(`Generated and saved new ${this.requiredFields[field].description}: ${field}`);
                    } catch (error) {
                        logger.error(`Failed to save ${field} to environment:`, error.message);
                    }
                }
            }

            return updates;
        }

        // Validate configuration values
        static validateConfig(config) {
            const issues = [];

            // Check required fields
            for (const field of Object.keys(this.requiredFields)) {
                if (!config[field]) {
                    issues.push(`Missing required field: ${field}`);
                }
            }

            // Validate specific fields
            if (config.PORT && (isNaN(config.PORT) || config.PORT < 0 || config.PORT > 65535)) {
                issues.push('Invalid PORT number');
            }

            if (config.CORS_ENABLED && typeof config.CORS_ENABLED !== 'boolean') {
                issues.push('CORS_ENABLED must be a boolean');
            }

            // Add more specific validations as needed

            return issues;
        }

        // Helper method to generate secure random values
        static generateSecureValue(length = 32, encoding = 'hex') {
            return crypto.randomBytes(length).toString(encoding);
        }
    }

    module.exports = ConfigHelper;