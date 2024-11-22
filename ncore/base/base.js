import printer from './printer.js';
import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Base class for inheritance
 * Provides basic functionality like printing and error handling
 */
class Base {
    constructor() {
        this.printer = printer;
    }

    getCwd() {
        return path.join(__dirname, '..', '..',);
    }

    print(content, type = 'log') {
        this.printer[type](content);
        return this;
    }

    /**
     * Handle errors in a consistent way
     * @param {Error} error - Error to handle
     * @param {string} [context=''] - Context where error occurred
     */
    handleError(error, context = '') {
        const message = context ? `Error in ${context}: ${error.message}` : error.message;
        this.printer.error(message);

        if (error.stack) {
            this.printer.debug(error.stack);
        }
    }
}

export default Base;
