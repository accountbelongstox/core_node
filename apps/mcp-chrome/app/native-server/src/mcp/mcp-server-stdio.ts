#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  CallToolResult,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createToolErrorResult, setupToolHandlers } from './tool-handlers';
import { NATIVE_SERVER_PORT, SERVER_CONFIG } from '../constant';

let stdioMcpServer: Server | null = null;
let mcpClient: Client | null = null;

const loadConfig = () => {
  return {
    url: `http://${SERVER_CONFIG.HOST}:${NATIVE_SERVER_PORT}/mcp`,
  };
};

export const getStdioMcpServer = () => {
  if (stdioMcpServer) {
    return stdioMcpServer;
  }
  stdioMcpServer = new Server(
    {
      name: 'StdioChromeMcpServer',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  );

  setupToolHandlers(stdioMcpServer, handleToolCall);
  stdioMcpServer.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
  stdioMcpServer.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));
  return stdioMcpServer;
};

export const ensureMcpClient = async () => {
  try {
    if (mcpClient) {
      const pingResult = await mcpClient.ping();
      if (pingResult) {
        return mcpClient;
      }
    }

    const config = loadConfig();
    mcpClient = new Client({ name: 'Mcp Chrome Proxy', version: '1.0.0' }, { capabilities: {} });
    const transport = new StreamableHTTPClientTransport(new URL(config.url), {});
    await mcpClient.connect(transport);
    return mcpClient;
  } catch (error) {
    mcpClient?.close();
    mcpClient = null;
    console.error('Failed to connect to MCP server:', error);
  }
};

const handleToolCall = async (name: string, args: any): Promise<CallToolResult> => {
  try {
    const client = await ensureMcpClient();
    if (!client) {
      throw new Error('Failed to connect to MCP server');
    }
    const result = await client.callTool({ name, arguments: args }, undefined, {
      timeout: 2 * 60 * 1000, // Default timeout of 2 minutes
    });
    return result as CallToolResult;
  } catch (error: any) {
    return createToolErrorResult(error);
  }
};

async function main() {
  const transport = new StdioServerTransport();
  await getStdioMcpServer().connect(transport);
}

main().catch((error) => {
  console.error('Fatal error Chrome MCP Server main():', error);
  process.exit(1);
});
