import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { setupTools } from './register-tools';

export let mcpServer: Server | null = null;

/**
 * Build a brand-new MCP Server instance with the tool handlers registered.
 *
 * IMPORTANT: an MCP SDK Server can be connected to exactly ONE transport for its
 * lifetime (Server.connect() throws "Already connected to a transport" on a
 * second call). Streamable-HTTP and SSE are multi-session, so EACH session must
 * get its own Server instance — otherwise the second client (e.g. Claude after
 * Cursor already connected) fails its initialize with HTTP 500. Always call this
 * per transport/session; never share one instance across connections.
 */
export const createMcpServer = (): Server => {
  const server = new Server(
    {
      name: 'ChromeMcpServer',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {
          listChanged: true, // Server supports tool list change notifications
        },
      },
    },
  );

  setupTools(server);
  return server;
};

/**
 * Legacy singleton accessor. Kept for any caller that only needs the tool
 * registry; do NOT use this for per-session transport connections — use
 * createMcpServer() so each session owns its own Server.
 */
export const getMcpServer = () => {
  if (mcpServer) {
    return mcpServer;
  }
  mcpServer = createMcpServer();
  return mcpServer;
};
