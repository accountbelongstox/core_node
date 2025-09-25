// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const path = require('path');
const fs = require('fs');

// Check for node_modules directory before anything else
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
    console.error('Error: node_modules directory not found. Please install dependencies before running this script.');
    console.error('You can install dependencies by running: yarn install');
    try {
        const { execSync } = require('child_process');
        console.log('Attempting to run: yarn install');
        execSync('yarn install', { stdio: 'inherit' });
        if (!fs.existsSync(nodeModulesPath)) {
            console.error('node_modules directory still not found after attempting yarn install. Exiting.');
            process.exit(1);
        } else {
            console.log('Dependencies installed successfully. Continuing...');
        }
    } catch (err) {
        console.error('Failed to install dependencies automatically. Please run "yarn install" manually.');
        process.exit(1);
    }
}

const logger = require('#@logger');
const { installService } = require('#@ncore/utils/linux/libs/service.js');
const ExitOn = require('#@/ncore/foundation/utilities/process_on.js');
const { appname, appdir, appentry, isServer, isService } = require('#@global_vars');
const { explorer } = require('#@ncore/utils/systool/index.js');

class Main {
    constructor() {
        this.app = null;
        ExitOn.addShutdownHandler(() => this.stop());
    }

    async start() {
        if (isService) {
            await installService();
            logger.success(`the ${appname} service installed successfully`);
        } else if (appname) {
            if (!fs.existsSync(appentry)) {
                logger.error(`App ${appname} not found in ${appdir}`);
                process.exit(1);
            }

            // Search and launch executable files in app directory using explorer
            // This allows parallel startup of other apps/projects without blocking main process
            logger.info(`Searching for executable files in app directory: ${appdir}`);
            await explorer.searchAndLaunchAppExecutables(appdir, appname);

            // Continue with normal app/main.js startup logic
            const appentryLoaded = require(appentry);
            if (appentryLoaded.default) {
                this.app = appentryLoaded.default;
            } else {
                this.app = appentryLoaded;
            }
            if (typeof this.app.start === 'function') {
                await this.app.start();
                logger.success(`App ${appname} started successfully`);
            } else {
                logger.error(`App ${appname} does not have a start method`);
            }
        } else {
            logger.error('Please specify app name using --app=<appname>');
            process.exit(1);
        }
    }

    async stop() {
        if (this.app && typeof this.app.stop === 'function') {
            await this.app.stop();
        }
    }
}

const main = new Main();

if (require.main === module) {
    main.start().catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
}
