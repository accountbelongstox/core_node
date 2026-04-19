// Simple script to start MCP Chrome Server
const path = require('path');

// Set up module path resolution
process.chdir(__dirname);

// Use relative path to avoid alias issues
const { startMCPChromeServer } = require('./ncore/utils/mcp_chrome/index.js');

async function main() {
    try {
        console.log('[Start] Starting MCP Chrome Server...');
        await startMCPChromeServer({
            port: 12306,
            host: '127.0.0.1'
        });
        console.log('[Start] MCP Chrome Server started successfully');
    } catch (error) {
        console.error('[Start] Failed to start MCP Chrome Server:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
