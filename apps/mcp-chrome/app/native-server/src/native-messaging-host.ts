import { stdin, stdout, stderr } from 'process';
import { Server } from './server';
import { v4 as uuidv4 } from 'uuid';
import { NativeMessageType } from 'chrome-mcp-shared';
import { TIMEOUTS } from './constant';
import fileHandler from './file-handler';
import { SingletonDetector } from './server/singleton';

// Log function for debugging
function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [NativeHost] [${level}] ${message}`;
  if (data) {
    stderr.write(`${logMessage} ${JSON.stringify(data)}\n`);
  } else {
    stderr.write(`${logMessage}\n`);
  }
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeoutId: NodeJS.Timeout;
}

export class NativeMessagingHost {
  private associatedServer: Server | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private keepAliveTimer: NodeJS.Timeout | null = null;
  // Whether the Chrome extension's stdio link to THIS process is still alive.
  // Goes false when stdin ends (Service Worker disconnected / went idle). An
  // orphaned process can no longer relay tool calls, so it must yield the port
  // to a fresh instance that does have a live link.
  private extensionConnected = true;

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
      process.exit(1);
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

        if (expectedLength !== -1 && buffer.length >= expectedLength) {
          const messageBuffer = buffer.slice(0, expectedLength);
          buffer = buffer.slice(expectedLength);

          try {
            const message = JSON.parse(messageBuffer.toString());
            this.handleMessage(message);
          } catch (error: any) {
            this.sendError(`Failed to parse message: ${error.message}`);
          }
          expectedLength = -1; // reset to get next data
        }
      }
    });

    stdin.on('end', () => {
      log('WARN', 'stdin ended - Chrome Extension Service Worker may have stopped');
      log('INFO', 'Server will continue running - use STOP message to shut down');
      // The extension link is gone; mark orphaned so a fresh instance can take
      // over the port even while this one still has active MCP sessions.
      this.extensionConnected = false;
      // Don't call cleanup() - let server continue running
      // Service Worker in MV3 may stop after inactivity, but server should persist

      // Keep process alive by setting up a persistent interval if server is running
      if (!this.keepAliveTimer && this.associatedServer) {
        this.keepAliveTimer = setInterval(() => {
          // Heartbeat to keep process alive - do nothing
        }, 30000); // 30 seconds
        log('INFO', 'Keep-alive timer started to prevent process exit');
      }
    });

    stdin.on('error', (err) => {
      log('ERROR', 'stdin error occurred', { error: err });
      // Don't call cleanup() automatically - only STOP message should shutdown
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
      this.sendError(`Failed to handle directive message: ${error.message}`);
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
      const requestId = uuidv4(); // Generate unique request ID

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId); // Remove from Map after timeout
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Store request's resolve/reject functions and timeout ID
      this.pendingRequests.set(requestId, { resolve, reject, timeoutId });

      // Send message with requestId to Chrome
      this.sendMessage({
        type: messageType, // Define a request type, e.g. 'request_data'
        payload: messagePayload,
        requestId: requestId, // <--- Key: include request ID
      });
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
      this.sendError(`Internal error: ${error}`);
      return;
    }

    if (this.associatedServer.isRunning) {
      log('WARN', 'Server is already running');
      this.sendMessage({
        type: NativeMessageType.ERROR,
        payload: { message: 'Server is already running' },
      });
      return;
    }

    // Singleton detection: check for existing instances
    log('INFO', `Performing singleton detection for port ${port}...`);
    const detector = new SingletonDetector('chrome-mcp-native-server', port, 2000, true);
    const detectionResult = await detector.detect();

    if (!detectionResult.canStart) {
      if (detectionResult.isExisting) {
        // A healthy server is already listening on this port and could not be
        // shut down (e.g. it still has active MCP sessions). The extension only
        // needs *a* server reachable on the port, so adopt the existing one and
        // report success instead of surfacing a fatal error.
        log(
          'WARN',
          `Existing server present on port ${port}; adopting it instead of failing: ${detectionResult.message}`,
        );
        this.sendMessage({
          type: NativeMessageType.SERVER_STARTED,
          payload: { port, adopted: true },
        });
        return;
      }
      const errorMsg = `Cannot start server: ${detectionResult.message}`;
      log('ERROR', errorMsg);
      this.sendError(errorMsg);
      return;
    }

    if (detectionResult.isExisting) {
      log('INFO', `Existing instance (PID ${detectionResult.existingPid}) was shut down successfully`);
    }

    log('INFO', `Starting Fastify HTTP server on port ${port}...`);
    await this.associatedServer.start(port, this);
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
      this.sendError('Internal error: server instance not set');
      return;
    }

    if (!this.associatedServer.isRunning) {
      this.sendMessage({
        type: NativeMessageType.ERROR,
        payload: { message: 'Server is not running' },
      });
      return;
    }

    await this.associatedServer.stop();
    this.sendMessage({ type: NativeMessageType.SERVER_STOPPED });
  }

  /**
   * Send message to Chrome extension
   */
  public sendMessage(message: any): void {
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



  /**
   * Clean up resources
   */
  private cleanup(): void {
    // Clear keep-alive timer
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }

    // Reject all pending requests
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Native host is shutting down or Chrome disconnected.'));
    });
    this.pendingRequests.clear();

    if (this.associatedServer && this.associatedServer.isRunning) {
      this.associatedServer
        .stop()
        .then(() => {
          process.exit(0);
        })
        .catch(() => {
          process.exit(1);
        });
    } else {
      process.exit(0);
    }
  }
}

const nativeMessagingHostInstance = new NativeMessagingHost();
export default nativeMessagingHostInstance;
