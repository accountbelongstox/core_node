const path = require('path');
const printer = require('./printer.js');

/**
 * Base class for inheritance
 * Provides basic functionality like printing and error handling
 */
class Base {
    constructor() {
        this.printer = printer;
    }

    getCwd() {
        return path.join(__dirname, '..', '..');
    }

    handleError(error, context = '') {
        const message = context ? `Error in ${context}: ${error.message}` : error.message;
        this.printer.error(message);

        if (error.stack) {
            this.printer.debug(error.stack);
        }
    }
}

module.exports = Base;
