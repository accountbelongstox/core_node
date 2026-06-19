import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import nativeMessagingHostInstance from '../native-messaging-host';
import { NativeMessageType, TOOL_SCHEMAS } from 'chrome-mcp-shared';

export const setupTools = (server: Server) => {
  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_SCHEMAS }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    handleToolCall(request.params.name, request.params.arguments || {}),
  );
};

// Default bridge timeout for a tool call. Long-running browser automations
// (image generation, NotebookLM Q&A, network capture) take longer than this and
// declare their own `timeoutMs` in args — we honor that (plus a buffer) so the
// bridge no longer cuts them off at a blanket 30s. Hard-capped so a genuinely
// hung call can never wedge the bridge forever.
const DEFAULT_CALL_TIMEOUT_MS = 30000;
const MAX_CALL_TIMEOUT_MS = 600000;

const handleToolCall = async (name: string, args: any): Promise<CallToolResult> => {
  try {
    // Fast-fail if the extension stdio link is dead. This process is an orphan
    // (its Chrome Service Worker disconnected); writing the call to the broken
    // stdout would silently go nowhere and hang for the full timeout. Surface an
    // actionable error immediately so the MCP client retries — by then the
    // singleton handover has moved the port to a process WITH a live link.
    if (!nativeMessagingHostInstance.isExtensionConnected()) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error calling tool: browser extension link is not connected (Service Worker disconnected). Please retry.',
          },
        ],
        isError: true,
      };
    }
    // Honor a tool's self-declared timeout (e.g. chrome_gemini_image: 120000,
    // chrome_notebooklm: 60000) so the bridge waits at least as long as the tool
    // itself will run, plus a 15s buffer for navigation/injection overhead.
    const declared = typeof args?.timeoutMs === 'number' && args.timeoutMs > 0 ? args.timeoutMs : 0;
    const callTimeout = Math.min(
      MAX_CALL_TIMEOUT_MS,
      Math.max(DEFAULT_CALL_TIMEOUT_MS, declared + 15000),
    );
    // Send request to Chrome extension and wait for response
    const response = await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
      {
        name,
        args,
      },
      NativeMessageType.CALL_TOOL,
      callTimeout,
    );
    if (response.status === 'success') {
      return response.data;
    } else {
      return {
        content: [
          {
            type: 'text',
            text: `Error calling tool: ${response.error}`,
          },
        ],
        isError: true,
      };
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error calling tool: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
};
