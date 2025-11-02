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
const { DualModeRunner } = require('#@ncore/utils/mcp_server');
const { createSpiderEngine } = require('#@puppeteer-v2');

const CommandLineParser = require('./controller/CommandLineParser');
const CoreNodeInitPlugin = require('./controller/CoreNodeInitPlugin');
const WebAutomationTools = require('./mcp/tools/web_automation');
const config = require('./config');

let spiderEngine = null;
let session = null;
let downloadPlugin = null;

async function initialize() {
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

    spiderEngine = createSpiderEngine();
    await spiderEngine.initialize();

    session = await spiderEngine.createSession({
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

    downloadPlugin = new CoreNodeInitPlugin();
    await downloadPlugin.initialize(session);

    logger.info('Core Node Init application initialized successfully');
}

function listTargets() {
    logger.info('Available download targets:');

    if (!downloadPlugin) {
        logger.error('Download plugin not initialized');
        return;
    }

    const targets = downloadPlugin.listTargets();
    for (const target of targets) {
        logger.info(`  ${target.key.padEnd(10)} - ${target.name}: ${target.description}`);
    }
}

async function showStatus() {
    logger.info('Download status check...');

    if (!downloadPlugin) {
        logger.error('Download plugin not initialized');
        return;
    }

    try {
        const status = await downloadPlugin.getDownloadStatus();

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

async function executeDownload(target, options) {
    if (!target) {
        logger.error('Download target is required');
        return false;
    }

    if (!downloadPlugin) {
        logger.error('Download plugin not initialized');
        return false;
    }

    try {
        const result = await downloadPlugin.downloadApplication(target, options);
        return result.success;
    } catch (error) {
        logger.error('Download error:', error.message);
        return false;
    }
}

async function executeImageDownload(selector, options) {
    if (!selector) {
        logger.error('Image selector is required');
        return false;
    }

    if (!downloadPlugin) {
        logger.error('Download plugin not initialized');
        return false;
    }

    try {
        const result = await downloadPlugin.downloadImage(selector, options);
        return result.success;
    } catch (error) {
        logger.error('Image download error:', error.message);
        return false;
    }
}

async function executeAudioDownload(selector, options) {
    if (!selector) {
        logger.error('Audio selector is required');
        return false;
    }

    if (!downloadPlugin) {
        logger.error('Download plugin not initialized');
        return false;
    }

    try {
        const result = await downloadPlugin.downloadAudio(selector, options);
        return result.success;
    } catch (error) {
        logger.error('Audio download error:', error.message);
        return false;
    }
}

async function executeUrlDownload(url, options) {
    if (!url) {
        logger.error('URL is required');
        return false;
    }

    if (!downloadPlugin) {
        logger.error('Download plugin not initialized');
        return false;
    }

    try {
        const result = await downloadPlugin.downloadFromUrl(url, options);
        return result.success;
    } catch (error) {
        logger.error('URL download error:', error.message);
        return false;
    }
}

async function cleanup() {
    try {
        if (downloadPlugin) {
            await downloadPlugin.cleanup();
        }

        if (session) {
            await spiderEngine.closeSession(session.id);
        }

        if (spiderEngine) {
            await spiderEngine.shutdown();
        }

        logger.info('Cleanup complete');
    } catch (error) {
        logger.error('Cleanup error:', error.message);
    }
}

async function runCLIMode() {
    try {
        const parser = new CommandLineParser();
        const args = parser.parseArguments();

        if (args.command === 'help') {
            parser.displayHelp();
            logger.info('Core Node Init application completed successfully');
            process.exit(0);
        }

        if (args.command === 'list') {
            await initialize();
            listTargets();
            logger.info('Core Node Init application completed successfully');
            process.exit(0);
        }

        await initialize();

        logger.info(`Command: ${args.command}, Target: ${args.target || 'none'}`);

        let success = true;

        switch (args.command) {
            case 'download':
                if (!args.target) {
                    logger.info('No target specified, downloading both VSCode and Cursor...');

                    const vscodeSuccess = await executeDownload('vscode', args.options);
                    const cursorSuccess = await executeDownload('cursor', args.options);

                    success = vscodeSuccess && cursorSuccess;

                    if (success) {
                        logger.info('Both VSCode and Cursor downloads completed successfully');
                    } else {
                        logger.error('One or more downloads failed');
                    }
                } else {
                    success = await executeDownload(args.target, args.options);
                }
                break;

            case 'image':
                success = await executeImageDownload(args.target, args.options);
                break;

            case 'audio':
                success = await executeAudioDownload(args.target, args.options);
                break;

            case 'url':
                success = await executeUrlDownload(args.target, args.options);
                break;

            case 'status':
                await showStatus();
                break;

            case 'help':
            default:
                parser.displayHelp();
                break;
        }

        await cleanup();

        if (success) {
            logger.info('Core Node Init application completed successfully');
            process.exit(0);
        } else {
            logger.error('Core Node Init application completed with errors');
            process.exit(1);
        }

    } catch (error) {
        logger.error('Fatal error in CLI mode:', error.message);
        await cleanup();
        process.exit(1);
    }
}

async function start() {
    try {
        const runner = new DualModeRunner({
            mcpConfig: {
                server: {
                    name: config.mcpConfig?.serverName || 'core_node_init_web_automation',
                    version: config.mcpConfig?.serverVersion || '1.0.0',
                    capabilities: {
                        tools: {}
                    }
                },
                session: {
                    timeout: 3600000,
                    maxSessions: 100,
                    cleanupInterval: 300000
                }
            },
            cliRunner: runCLIMode,
            enableSingleInstance: true
        });

        await runner.start();

        if (runner.getMode() === 'mcp') {
            logger.info('Registering MCP tools...');

            const mcpServer = runner.getMCPServer();

            const webTools = new WebAutomationTools();
            await webTools.initialize();

            mcpServer.registerTool(webTools);

            logger.info('MCP tools registered successfully');
        }

    } catch (error) {
        logger.error('Fatal error in Core Node Init application:', error.message);
        await cleanup();
        process.exit(1);
    }
}

module.exports = { start };
