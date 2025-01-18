const sysarg = require('#@ncore/utils/systool/libs/sysarg.js');
const logger = require('#@utils_logger');
const path = require('path');
const fs = require('fs');
const { installService, removeService, getServiceStatus } = require('#@ncore/utils/linux/libs/service.js');

const APP_DIR = path.join(__dirname, 'apps');
const APP_NAME = sysarg.getArg('app');
const service_run = sysarg.getArg('service');


class Main {
    constructor() {
        this.app = null;
    }

    async start() {
        if (service_run) {
            try {
                const args = require('minimist')(process.argv.slice(2));
                console.log(`args`, args)
                await handleService(args);
                return;
            } catch (error) {
                console.error('Error:', error);
                process.exit(1);
            }
        } else {
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
                const appMain = require(path.join(appPath, 'main.js'));
                if (appMain.default) {
                    this.app = appMain.default;
                } else {
                    this.app = appMain;
                }
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
    }

    async stop() {
        if (this.app && typeof this.app.stop === 'function') {
            await this.app.stop();
            logger.info(`App ${APP_NAME} stopped`);
        }
    }
}

async function handleService(args) {
    const execPath = sysarg.getArg('exec');
    const entry = sysarg.getArg('entry');
    const serviceArgs = sysarg.getArgsNotAlias()
    await installService({
        execPath: execPath, 
        entry: entry,
        args: serviceArgs,
        resources: {
            cpuShares: 1024, 
            memoryLimit: 1024 * 1024 * 1024
        }
    });
    console.log('Service installed successfully');
}

const main = new Main();

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

if (require.main === module) {
    main.start().catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
}
