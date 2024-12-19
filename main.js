const { sysarg } = require('#@utils_native');
const logger = require('#@utils_logger');
const path = require('path');
const fs = require('fs');

// Constants
const APP_DIR = path.join(__dirname, 'apps');
const APP_NAME = sysarg.getArg('app');

class Main {
    constructor() {
        this.app = null;
    }

    async start() {
        try {
            if (!APP_NAME) {
                logger.error('Please specify app name using --app=<appname>');
                process.exit(1);
            }

            const appPath = path.join(APP_DIR, APP_NAME);
            if (!fs.existsSync(appPath)) {
                logger.error(`App ${APP_NAME} not found in ${APP_DIR}`);
                process.exit(1);
            }

            // Dynamically load app's main.js
            const appMain = require(path.join(appPath, 'main.js'));
            if (appMain.default) {
                // Handle ES6 module conversion case
                this.app = appMain.default;
            } else {
                this.app = appMain;
            }

            // Start the application
            if (typeof this.app.start === 'function') {
                await this.app.start();
                logger.success(`App ${APP_NAME} started successfully`);
            } else {
                logger.error(`App ${APP_NAME} does not have a start method`);
            }
        } catch (error) {
            logger.error('Failed to start app:', error);
            process.exit(1);
        }
    }

    async stop() {
        if (this.app && typeof this.app.stop === 'function') {
            await this.app.stop();
            logger.info(`App ${APP_NAME} stopped`);
        }
    }
}

// Create instance
const main = new Main();

// Handle process signals
process.on('SIGINT', async () => {
    logger.info('Received SIGINT. Graceful shutdown...');
    await main.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM. Graceful shutdown...');
    await main.stop();
    process.exit(0);
});

// Export class and instance
module.exports = main;
module.exports.Main = Main;

// Execute if run directly
if (require.main === module) {
    main.start().catch(error => {
        logger.error('Failed to start:', error);
        process.exit(1);
    });
}
