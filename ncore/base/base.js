const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

const fileCodings = require('./types/character_set.js');
const baseconfig = require('./types/baseconfig.js');
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

module.exports = Base;
