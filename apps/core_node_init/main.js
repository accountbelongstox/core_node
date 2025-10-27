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
const DownloadController = require('./controller/download_controller.js');

// Declare variables
let downloadController = null;
const supportedCommands = ['download', 'list', 'status', 'help'];

// Parse command line arguments
function parseArguments() {
    const args = process.argv.slice(2);
    const parsedArgs = {
        command: 'help',
        target: null,
        options: {}
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        // Skip app= parameter
        if (arg.startsWith('app=')) {
            continue;
        }

        if (arg.startsWith('--')) {
            // Handle options
            const optionName = arg.substring(2);
            const nextArg = args[i + 1];

            if (nextArg && !nextArg.startsWith('--')) {
                parsedArgs.options[optionName] = nextArg;
                i++; // Skip next argument as it's the value
            } else {
                parsedArgs.options[optionName] = true;
            }
        } else if (!parsedArgs.command || parsedArgs.command === 'help') {
            // First non-option argument is the command
            if (supportedCommands.includes(arg)) {
                parsedArgs.command = arg;
            } else {
                parsedArgs.target = arg;
                parsedArgs.command = 'download'; // Default to download if target is specified
            }
        } else if (!parsedArgs.target) {
            // Second non-option argument is the target
            parsedArgs.target = arg;
        }
    }
    
    return parsedArgs;
}

// Display help information
function displayHelp() {
    console.log(`
Core Node Init - Download Manager

Usage:
  node main.js app=core_node_init [command] [target] [options]

Commands:
  download <target>    Download specified application
  list                 List available download targets
  status              Show download status
  help                Show this help message

Targets:
  cursor              Download Cursor IDE
  vscode              Download Visual Studio Code

Options:
  --force             Force download even if file exists
  --headless          Run browser in headless mode
  --timeout <ms>      Set timeout in milliseconds
  --wait              Wait for manual download completion
  --no-wait           Don't wait for download completion

Examples:
  node main.js app=core_node_init download cursor
  node main.js app=core_node_init download vscode --force
  node main.js app=core_node_init list
  node main.js app=core_node_init status
`);
}

// List available download targets
function listTargets() {
    logger.info('Available download targets:');

    const config = require('./config/index.js');
    const configs = config.downloadConfigs;
    for (const [key, downloadConfig] of Object.entries(configs)) {
        logger.info(`  ${key.padEnd(10)} - ${downloadConfig.name}: ${downloadConfig.description}`);
    }
}

// Show download status
async function showStatus() {
    logger.info('Download status check...');
    
    if (!downloadController) {
        downloadController = new DownloadController();
    }
    
    try {
        const status = await downloadController.getDownloadStatus();
        
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

// Execute download command
async function executeDownload(target, options) {
    if (!target) {
        logger.error('Download target is required');
        displayHelp();
        return false;
    }
    
    const configs = gconfig.downloadConfigs;
    if (!configs[target]) {
        logger.error(`Unknown download target: ${target}`);
        logger.info('Available targets:');
        listTargets();
        return false;
    }
    
    if (!downloadController) {
        downloadController = new DownloadController();
    }
    
    try {
        logger.info(`Starting download for: ${target}`);
        const result = await downloadController.downloadTarget(target, options);
        
        if (result.success) {
            logger.info(`Download completed successfully: ${result.filePath}`);
            return true;
        } else {
            logger.error(`Download failed: ${result.error}`);
            return false;
        }
    } catch (error) {
        logger.error('Download error:', error.message);
        return false;
    }
}

// Initialize application
async function initialize() {
    logger.info('Initializing Core Node Init application...');
    
    // Ensure required directories exist
    try {
        fdir.mkdirSync(gconfig.DOWNLOADDIRCONFIG.cacheDir);
        fdir.mkdirSync(gconfig.DOWNLOADDIRCONFIG.tempDir);
        fdir.mkdirSync(gconfig.LOGGINGCONFIG.logDir);

        logger.info('Required directories ensured');
    } catch (error) {
        logger.error('Failed to ensure directories:', error.message);
        throw error;
    }
    
    // Initialize download controller
    downloadController = new DownloadController();
    await downloadController.initialize();
    
    logger.info('Core Node Init application initialized successfully');
}

// Main application entry point
async function start() {
    try {
        logger.info('Starting Core Node Init application...');

        // Parse command line arguments first to check if it's help command
        const args = parseArguments();



        // Skip initialization for help and list commands
        if (args.command === 'help') {
            displayHelp();
            logger.info('Core Node Init application completed successfully');
            process.exit(0);
        }

        if (args.command === 'list') {
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
                success = await executeDownload(args.target, args.options);
                break;

            case 'list':
                listTargets();
                break;

            case 'status':
                await showStatus();
                break;

            case 'help':
            default:
                displayHelp();
                break;
        }
        
        // Cleanup
        if (downloadController) {
            await downloadController.cleanup();
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
        if (downloadController) {
            try {
                await downloadController.cleanup();
            } catch (cleanupError) {
                logger.error('Cleanup error:', cleanupError.message);
            }
        }
        
        process.exit(1);
    }
}

// Export the start function for the main application launcher
module.exports = {
    start
};
