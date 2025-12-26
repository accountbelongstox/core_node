import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { stderr } from 'process';
import {
  NATIVE_SERVER_PORT,
  TIMEOUTS,
  SERVER_CONFIG,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from '../constant';
import { NativeMessagingHost } from '../native-messaging-host';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { getMcpServer } from '../mcp/mcp-server';
import { SingletonHandler } from './singleton';

// Log function for debugging
function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [Server] [${level}] ${message}`;
  if (data) {
    stderr.write(`${logMessage} ${JSON.stringify(data)}\n`);
  } else {
    stderr.write(`${logMessage}\n`);
  }
}

// Define request body type (if data needs to be retrieved from HTTP requests)
interface ExtensionRequestPayload {
  data?: any; // Data you want to pass to the extension
}

export class Server {
  private fastify: FastifyInstance;
  public isRunning = false; // Changed to public or provide a getter
  private nativeHost: NativeMessagingHost | null = null;
  private transportsMap: Map<string, StreamableHTTPServerTransport | SSEServerTransport> =
    new Map();
  private singletonHandler: SingletonHandler;

  constructor() {
    this.fastify = Fastify({ logger: SERVER_CONFIG.LOGGER_ENABLED });
    this.singletonHandler = new SingletonHandler('chrome-mcp-native-server');

    // Set shutdown callback - allow shutdown if no active MCP sessions
    this.singletonHandler.setCanShutdownCallback(() => {
      const activeSessions = this.transportsMap.size;
      log('INFO', `Shutdown check: ${activeSessions} active MCP sessions`);
      // Allow shutdown if no active sessions, or always allow for now
      return activeSessions === 0;
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

  private async setupPlugins(): Promise<void> {
    await this.fastify.register(cors, {
      origin: SERVER_CONFIG.CORS_ORIGIN,
    });
  }

  private setupRoutes(): void {
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
        } catch (error: any) {
          if (error.message.includes('timed out')) {
            return reply
              .status(HTTP_STATUS.GATEWAY_TIMEOUT)
              .send({ status: 'error', message: ERROR_MESSAGES.REQUEST_TIMEOUT });
          } else {
            return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
              status: 'error',
              message: `Failed to get response from extension: ${error.message}`,
            });
          }
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

        log('INFO', 'Connecting MCP server to SSE transport');
        const server = getMcpServer();
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
      } else if (!sessionId && isInitializeRequest(request.body)) {
        log('INFO', 'Initialize request received, creating new session');
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

        log('INFO', 'Connecting MCP server to transport');
        await getMcpServer().connect(transport);
        log('SUCCESS', 'MCP server connected to transport');
      } else {
        log('ERROR', 'Invalid MCP request', { sessionId, isInitRequest: isInitializeRequest(request.body) });
        reply.code(HTTP_STATUS.BAD_REQUEST).send({ error: ERROR_MESSAGES.INVALID_MCP_REQUEST });
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
        log('ERROR', `No transport found for session: ${sessionId}`);
        reply.code(HTTP_STATUS.BAD_REQUEST).send({ error: ERROR_MESSAGES.INVALID_SSE_SESSION });
        return;
      }

      log('INFO', `Setting up SSE stream for session: ${sessionId}`);
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.flushHeaders(); // Ensure headers are sent immediately

      try {
        log('INFO', `Starting SSE stream handling for session: ${sessionId}`);
        // transport.handleRequest will take over the response stream
        await transport.handleRequest(request.raw, reply.raw);
        if (!reply.sent) {
          // If transport didn't send anything (unlikely for SSE initial handshake)
          log('INFO', `Hijacking reply for session: ${sessionId}`);
          reply.hijack(); // Prevent Fastify from automatically sending response
        }
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

  public async start(port = NATIVE_SERVER_PORT, nativeHost: NativeMessagingHost): Promise<void> {
    log('INFO', `Server.start() called with port: ${port}`);

    if (!this.nativeHost) {
      log('INFO', 'Setting native host reference');
      this.nativeHost = nativeHost; // Ensure nativeHost is set
    } else if (this.nativeHost !== nativeHost) {
      log('INFO', 'Updating native host reference to new instance');
      this.nativeHost = nativeHost; // Update to the passed instance
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
      // No need to return, Promise resolves void by default
    } catch (err) {
      this.isRunning = false; // Startup failed, reset status
      log('ERROR', 'Failed to start Fastify server', { error: err });
      // Throw error instead of exiting directly, let caller (possibly NativeHost) handle
      throw err; // or return Promise.reject(err);
      // process.exit(1); // Not recommended to exit directly here
    }
  }

  public async stop(): Promise<void> {
    log('INFO', 'Server.stop() called');

    if (!this.isRunning) {
      log('WARN', 'Server is not running, skipping stop');
      return;
    }
    // this.nativeHost = null; // Not recommended to nullify here, association relationship may still be needed
    try {
      log('INFO', 'Attempting to close Fastify server');
      await this.fastify.close();
      this.isRunning = false; // Update running status
      log('SUCCESS', 'Fastify server closed successfully');
    } catch (err) {
      // Even if closing fails, mark as not running, but log the error
      this.isRunning = false;
      log('ERROR', 'Failed to close Fastify server', { error: err });
      throw err; // Throw error
    }
  }

  public getInstance(): FastifyInstance {
    return this.fastify;
  }
}

const serverInstance = new Server();
export default serverInstance;
