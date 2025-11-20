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
const CoreNodeInitMCPServer = require('./CoreNodeInitMCPServer');
const CoreNodeSingletonLauncher = require('./CoreNodeSingletonLauncher');

let launcherInstance = null;

async function start() {
    try {
        logger.info('='.repeat(80));
        logger.info('Core Node Init - Singleton Mode');
        logger.info('='.repeat(80));

        launcherInstance = new CoreNodeSingletonLauncher();

        launcherInstance.on('launched', (info) => {
            logger.info('[CoreNode] System launched successfully:', info);
        });

        launcherInstance.on('backendStarted', (info) => {
            logger.info('[CoreNode] Backend MCP server is running:', info);
        });

        launcherInstance.on('clientConnected', (info) => {
            logger.info('[CoreNode] Client is connected:', info);
        });

        launcherInstance.on('launchError', (error) => {
            logger.error('[CoreNode] Launch error:', error);
        });

        await launcherInstance.launch();

        const status = launcherInstance.getDetailedStatus();
        logger.info('[CoreNode] Launch complete');
        logger.info('[CoreNode] Mode:', status.client.mode);
        logger.info('[CoreNode] Backend running:', status.backendServerRunning);
        logger.info('[CoreNode] Client connected:', status.clientConnected);

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('\n[CoreNode] Received SIGINT, shutting down gracefully...');
            await launcherInstance.shutdown();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('\n[CoreNode] Received SIGTERM, shutting down gracefully...');
            await launcherInstance.shutdown();
            process.exit(0);
        });

        return launcherInstance;
    } catch (error) {
        logger.error(`Failed to start Core Node Init: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    start().catch(error => {
        logger.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    start,
    CoreNodeInitMCPServer,
    CoreNodeSingletonLauncher
};
