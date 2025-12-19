#!/usr/bin/env node

/**
 * Quick MCP Server Test
 * Tests if the MCP server can list tools via stdio
 */

const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'app/native-server/dist/index.js');

console.log('🧪 Testing MCP Server via stdio...\n');
console.log(`Server path: ${serverPath}\n`);

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Send initialize request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

// Send tools/list request
const listToolsRequest = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/list',
  params: {}
};

let responseBuffer = '';

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();

  // Try to parse complete JSON-RPC messages
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || ''; // Keep incomplete line in buffer

  lines.forEach(line => {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('📨 Received:', JSON.stringify(response, null, 2));

        // If we received init response, send tools/list
        if (response.id === 1) {
          console.log('\n✅ Initialization successful!\n');
          console.log('📋 Requesting tools list...\n');
          server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
        }

        // If we received tools list, show count and exit
        if (response.id === 2 && response.result?.tools) {
          console.log(`\n✅ Found ${response.result.tools.length} MCP tools!\n`);
          console.log('Tool names:');
          response.result.tools.forEach((tool, idx) => {
            console.log(`  ${(idx + 1).toString().padStart(2, ' ')}. ${tool.name}`);
          });
          console.log('\n🎉 MCP Server is working correctly!\n');
          server.kill();
          process.exit(0);
        }
      } catch (e) {
        // Ignore parse errors for incomplete messages
      }
    }
  });
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\n❌ Server exited with code ${code}`);
    process.exit(code);
  }
});

// Send init request after a short delay
setTimeout(() => {
  console.log('📤 Sending initialize request...\n');
  server.stdin.write(JSON.stringify(initRequest) + '\n');
}, 500);

// Timeout after 10 seconds
setTimeout(() => {
  console.error('\n❌ Test timed out after 10 seconds');
  server.kill();
  process.exit(1);
}, 10000);
