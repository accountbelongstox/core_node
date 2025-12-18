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
const readline = require('readline');

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

const { getAppName, getCurrentApps } = require('./ncore/global_vars/libs/app_parameter.js');

class Main {
    constructor() {
        this.app = null;
        this.contextLoaded = false;
        this.context = null;
        this.logger = null;
        this.installService = null;
        this.explorer = null;
        this.exitOn = null;
        this.shutdownHandlerRegistered = false;
    }

    async promptForAppSelection() {
        const apps = getCurrentApps();
        if (!apps || apps.length === 0) {
            logger.error('No applications found in the apps directory.');
            process.exit(1);
        }

        console.log('Available applications:');
        apps.forEach((name, index) => {
            console.log(`  [${index + 1}] ${name}`);
        });

        return new Promise((resolve) => {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

            const closeInterface = (value) => {
                rl.close();
                resolve(value);
            };

            rl.on('SIGINT', () => {
                console.log('\nSelection cancelled.');
                closeInterface(null);
            });

            const ask = () => {
                rl.question('Select an application by number or name: ', (answer) => {
                    const input = answer.trim();
                    if (!input) {
                        console.log('Input cannot be empty.');
                        ask();
                        return;
                    }

                    const numericIndex = Number(input);
                    let selection = null;

                    if (Number.isInteger(numericIndex) && numericIndex >= 1 && numericIndex <= apps.length) {
                        selection = apps[numericIndex - 1];
                    } else {
                        const exactMatch = apps.find((name) => name.toLowerCase() === input.toLowerCase());
                        if (exactMatch) {
                            selection = exactMatch;
                        } else {
                            const partialMatches = apps.filter((name) => name.toLowerCase().startsWith(input.toLowerCase()));
                            if (partialMatches.length === 1) {
                                selection = partialMatches[0];
                            }
                        }
                    }

                    if (!selection) {
                        console.log('Invalid selection. Please try again.');
                        ask();
                        return;
                    }

                    closeInterface(selection);
                });
            };

            ask();
        });
    }

    injectSelectedApp(appName) {
        const appArgExists = process.argv.some((arg) => /^(--app(=|$)|-app(=|$)|app=)/i.test(arg));
        if (!appArgExists) {
            process.argv.push(`--app=${appName}`);
        }
        process.env.APP = appName;
        process.env.APPNAME = appName;
        process.env.APP_NAME = appName;
    }

    async ensureContext() {
        if (this.contextLoaded) {
            return;
        }

        let selectedApp = getAppName();
        if (!selectedApp) {
            selectedApp = await this.promptForAppSelection();
            if (!selectedApp) {
                console.error('No application selected. Exiting.');
                process.exit(1);
            }
            this.injectSelectedApp(selectedApp);
        }

        delete require.cache[require.resolve('#@global_vars')];
        this.context = require('#@global_vars');
        this.appname = this.context.appname;
        this.appdir = this.context.appdir;
        this.appentry = this.context.appentry;
        this.isServer = this.context.isServer;
        this.isService = this.context.isService;
        this.contextLoaded = true;

        if (!this.logger) {
            this.logger = require('#@logger');
        }
        if (!this.installService) {
            ({ installService: this.installService } = require('#@ncore/utils/linux/libs/service.js'));
        }
        if (!this.explorer) {
            ({ explorer: this.explorer } = require('#@ncore/utils/systool/index.js'));
        }
        if (!this.shutdownHandlerRegistered) {
            this.exitOn = require('#@/ncore/foundation/utilities/process_on.js');
            this.exitOn.addShutdownHandler(() => this.stop());
            this.shutdownHandlerRegistered = true;
        }
    }

    async start() {
        await this.ensureContext();

        if (this.isService) {
            await this.installService();
            this.logger.success(`the ${this.appname} service installed successfully`);
        } else if (this.appname) {
            if (!fs.existsSync(this.appentry)) {
                this.logger.error(`App ${this.appname} not found in ${this.appdir}`);
                process.exit(1);
            }

            // Search and launch executable files in app directory using launcher
            // This allows parallel startup of other apps/projects without blocking main process
            this.logger.info(`Searching for executable files in app directory: ${this.appdir}`);
            const { getAppExecutableLauncher } = require('#@ncore/launcher');
            const executableLauncher = getAppExecutableLauncher();
            await executableLauncher.searchAndLaunchAppExecutables(this.appdir, this.appname);

            // Continue with normal app/main.js startup logic
            const appentryLoaded = require(this.appentry);
            if (appentryLoaded.default) {
                this.app = appentryLoaded.default;
            } else {
                this.app = appentryLoaded;
            }
            if (typeof this.app.start === 'function') {
                await this.app.start();
                this.logger.success(`App ${this.appname} started successfully`);
            } else {
                this.logger.error(`App ${this.appname} does not have a start method`);
            }
        } else {
            this.logger.error('Please specify app name using --app=<appname>');
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
