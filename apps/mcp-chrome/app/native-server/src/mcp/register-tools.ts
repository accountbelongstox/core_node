import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import nativeMessagingHostInstance from '../native-messaging-host';
import { NativeMessageType } from 'chrome-mcp-shared';
import { createToolErrorResult, setupToolHandlers } from './tool-handlers';

export const setupTools = (server: Server) => {
  setupToolHandlers(server, handleToolCall);
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
    // A dead extension link is rejected at the shared relay boundary before a
    // request can be written to an unusable native messaging stream.
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
    }

    return createToolErrorResult(response.error);
  } catch (error: any) {
    return createToolErrorResult(error);
  }
};
