/**
 * Matrix Controllers
 *
 * Business logic controllers for Matrix application.
 * Ported from pyapps/matrix/controller/
 */

const logger = require('#@logger');

class MatrixControllers {
    constructor() {
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) {
            logger.warn('[Matrix Controllers] Already initialized');
            return;
        }

        logger.info('[Matrix Controllers] Initializing controllers...');

        this.initialized = true;
        logger.success('[Matrix Controllers] Controllers initialized');
    }
}

module.exports = new MatrixControllers();
