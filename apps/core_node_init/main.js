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

// Import puppeteer_spider_v2 framework
const { 
    createSpiderEngine, 
    createSession, 
    shutdown,
    SpiderEngine,
    SessionManager,
    PluginManager
} = require('#@puppeteer-v2');

// Import application components
const CommandLineParser = require('./controller/CommandLineParser');
const CoreNodeInitPlugin = require('./controller/CoreNodeInitPlugin');
const config = require('./config');

// Declare variables
let spiderEngine = null;
let session = null;
let downloadPlugin = null;

// Initialize application using puppeteer_spider_v2
async function initialize() {
    logger.info('Initializing Core Node Init application (v2)...');
    
    // Ensure required directories exist using ncore foundation
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
    
    // Create spider engine
    spiderEngine = createSpiderEngine();
    await spiderEngine.initialize();
    
    // Create session with configuration
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
    
    // Register and initialize download plugin
    downloadPlugin = new CoreNodeInitPlugin();
    await downloadPlugin.initialize(session);
    
    logger.info('Core Node Init application initialized successfully');
}

// List available download targets
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

// Show download status
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

// Execute download command using download plugin
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

// Execute image download command using download plugin
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

// Execute audio download command using download plugin
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

// Execute URL download command using download plugin
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

// Main application entry point
async function start() {
    try {
        logger.info('Starting Core Node Init application (v2)...');

        // Parse command line arguments first to check if it's help command
        const parser = new CommandLineParser();
        const args = parser.parseArguments();

        // Skip initialization for help and list commands
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

        // Initialize application for other commands
        await initialize();

        logger.info(`Command: ${args.command}, Target: ${args.target || 'none'}`);

        // Execute command
        let success = true;

        switch (args.command) {
            case 'download':
                if (!args.target) {
                    // Download both VSCode and Cursor when no target specified
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
        
        // Cleanup
        if (downloadPlugin) {
            await downloadPlugin.cleanup();
        }
        
        if (session) {
            await spiderEngine.closeSession(session.id);
        }
        
        if (spiderEngine) {
            await spiderEngine.shutdown();
        }
        
        if (success) {
            logger.info('Core Node Init application completed successfully');
            process.exit(0);
        } else {
            logger.error('Core Node Init application completed with errors');
            process.exit(1);
        }
        
    } catch (error) {
        logger.error('Fatal error in Core Node Init application:', error.message);
        
        // Cleanup on error
        if (downloadPlugin) {
            try {
                await downloadPlugin.cleanup();
            } catch (cleanupError) {
                logger.error('Download plugin cleanup error:', cleanupError.message);
            }
        }
        
        if (session) {
            try {
                await spiderEngine.closeSession(session.id);
            } catch (cleanupError) {
                logger.error('Session cleanup error:', cleanupError.message);
            }
        }
        
        if (spiderEngine) {
            try {
                await spiderEngine.shutdown();
            } catch (cleanupError) {
                logger.error('Spider engine cleanup error:', cleanupError.message);
            }
        }
        
        process.exit(1);
    }
}

// Export the start function for the main application launcher
module.exports = {
    start
};
