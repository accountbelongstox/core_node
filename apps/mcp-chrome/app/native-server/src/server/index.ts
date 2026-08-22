import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import {
  NATIVE_SERVER_PORT,
  TIMEOUTS,
  SERVER_CONFIG,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from '../constant';
import {
  ExtensionConnectionError,
  ExtensionRequestTimeoutError,
  type NativeMessagingHost,
} from '../native-messaging-host';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from '../mcp/mcp-server';
import { SingletonHandler } from './singleton';
import { createLogger } from '../util/logger';

const log = createLogger('Server');

// Define request body type (if data needs to be retrieved from HTTP requests)
interface ExtensionRequestPayload {
  data?: any; // Data you want to pass to the extension
}

export class Server {
  private fastify: FastifyInstance;
  public isRunning = false;
  private nativeHost: NativeMessagingHost | null = null;
  private transportsMap: Map<string, StreamableHTTPServerTransport | SSEServerTransport> =
    new Map();
  private singletonHandler: SingletonHandler;
  private stopPromise: Promise<void> | null = null;

  constructor() {
    this.fastify = Fastify({ logger: SERVER_CONFIG.LOGGER_ENABLED });
    this.singletonHandler = new SingletonHandler('chrome-mcp-native-server');

    // A native host process and its MCP server are one ownership unit. A newer
    // browser connection must be able to replace the old unit even when the old
    // process still has in-memory MCP sessions.
    this.singletonHandler.setCanShutdownCallback(() => {
      const activeSessions = this.transportsMap.size;
      log('INFO', `Shutdown check: replacement accepted with ${activeSessions} active session(s)`);
      return true;
    });

    // When an incoming instance wins the port, release it gracefully: end every
    // open MCP session so its SSE stream closes (an open stream would otherwise
    // keep fastify.close() pending), then stop the HTTP server. The client sees
    // a clean stream end / 404-on-reconnect and re-initializes against the new
    // port owner, instead of the abrupt "transport dropped mid-call" a bare
    // process.exit() produced.
    this.singletonHandler.setShutdownCallback(async () => {
      await this.stop();
    });

    this.setupPlugins();
    this.setupRoutes();
  }
  /**
   * Associate NativeMessagingHost instance
   */
  public setNativeHost(nativeHost: NativeMessagingHost): void {
    this.nativeHost = nativeHost;
  }

  private setupPlugins(): void {
    this.fastify.register(cors, {
      origin: SERVER_CONFIG.CORS_ORIGIN,
    });
  }

  private setupRoutes(): void {
    this.fastify.get('/health', async (_, reply) => {
      return reply.status(HTTP_STATUS.OK).send({
        status: this.isRunning ? 'ok' : 'starting',
        extensionConnected: this.nativeHost?.isExtensionConnected() === true,
      });
    });

    // for ping
    this.fastify.get(
      '/ask-extension',
      async (request: FastifyRequest<{ Body: ExtensionRequestPayload }>, reply: FastifyReply) => {

        if (!this.nativeHost) {
          return reply
            .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .send({ error: ERROR_MESSAGES.NATIVE_HOST_NOT_AVAILABLE });
        }
        if (!this.isRunning) {
          return reply
            .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .send({ error: ERROR_MESSAGES.SERVER_NOT_RUNNING });
        }
        try {
          // wait from extension message
          const extensionResponse = await this.nativeHost.sendRequestToExtensionAndWait(
            request.query,
            'process_data',
            TIMEOUTS.EXTENSION_REQUEST_TIMEOUT,
          );
          return reply.status(HTTP_STATUS.OK).send({ status: 'success', data: extensionResponse });
        } catch (error: unknown) {
          if (error instanceof ExtensionRequestTimeoutError) {
            return reply
              .status(HTTP_STATUS.GATEWAY_TIMEOUT)
              .send({ status: 'error', message: ERROR_MESSAGES.REQUEST_TIMEOUT });
          }
          if (error instanceof ExtensionConnectionError) {
            return reply.status(HTTP_STATUS.SERVICE_UNAVAILABLE).send({
              status: 'error',
              message: ERROR_MESSAGES.EXTENSION_NOT_CONNECTED,
            });
          }
          return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
            status: 'error',
            message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
          });
        }
      },
    );

    // Compatible with SSE
    this.fastify.get('/sse', async (_, reply) => {
      log('INFO', 'GET /sse request received (SSE legacy transport)');
      try {
        // Set SSE headers
        reply.raw.writeHead(HTTP_STATUS.OK, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        // Create SSE transport
        log('INFO', 'Creating SSE transport');
        const transport = new SSEServerTransport('/messages', reply.raw);
        this.transportsMap.set(transport.sessionId, transport);
        log('INFO', `SSE transport created with session ID: ${transport.sessionId}`);

        reply.raw.on('close', () => {
          log('INFO', `SSE connection closed for session: ${transport.sessionId}`);
          this.transportsMap.delete(transport.sessionId);
        });

        log('INFO', 'Connecting a fresh MCP server instance to SSE transport');
        // Fresh Server per SSE session for the same one-transport-per-Server
        // reason as the streamable-HTTP path above.
        const server = createMcpServer();
        await server.connect(transport);
        log('SUCCESS', 'MCP server connected to SSE transport');

        // Keep connection open
        reply.raw.write(':\n\n');
        log('INFO', 'SSE connection established and kept alive');
      } catch (error) {
        log('ERROR', 'Error in SSE endpoint', { error });
        if (!reply.sent) {
          reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
        }
      }
    });

    // Compatible with SSE
    this.fastify.post('/messages', async (req, reply) => {
      try {
        const { sessionId } = req.query as any;
        const transport = this.transportsMap.get(sessionId) as SSEServerTransport;
        if (!sessionId || !transport) {
          reply.code(HTTP_STATUS.BAD_REQUEST).send('No transport found for sessionId');
          return;
        }

        await transport.handlePostMessage(req.raw, reply.raw, req.body);
      } catch (error) {
        if (!reply.sent) {
          reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
        }
      }
    });

    // POST /mcp: Handle client-to-server messages
    this.fastify.post('/mcp', async (request, reply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      log('INFO', `POST /mcp request received`, { sessionId, hasBody: !!request.body });

      let transport: StreamableHTTPServerTransport | undefined = this.transportsMap.get(
        sessionId || '',
      ) as StreamableHTTPServerTransport;
      if (transport) {
        log('INFO', `Found existing transport for session: ${sessionId}`);
        // transport found, do nothing
      } else if (isInitializeRequest(request.body)) {
        // Allow re-initialization: either no sessionId (fresh) or stale sessionId (reconnect)
        if (sessionId) {
          log('INFO', `Re-initialization with stale session: ${sessionId}, creating new session`);
        } else {
          log('INFO', 'Initialize request received, creating new session');
        }
        const newSessionId = randomUUID(); // Generate session ID
        log('INFO', `Generated new session ID: ${newSessionId}`);

        // Set the session ID in the response header immediately
        reply.header('Mcp-Session-Id', newSessionId);
        log('INFO', `Set Mcp-Session-Id response header: ${newSessionId}`);

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId, // Use pre-generated ID
        });

        // Register transport IMMEDIATELY before any async operations
        this.transportsMap.set(newSessionId, transport);
        log('SUCCESS', `Transport pre-registered for session: ${newSessionId}`);

        transport.onclose = () => {
          log('INFO', `Transport closing for session: ${transport?.sessionId}`);
          if (transport?.sessionId && this.transportsMap.get(transport.sessionId)) {
            this.transportsMap.delete(transport.sessionId);
            log('INFO', `Transport deleted for session: ${transport.sessionId}`);
          }
        };

        log('INFO', 'Connecting a fresh MCP server instance to transport');
        // A fresh Server per session — an SDK Server binds to ONE transport for
        // life, so reusing a singleton makes the 2nd client's initialize 500.
        await createMcpServer().connect(transport);
        log('SUCCESS', 'MCP server connected to transport');
      } else if (sessionId) {
        // A request bearing a session id we no longer have — almost always the
        // native server restarted and lost its in-memory transportsMap while the
        // client kept its old session id. Per the MCP Streamable HTTP spec an
        // UNKNOWN/EXPIRED session MUST return 404 (JSON-RPC -32001) so a
        // spec-compliant client transparently re-initializes a fresh session.
        // (The previous code returned 400 here, which clients do NOT treat as
        // recoverable, so the connection stayed dead until the client restarted.)
        log('INFO', `Unknown/expired session, asking client to re-initialize: ${sessionId}`);
        reply.code(HTTP_STATUS.NOT_FOUND).send({
          jsonrpc: '2.0',
          error: { code: -32001, message: ERROR_MESSAGES.SESSION_NOT_FOUND },
          id: null,
        });
        return;
      } else {
        // No session id AND not an initialize request -> genuinely malformed.
        log('ERROR', 'Invalid MCP request (no session id, not an initialize request)');
        reply.code(HTTP_STATUS.BAD_REQUEST).send({
          jsonrpc: '2.0',
          error: { code: -32000, message: ERROR_MESSAGES.INVALID_MCP_REQUEST },
          id: null,
        });
        return;
      }

      try {
        log('INFO', `Handling MCP request for session: ${sessionId || 'new'}`);
        await transport.handleRequest(request.raw, reply.raw, request.body);
        log('INFO', `MCP request handled successfully for session: ${sessionId || 'new'}`);
      } catch (error) {
        log('ERROR', 'Error handling MCP request', { error, sessionId });
        if (!reply.sent) {
          reply
            .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .send({ error: ERROR_MESSAGES.MCP_REQUEST_PROCESSING_ERROR });
        }
      }
    });

    this.fastify.get('/mcp', async (request, reply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      log('INFO', `GET /mcp request received (SSE stream)`, { sessionId });

      const transport = sessionId
        ? (this.transportsMap.get(sessionId) as StreamableHTTPServerTransport)
        : undefined;
      if (!transport) {
        // Unknown/expired session on the SSE stream too -> 404 so the client
        // re-initializes (consistent with the POST handler above).
        log('INFO', `No transport found for SSE session, asking client to re-initialize: ${sessionId}`);
        reply.code(HTTP_STATUS.NOT_FOUND).send({
          jsonrpc: '2.0',
          error: { code: -32001, message: ERROR_MESSAGES.SESSION_NOT_FOUND },
          id: null,
        });
        return;
      }

      log('INFO', `Setting up SSE stream for session: ${sessionId}`);
      // The MCP SDK owns the raw response, including the SSE headers. Fastify
      // must be hijacked before handing it over; otherwise it finalizes the
      // reply after the SDK has already opened the stream and Node throws
      // ERR_HTTP_HEADERS_SENT, disconnecting every MCP client immediately.
      reply.hijack();

      try {
        log('INFO', `Starting SSE stream handling for session: ${sessionId}`);
        // transport.handleRequest takes over the hijacked response stream.
        await transport.handleRequest(request.raw, reply.raw);
        log('INFO', `SSE stream established for session: ${sessionId}`);
      } catch (error) {
        log('ERROR', `Error in SSE stream for session: ${sessionId}`, { error });
        if (!reply.raw.writableEnded) {
          reply.raw.end();
        }
      }

      request.socket.on('close', () => {
        log('INFO', `SSE client disconnected for session: ${sessionId}`);
        request.log.info(`SSE client disconnected for session: ${sessionId}`);
        // transport's onclose should handle its own cleanup
      });
    });

    this.fastify.delete('/mcp', async (request, reply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      const transport = sessionId
        ? (this.transportsMap.get(sessionId) as StreamableHTTPServerTransport)
        : undefined;

      if (!transport) {
        reply.code(HTTP_STATUS.BAD_REQUEST).send({ error: ERROR_MESSAGES.INVALID_SESSION_ID });
        return;
      }

      try {
        await transport.handleRequest(request.raw, reply.raw);
        // Assume transport.handleRequest will send response or transport.onclose will cleanup
        if (!reply.sent) {
          reply.code(HTTP_STATUS.NO_CONTENT).send();
        }
      } catch (error) {
        if (!reply.sent) {
          reply
            .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .send({ error: ERROR_MESSAGES.MCP_SESSION_DELETION_ERROR });
        }
      }
    });

    // Singleton protocol endpoint
    this.fastify.post('/singleton', async (request, reply) => {
      const message = request.body as any;
      log('INFO', `Singleton request received: ${message?.type}`, { pid: message?.pid });

      const response = this.singletonHandler.handleMessage(message);

      if (response) {
        reply.code(HTTP_STATUS.OK).send(response);
      } else {
        reply.code(HTTP_STATUS.BAD_REQUEST).send({ error: 'Invalid singleton protocol message' });
      }
    });
  }

  public async start(port = NATIVE_SERVER_PORT): Promise<void> {
    log('INFO', `Server.start() called with port: ${port}`);

    if (!this.nativeHost) {
      throw new Error(ERROR_MESSAGES.NATIVE_HOST_NOT_AVAILABLE);
    }

    if (this.isRunning) {
      log('WARN', 'Server is already running, skipping start');
      return;
    }

    try {
      log('INFO', `Attempting to start Fastify server on ${SERVER_CONFIG.HOST}:${port}`);
      await this.fastify.listen({ port, host: SERVER_CONFIG.HOST });
      this.isRunning = true; // Update running status
      log('SUCCESS', `Fastify server successfully listening on http://${SERVER_CONFIG.HOST}:${port}`);
      log('INFO', `MCP endpoint available at: http://${SERVER_CONFIG.HOST}:${port}/mcp`);
      log('INFO', `SSE endpoint available at: http://${SERVER_CONFIG.HOST}:${port}/sse`);
    } catch (err) {
      this.isRunning = false;
      log('ERROR', 'Failed to start Fastify server', { error: err });
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    this.stopPromise = this.stopOnce();
    return this.stopPromise;
  }

  private async stopOnce(): Promise<void> {
    log('INFO', 'Server.stop() called');
    if (!this.isRunning) return;

    const transports = [...this.transportsMap.values()];
    this.transportsMap.clear();
    for (const transport of transports) {
      try {
        await transport.close();
      } catch (error) {
        log('WARN', 'Failed to close an MCP transport during server shutdown', { error });
      }
    }

    try {
      await this.fastify.close();
      log('SUCCESS', 'Fastify server closed successfully');
    } catch (error) {
      log('ERROR', 'Failed to close Fastify server', { error });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  public getInstance(): FastifyInstance {
    return this.fastify;
  }
}

const serverInstance = new Server();
export default serverInstance;
