import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOL_SCHEMAS } from 'chrome-mcp-shared';

export type ToolCallHandler = (name: string, args: any) => Promise<CallToolResult>;

export function setupToolHandlers(server: Server, handleToolCall: ToolCallHandler): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_SCHEMAS }));
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    handleToolCall(request.params.name, request.params.arguments || {}),
  );
}

export function createToolErrorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);

  return {
    content: [
      {
        type: 'text',
        text: `Error calling tool: ${message}`,
      },
    ],
    isError: true,
  };
}
