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
const { start } = require('./main');

// Demo function to test VSCode and Cursor downloads
async function demoDownloads() {
    logger.info('Starting demo downloads for VSCode and Cursor...');
    
    try {
        // Test VSCode download
        logger.info('Testing VSCode download...');
        const vscodeResult = await executeDownload('vscode', {});
        
        if (vscodeResult) {
            logger.info('VSCode download completed successfully');
        } else {
            logger.error('VSCode download failed');
        }
        
        // Test Cursor download
        logger.info('Testing Cursor download...');
        const cursorResult = await executeDownload('cursor', {});
        
        if (cursorResult) {
            logger.info('Cursor download completed successfully');
        } else {
            logger.error('Cursor download failed');
        }
        
        logger.info('Demo downloads completed');
        
    } catch (error) {
        logger.error('Demo failed:', error.message);
    }
}

// Execute download command using download plugin
async function executeDownload(target, options) {
    try {
        // Import the main application components
        const CoreNodeInitPlugin = require('./controller/CoreNodeInitPlugin');
        const config = require('./config');
        
        // Create spider engine (simplified for demo)
        const spider = {
            getPage: () => null,
            newPage: async () => {
                // Mock page object for demo
                return {
                    goto: async (url, options) => {
                        logger.info(`Mock navigation to: ${url}`);
                        return { ok: () => true };
                    },
                    waitForTimeout: async (ms) => {
                        logger.info(`Mock wait for ${ms}ms`);
                    },
                    click: async (selector) => {
                        logger.info(`Mock click: ${selector}`);
                    },
                    $$eval: async (selector, fn, ...args) => {
                        logger.info(`Mock evaluate: ${selector}`);
                        // Return mock download links
                        if (selector === 'a') {
                            return [
                                {
                                    href: 'https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64',
                                    text: 'Download for Linux DEB x64',
                                    id: 'deb-download',
                                    className: 'download-button'
                                },
                                {
                                    href: 'https://code.visualstudio.com/sha/download?build=stable&os=linux-appimage-x64',
                                    text: 'Download for Linux AppImage x64',
                                    id: 'appimage-download',
                                    className: 'download-button'
                                }
                            ];
                        }
                        return [];
                    }
                };
            },
            browser: {
                pages: async () => [],
                newPage: async () => {
                    return {
                        mainFrame: () => ({ url: () => 'about:blank' }),
                        target: () => ({ createCDPSession: async () => ({ send: async () => {} }) })
                    };
                },
                on: () => {}
            }
        };
        
        // Initialize download plugin
        const downloadPlugin = new CoreNodeInitPlugin();
        await downloadPlugin.initialize(spider);
        
        // Execute download
        const result = await downloadPlugin.downloadApplication(target, options);
        
        // Cleanup
        await downloadPlugin.cleanup();
        
        return result.success;
        
    } catch (error) {
        logger.error('Download error:', error.message);
        return false;
    }
}

// Run demo if this file is executed directly
if (require.main === module) {
    demoDownloads().then(() => {
        logger.info('Demo completed');
        process.exit(0);
    }).catch((error) => {
        logger.error('Demo failed:', error);
        process.exit(1);
    });
}

module.exports = {
    demoDownloads,
    executeDownload
};
