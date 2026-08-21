import { stdin, stdout } from 'process';
import type { Server } from './server';
import { v4 as uuidv4 } from 'uuid';
import { NativeMessageType } from 'chrome-mcp-shared';
import { ERROR_MESSAGES, TIMEOUTS } from './constant';
import fileHandler from './file-handler';
import { SingletonDetector } from './server/singleton';
import { createLogger } from './util/logger';

const log = createLogger('NativeHost');

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeoutId: NodeJS.Timeout;
}

const HOST_SHUTDOWN_TIMEOUT_MS = 2000;

export class ExtensionConnectionError extends Error {
  constructor(message: string = ERROR_MESSAGES.EXTENSION_NOT_CONNECTED) {
    super(message);
    this.name = 'ExtensionConnectionError';
  }
}

export class ExtensionRequestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request to browser extension timed out after ${timeoutMs}ms.`);
    this.name = 'ExtensionRequestTimeoutError';
  }
}

export class NativeMessagingHost {
  private associatedServer: Server | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private extensionConnected = true;
  private shutdownPromise: Promise<void> | null = null;
  private shutdownExitCode = 0;

  public isExtensionConnected(): boolean {
    return this.extensionConnected;
  }

  public setServer(serverInstance: Server): void {
    this.associatedServer = serverInstance;
  }

  // add message handler to wait for start server
  public start(): void {
    try {
      log('INFO', 'Native Messaging Host starting...');
      this.setupMessageHandling();
      log('INFO', 'Native Messaging Host started, waiting for messages from Chrome Extension');
    } catch (error: any) {
      log('ERROR', 'Failed to start Native Messaging Host', { error: error.message });
      void this.shutdown('Native messaging host startup failed.', 1);
    }
  }

  private setupMessageHandling(): void {
    let buffer = Buffer.alloc(0);
    let expectedLength = -1;

    stdin.on('readable', () => {
      let chunk;
      while ((chunk = stdin.read()) !== null) {
        buffer = Buffer.concat([buffer, chunk]);

        if (expectedLength === -1 && buffer.length >= 4) {
          expectedLength = buffer.readUInt32LE(0);
          buffer = buffer.slice(4);
        }

        while (expectedLength !== -1 && buffer.length >= expectedLength) {
          const messageBuffer = buffer.slice(0, expectedLength);
          buffer = buffer.slice(expectedLength);

          try {
            const message = JSON.parse(messageBuffer.toString());
            void this.handleMessage(message).catch((error) => {
              log('ERROR', 'Native message handling failed', { error });
              void this.shutdown('Native message handling failed.', 1);
            });
          } catch (error: any) {
            this.sendError(`Failed to parse message: ${error.message}`);
          }
          expectedLength = -1;
          if (buffer.length >= 4) {
            expectedLength = buffer.readUInt32LE(0);
            buffer = buffer.slice(4);
          }
        }
      }
    });

    stdin.on('end', () => {
      void this.shutdown('Browser extension closed the native messaging port.');
    });

    stdin.on('error', (err) => {
      log('ERROR', 'stdin error occurred', { error: err });
      void this.shutdown('Native messaging input failed.');
    });

    // Stream errors are lifecycle events: once stdout is broken this process can
    // no longer own a usable MCP server.
    stdout.on('error', (err: NodeJS.ErrnoException) => {
      const code = err?.code;
      if (code === 'EPIPE' || code === 'ERR_STREAM_WRITE_AFTER_END') {
        log('WARN', 'stdout write to extension failed (link down)', { code });
      } else {
        log('ERROR', 'stdout error', { error: err?.message });
      }
      void this.shutdown('Native messaging output failed.');
    });
  }

  private async handleMessage(message: any): Promise<void> {
    if (!message || typeof message !== 'object') {
      this.sendError('Invalid message format');
      return;
    }

    if (message.responseToRequestId) {
      const requestId = message.responseToRequestId;
      const pending = this.pendingRequests.get(requestId);

      if (pending) {
        clearTimeout(pending.timeoutId);
        if (message.error) {
          pending.reject(new Error(message.error));
        } else {
          pending.resolve(message.payload);
        }
        this.pendingRequests.delete(requestId);
      } else {
        // just ignore
      }
      return;
    }

    // Handle directive messages from Chrome
    try {
      log('INFO', 'Received message from Chrome Extension', { type: message.type, payload: message.payload });
      switch (message.type) {
        case NativeMessageType.START:
          log('INFO', `START message received, port: ${message.payload?.port || 3000}`);
          await this.startServer(message.payload?.port || 3000);
          break;
        case NativeMessageType.STOP:
          log('INFO', 'STOP message received');
          await this.stopServer();
          break;
        // Keep ping/pong for simple liveness detection, but this differs from request-response pattern
        case 'ping_from_extension':
          log('INFO', 'PING received from extension');
          this.sendMessage({ type: 'pong_to_extension' });
          break;
        case 'file_operation':
          log('INFO', 'FILE_OPERATION message received');
          await this.handleFileOperation(message);
          break;
        default:
          // Double check when message type is not supported
          if (!message.responseToRequestId) {
            log('WARN', `Unknown message type: ${message.type || 'no type'}`);
            this.sendError(
              `Unknown message type or non-response message: ${message.type || 'no type'}`,
            );
          }
      }
    } catch (error: any) {
      const errorMessage = `Failed to handle directive message: ${error.message}`;
      try {
        this.sendError(errorMessage);
      } finally {
        if (message.type === NativeMessageType.START) {
          void this.shutdown(errorMessage);
        }
      }
    }
  }

  /**
   * Handle file operations from the extension
   */
  private async handleFileOperation(message: any): Promise<void> {
    try {
      const result = await fileHandler.handleFileRequest(message.payload);
      
      if (message.requestId) {
        // Send response back with the request ID
        this.sendMessage({
          type: 'file_operation_response',
          responseToRequestId: message.requestId,
          payload: result,
        });
      } else {
        // No request ID, just send result
        this.sendMessage({
          type: 'file_operation_result',
          payload: result,
        });
      }
    } catch (error: any) {
      const errorResponse = {
        success: false,
        error: error.message || 'Unknown error during file operation',
      };
      
      if (message.requestId) {
        this.sendMessage({
          type: 'file_operation_response',
          responseToRequestId: message.requestId,
          error: errorResponse.error,
        });
      } else {
        this.sendError(`File operation failed: ${errorResponse.error}`);
      }
    }
  }

  /**
   * Send request to Chrome and wait for response
   * @param messagePayload Data to send to Chrome
   * @param timeoutMs Timeout for waiting response (milliseconds)
   * @returns Promise, resolves to Chrome's returned payload on success, rejects on failure
   */
  public sendRequestToExtensionAndWait(
    messagePayload: any,
    messageType: string = 'request_data',
    timeoutMs: number = TIMEOUTS.DEFAULT_REQUEST_TIMEOUT,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // This is the single connection gate for every relay call.
      if (!this.extensionConnected) {
        reject(new ExtensionConnectionError());
        return;
      }

      const requestId = uuidv4(); // Generate unique request ID

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId); // Remove from Map after timeout
        reject(new ExtensionRequestTimeoutError(timeoutMs));
      }, timeoutMs);

      // Store request's resolve/reject functions and timeout ID
      this.pendingRequests.set(requestId, { resolve, reject, timeoutId });

      try {
        this.sendMessage({
          type: messageType,
          payload: messagePayload,
          requestId,
        });
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  /**
   * Start Fastify server (now accepts Server instance)
   */
  private async startServer(port: number): Promise<void> {
    log('INFO', `startServer called with port: ${port}`);

    if (!this.associatedServer) {
      const error = 'Server instance not set';
      log('ERROR', error);
      throw new Error(error);
    }

    if (this.associatedServer.isRunning) {
      log('INFO', 'Server is already running for this native connection');
      this.sendMessage({
        type: NativeMessageType.SERVER_STARTED,
        payload: { port },
      });
      return;
    }

    // Singleton detection: check for existing instances
    log('INFO', `Performing singleton detection for port ${port}...`);
    const detector = new SingletonDetector('chrome-mcp-native-server', port, 2000, true);
    const detectionResult = await detector.detect();

    if (!detectionResult.canStart) {
      const errorMsg = `Cannot start server: ${detectionResult.message}`;
      log('ERROR', errorMsg);
      this.sendError(errorMsg);
      void this.shutdown(errorMsg);
      return;
    }

    if (detectionResult.isExisting) {
      log('INFO', `Existing instance (PID ${detectionResult.existingPid}) was shut down successfully`);
    }

    log('INFO', `Starting Fastify HTTP server on port ${port}...`);
    await this.associatedServer.start(port);
    log('SUCCESS', `Fastify HTTP server started successfully on port ${port}`);

    log('INFO', 'Sending SERVER_STARTED message to Chrome Extension');
    this.sendMessage({
      type: NativeMessageType.SERVER_STARTED,
      payload: { port },
    });
    log('INFO', 'SERVER_STARTED message sent successfully');
  }

  /**
   * Stop Fastify server
   */
  private async stopServer(): Promise<void> {
    if (!this.associatedServer) {
      throw new Error('Server instance not set');
    }

    if (this.associatedServer.isRunning) {
      await this.associatedServer.stop();
    }

    this.sendMessage({ type: NativeMessageType.SERVER_STOPPED });
    void this.shutdown('Browser extension stopped the MCP server.');
  }

  /**
   * Send message to Chrome extension
   */
  public sendMessage(message: any): void {
    if (!this.extensionConnected) {
      throw new ExtensionConnectionError();
    }
    const messageString = JSON.stringify(message);
    const messageBuffer = Buffer.from(messageString);
    const headerBuffer = Buffer.alloc(4);
    headerBuffer.writeUInt32LE(messageBuffer.length, 0);
    stdout.write(Buffer.concat([headerBuffer, messageBuffer]));
  }

  /**
   * Send error message to Chrome extension (mainly for sending non-request-response type errors)
   */
  private sendError(errorMessage: string): void {
    this.sendMessage({
      type: NativeMessageType.ERROR_FROM_NATIVE_HOST, // Use more explicit type
      payload: { message: errorMessage },
    });
  }

  private rejectPendingRequests(reason: string): void {
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(new ExtensionConnectionError(reason));
    });
    this.pendingRequests.clear();
  }

  public shutdown(reason: string, exitCode: number = 0): Promise<void> {
    if (exitCode !== 0) {
      this.shutdownExitCode = exitCode;
    }
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.extensionConnected = false;
    this.rejectPendingRequests(reason);
    this.shutdownPromise = this.stopServerAndExit(reason);
    return this.shutdownPromise;
  }

  private async stopServerAndExit(reason: string): Promise<void> {
    const hardExit = setTimeout(
      () => process.exit(this.shutdownExitCode),
      HOST_SHUTDOWN_TIMEOUT_MS,
    );

    log('INFO', 'Native messaging connection closed; stopping its MCP server', { reason });
    try {
      if (this.associatedServer?.isRunning) {
        await this.associatedServer.stop();
      }
    } catch (error) {
      log('ERROR', 'Failed to stop MCP server during native host shutdown', { error });
    } finally {
      clearTimeout(hardExit);
      process.exit(this.shutdownExitCode);
    }
  }
}

const nativeMessagingHostInstance = new NativeMessagingHost();
export default nativeMessagingHostInstance;
