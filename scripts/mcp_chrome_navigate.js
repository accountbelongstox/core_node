'use strict';

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const MCP_URL = 'http://127.0.0.1:12306/mcp';
const TARGET_URL = 'https://www.google.com';

async function main() {
    const client = new Client(
        { name: 'navigate-script', version: '1.0.0' },
        { capabilities: {} }
    );

    const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {});
    await client.connect(transport);

    const { tools } = await client.listTools();
    if (!tools || tools.length === 0) {
        console.error('No tools available. Ensure Chrome extension is loaded and connected (click Connect in extension popup).');
        await client.close();
        process.exit(1);
    }

    const hasNavigate = tools.some(t => t.name === 'chrome_navigate');
    if (!hasNavigate) {
        console.error('chrome_navigate not found. Available tools:', tools.map(t => t.name).join(', '));
        await client.close();
        process.exit(1);
    }

    const result = await client.callTool(
        { name: 'chrome_navigate', arguments: { url: TARGET_URL } },
        undefined,
        { timeout: 30000 }
    );

    console.log(JSON.stringify(result, null, 2));
    await client.close();
}

main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
});
