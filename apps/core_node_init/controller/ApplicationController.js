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

'use strict';

const logger = require('#@logger');
const gconfig = require('#@gconfig');
const { fdir } = require('#@ftools');
const { createSpiderEngine } = require('#@puppeteer-v2');

const CoreNodeInitPlugin = require('./CoreNodeInitPlugin');
const config = require('../config');

class ApplicationController {
    constructor() {
        this.spiderEngine = null;
        this.session = null;
        this.downloadPlugin = null;
    }

    async initialize() {
        logger.info('Initializing Core Node Init application (v2)...');

        try {
            const downloadDirConfig = gconfig.downloadDirConfig || gconfig.DOWNLOADDIRCONFIG;
            const loggingConfig = gconfig.loggingConfig || gconfig.LOGGINGCONFIG;

            if (downloadDirConfig) {
                fdir.mkdirSync(downloadDirConfig.cacheDir);
                fdir.mkdirSync(downloadDirConfig.tempDir);
            }
            if (loggingConfig) {
                fdir.mkdirSync(loggingConfig.logDir);
            }

            logger.info('Required directories ensured');
        } catch (error) {
            logger.error('Failed to ensure directories:', error.message);
            throw error;
        }

        this.spiderEngine = createSpiderEngine();
        await this.spiderEngine.initialize();

        this.session = await this.spiderEngine.createSession({
            browser: config.puppeteerConfig.browser,
            browserOptions: {
                headless: config.puppeteerConfig.headless,
                args: config.puppeteerConfig.args,
                timeout: config.puppeteerConfig.timeout,
                devtools: config.puppeteerConfig.devtools,
                ignoreDefaultArgs: false,
                ignoreHTTPSErrors: true
            }
        });

        this.downloadPlugin = new CoreNodeInitPlugin();
        await this.downloadPlugin.initialize(this.session);

        logger.info('Core Node Init application initialized successfully');
    }

    listTargets() {
        logger.info('Available download targets:');

        if (!this.downloadPlugin) {
            logger.error('Download plugin not initialized');
            return;
        }

        const targets = this.downloadPlugin.listTargets();
        for (const target of targets) {
            logger.info(`  ${target.key.padEnd(10)} - ${target.name}: ${target.description}`);
        }
    }

    async showStatus() {
        logger.info('Download status check...');

        if (!this.downloadPlugin) {
            logger.error('Download plugin not initialized');
            return;
        }

        try {
            const status = await this.downloadPlugin.getDownloadStatus();

            logger.info('Download Status:');
            for (const [target, info] of Object.entries(status)) {
                const statusText = info.downloaded ? 'Downloaded' : 'Not Downloaded';
                const fileInfo = info.file ? ` (${info.file})` : '';
                logger.info(`  ${target.padEnd(10)} - ${statusText}${fileInfo}`);
            }
        } catch (error) {
            logger.error('Failed to get download status:', error.message);
        }
    }

    async executeDownload(target, options) {
        if (!target) {
            logger.error('Download target is required');
            return false;
        }

        if (!this.downloadPlugin) {
            logger.error('Download plugin not initialized');
            return false;
        }

        try {
            const result = await this.downloadPlugin.downloadApplication(target, options);
            return result.success;
        } catch (error) {
            logger.error('Download error:', error.message);
            return false;
        }
    }

    async executeImageDownload(selector, options) {
        if (!selector) {
            logger.error('Image selector is required');
            return false;
        }

        if (!this.downloadPlugin) {
            logger.error('Download plugin not initialized');
            return false;
        }

        try {
            const result = await this.downloadPlugin.downloadImage(selector, options);
            return result.success;
        } catch (error) {
            logger.error('Image download error:', error.message);
            return false;
        }
    }

    async executeAudioDownload(selector, options) {
        if (!selector) {
            logger.error('Audio selector is required');
            return false;
        }

        if (!this.downloadPlugin) {
            logger.error('Download plugin not initialized');
            return false;
        }

        try {
            const result = await this.downloadPlugin.downloadAudio(selector, options);
            return result.success;
        } catch (error) {
            logger.error('Audio download error:', error.message);
            return false;
        }
    }

    async executeUrlDownload(url, options) {
        if (!url) {
            logger.error('URL is required');
            return false;
        }

        if (!this.downloadPlugin) {
            logger.error('Download plugin not initialized');
            return false;
        }

        try {
            const result = await this.downloadPlugin.downloadFromUrl(url, options);
            return result.success;
        } catch (error) {
            logger.error('URL download error:', error.message);
            return false;
        }
    }

    async cleanup() {
        try {
            if (this.downloadPlugin) {
                await this.downloadPlugin.cleanup();
            }

            if (this.session) {
                await this.spiderEngine.closeSession(this.session.id);
            }

            if (this.spiderEngine) {
                await this.spiderEngine.shutdown();
            }

            logger.info('Cleanup complete');
        } catch (error) {
            logger.error('Cleanup error:', error.message);
        }
    }

    async runCLIMode() {
        try {
            const CommandLineParser = require('./CommandLineParser');
            const parser = new CommandLineParser();
            const args = parser.parseArguments();

            if (args.command === 'help') {
                parser.displayHelp();
                logger.info('Core Node Init application completed successfully');
                process.exit(0);
            }

            if (args.command === 'list') {
                await this.initialize();
                this.listTargets();
                logger.info('Core Node Init application completed successfully');
                process.exit(0);
            }

            await this.initialize();

            logger.info(`Command: ${args.command}, Target: ${args.target || 'none'}`);

            let success = true;

            switch (args.command) {
                case 'download':
                    if (!args.target) {
                        logger.info('No target specified, downloading both VSCode and Cursor...');

                        const vscodeSuccess = await this.executeDownload('vscode', args.options);
                        const cursorSuccess = await this.executeDownload('cursor', args.options);

                        success = vscodeSuccess && cursorSuccess;

                        if (success) {
                            logger.info('Both VSCode and Cursor downloads completed successfully');
                        } else {
                            logger.error('One or more downloads failed');
                        }
                    } else {
                        success = await this.executeDownload(args.target, args.options);
                    }
                    break;

                case 'image':
                    success = await this.executeImageDownload(args.target, args.options);
                    break;

                case 'audio':
                    success = await this.executeAudioDownload(args.target, args.options);
                    break;

                case 'url':
                    success = await this.executeUrlDownload(args.target, args.options);
                    break;

                case 'status':
                    await this.showStatus();
                    break;

                case 'help':
                default:
                    parser.displayHelp();
                    break;
            }

            await this.cleanup();

            if (success) {
                logger.info('Core Node Init application completed successfully');
                process.exit(0);
            } else {
                logger.error('Core Node Init application completed with errors');
                process.exit(1);
            }

        } catch (error) {
            logger.error('Fatal error in CLI mode:', error.message);
            await this.cleanup();
            process.exit(1);
        }
    }
}

module.exports = ApplicationController;