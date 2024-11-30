import express from 'express';
import logger from './logger.js';

export class ExpressBase {
    static #instance = null;
    static #expressApp = null;

    constructor() {
        if (!ExpressBase.#expressApp) {
            ExpressBase.#expressApp = express();
            logger.debug('Express application initialized');
        }
    }

    /**
     * Get the shared Express application instance
     * @returns {express.Application}
     */
    static getExpressApp() {
        if (!ExpressBase.#expressApp) {
            ExpressBase.#expressApp = express();
            logger.debug('Express application initialized on first access');
        }
        return ExpressBase.#expressApp;
    }

    /**
     * Get Express Router instance
     * @returns {express.Router}
     */
    static createRouter() {
        return express.Router();
    }

    /**
     * Get the express module
     * @returns {Object} Express module
     */
    static getExpress() {
        return express;
    }
} 