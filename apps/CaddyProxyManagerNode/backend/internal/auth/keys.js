const fs = require('fs').promises;
    const config = require('../../config/index.js');
    const logger = require('../logger/logger.js');

    let privateKey = null;
    let publicKey = null;

    const getPrivateKey = async () => {
        if (!privateKey) {
            try {
                privateKey = await fs.readFile(config.privateKey);
            } catch (error) {
                logger.error('PrivateKeyLoad', error);
                throw error;
            }
        }
        return privateKey;
    };

    const getPublicKey = async () => {
        if (!publicKey) {
            try {
                publicKey = await fs.readFile(config.publicKey);
            } catch (error) {
                logger.error('PublicKeyLoad', error);
                throw error;
            }
        }
        return publicKey;
    };

    exports.getPrivateKey = getPrivateKey;
    exports.getPublicKey = getPublicKey;