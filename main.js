const { sysarg } = require('#@utils_native');
const logger = require('#@utils_logger');
const path = require('path');
const fs = require('fs');
const { installService, removeService, getServiceStatus } = require('./ncore/utils/linux/libs/service.js');

const APP_DIR = path.join(__dirname, 'apps');
const APP_NAME = sysarg.getArg('app');
const IS_SERVICE = sysarg.getArg('service');

class Main {
    constructor() {
        this.app = null;
    }

    async start() {
        if (IS_SERVICE) {
            try {
                const args = require('minimist')(process.argv.slice(2));
                if (args.service) {
                    await handleService(args);
                    return;
                }

                //---------------------------------------------------------------------------------
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
            } catch (error) {
                console.error('Error:', error);
                process.exit(1);
            }
        }
    }

    async stop() {
        if (this.app && typeof this.app.stop === 'function') {
            await this.app.stop();
            logger.info(`App ${APP_NAME} stopped`);
        }
    }
}

/**
 * Handle service installation
 * @param {Object} args - Command line arguments
 */
async function handleService(args) {
    const serviceCommand = args['service'];
    const mainJsPath = path.resolve(__dirname, 'main.js');

    // Remove service-related args to pass remaining args to the application
    const appArgs = Object.entries(args)
        .filter(([key]) => !['service', '_'].includes(key))
        .map(([key, value]) => `--${key}=${value}`);

    try {
        switch (serviceCommand) {
            case 'install':
                await installService({
                    execPath: process.execPath,  // Node.js executable
                    args: [mainJsPath, ...appArgs],
                    name: 'core-node-app',
                    description: `Core Node.js Application with args: ${appArgs.join(' ')}`,
                    resources: {
                        // You can customize these values
                        cpuShares: 1024,  // 100% of one CPU core
                        memoryLimit: 1024 * 1024 * 1024  // 1GB
                    }
                });
                console.log('Service installed successfully');
                break;

            case 'remove':
                await removeService('core-node-app');
                console.log('Service removed successfully');
                break;

            case 'status':
                const status = await getServiceStatus('core-node-app');
                console.log('Service Status:', JSON.stringify(status, null, 2));
                break;

            default:
                console.error('Invalid service command. Use: install, remove, or status');
                process.exit(1);
        }
        process.exit(0);
    } catch (error) {
        console.error('Service operation failed:', error.message);
        process.exit(1);
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

// Run the application
if (require.main === module) {
    main().catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
}
