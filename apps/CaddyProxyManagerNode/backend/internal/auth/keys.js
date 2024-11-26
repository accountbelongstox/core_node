import { promises as fs } from 'fs';
import config from '../../config/index.js';
import logger from '../logger/logger.js';

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

export {
    getPrivateKey,
    getPublicKey
}; 