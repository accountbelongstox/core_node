/**
 * Singleton Detector for Native Server
 *
 * Prevents multiple Native Server instances from running on the same port.
 * When a new instance starts, it can detect and shutdown existing instances.
 *
 * Based on Python singleton_detector.py pattern.
 */

import http from 'http';
import { stderr } from 'process';

// Log function for debugging
function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [Singleton] [${level}] ${message}`;
  if (data) {
    stderr.write(`${logMessage} ${JSON.stringify(data)}\n`);
  } else {
    stderr.write(`${logMessage}\n`);
  }
}

// ============================================================
// Protocol Definition
// ============================================================

export const PROTOCOL_VERSION = 'CHROME_MCP_SINGLETON_V1';

export enum MessageType {
  CHECK = 'CHECK',
  ALIVE = 'ALIVE',
  SHUTDOWN = 'SHUTDOWN',
  SHUTDOWN_ACK = 'SHUTDOWN_ACK',
  STATUS = 'STATUS',
  STATUS_RESPONSE = 'STATUS_RESPONSE',
}

export interface SingletonMessage {
  protocol: string;
  type: MessageType;
  pid: number;
  timestamp: number;
  [key: string]: any;
}

export interface DetectionResult {
  isExisting: boolean;
  canStart: boolean;
  existingPid?: number;
  message: string;
}

// ============================================================
// Singleton Detector
// ============================================================

export class SingletonDetector {
  private appId: string;
  private port: number;
  private timeout: number;
  private shutdownExisting: boolean;

  constructor(
    appId: string,
    port: number,
    timeout: number = 2000,
    shutdownExisting: boolean = true
  ) {
    this.appId = appId;
    this.port = port;
    this.timeout = timeout;
    this.shutdownExisting = shutdownExisting;
  }

  /**
   * Create protocol message
   */
  private createMessage(type: MessageType, extra: Record<string, any> = {}): SingletonMessage {
    return {
      protocol: PROTOCOL_VERSION,
      type,
      pid: process.pid,
      timestamp: Date.now(),
      appId: this.appId,
      ...extra,
    };
  }

  /**
   * Validate received message
   */
  private validateMessage(message: any): boolean {
    if (!message || typeof message !== 'object') {
      return false;
    }

    // Check protocol version
    if (message.protocol !== PROTOCOL_VERSION) {
      log('WARN', `Protocol mismatch: ${message.protocol}`);
      return false;
    }

    // Check app ID
    if (message.appId !== this.appId) {
      log('WARN', `App ID mismatch: ${message.appId}`);
      return false;
    }

    return true;
  }

  /**
   * Send HTTP request to existing instance
   */
  private async sendMessageAndWaitResponse(
    message: SingletonMessage
  ): Promise<SingletonMessage | null> {
    return new Promise((resolve) => {
      const timeout = message.type === MessageType.SHUTDOWN ? 3000 : this.timeout;

      const data = JSON.stringify(message);
      const options = {
        hostname: '127.0.0.1',
        port: this.port,
        path: '/singleton',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout,
      };

      const req = http.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(responseData);
            if (this.validateMessage(response)) {
              resolve(response);
            } else {
              log('WARN', `[Singleton] Invalid response from port ${this.port}`);
              resolve(null);
            }
          } catch (error) {
            log('ERROR', `[Singleton] Failed to parse response:`, error);
            resolve(null);
          }
        });
      });

      req.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ECONNREFUSED') {
          log('INFO', `[Singleton] Port ${this.port} not in use`);
        } else {
          log('ERROR', `[Singleton] Connection error:`, error.message);
        }
        resolve(null);
      });

      req.on('timeout', () => {
        log('WARN', `[Singleton] Request timeout for port ${this.port}`);
        req.destroy();
        resolve(null);
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Try to connect and verify existing instance
   */
  private async tryConnectAndVerify(): Promise<SingletonMessage | null> {
    log('INFO', `[Singleton] Checking port ${this.port} for existing instance...`);

    const checkMsg = this.createMessage(MessageType.CHECK);
    const response = await this.sendMessageAndWaitResponse(checkMsg);

    if (response && response.type === MessageType.ALIVE) {
      log('INFO', `[Singleton] Found valid instance (PID ${response.pid}) on port ${this.port}`);
      return response;
    }

    log('INFO', `[Singleton] No valid instance found on port ${this.port}`);
    return null;
  }

  /**
   * Send shutdown request to existing instance
   */
  private async sendShutdownRequest(): Promise<{ accepted: boolean; reason: string }> {
    log('WARN', `[Singleton] Sending SHUTDOWN request to existing instance on port ${this.port}`);

    const shutdownMsg = this.createMessage(MessageType.SHUTDOWN);
    const response = await this.sendMessageAndWaitResponse(shutdownMsg);

    if (response && response.type === MessageType.SHUTDOWN_ACK) {
      const accepted = response.accepted === true;
      const reason = response.reason || '';

      if (accepted) {
        log('INFO', `[Singleton] Shutdown ACCEPTED: ${reason}`);
      } else {
        log('WARN', `[Singleton] Shutdown REJECTED: ${reason}`);
      }

      return { accepted, reason };
    }

    log('ERROR', `[Singleton] No valid shutdown response received`);
    return {
      accepted: false,
      reason: 'No response from existing instance',
    };
  }

  /**
   * Wait for port to become available
   */
  private async waitForPortAvailable(maxRetries: number = 5, retryDelay: number = 500): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      if (i > 0) {
        log('INFO', `[Singleton] Retry ${i}/${maxRetries} after ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      // Try to connect - if connection fails, port is available
      const response = await this.tryConnectAndVerify();
      if (!response) {
        log('INFO', `[Singleton] Port ${this.port} is now available`);
        return true;
      }
    }

    log('ERROR', `[Singleton] Port ${this.port} still in use after ${maxRetries} retries`);
    return false;
  }

  /**
   * Detect and handle existing instances
   *
   * Returns:
   *   - isExisting: true if found existing instance
   *   - canStart: true if new instance can start (no conflict or shutdown succeeded)
   *   - message: Human-readable status message
   */
  async detect(): Promise<DetectionResult> {
    log('INFO', '='.repeat(60));
    log('INFO', `[Singleton] Starting detection for '${this.appId}' on port ${this.port}`);
    log('INFO', `[Singleton] Shutdown existing: ${this.shutdownExisting}`);
    log('INFO', '='.repeat(60));

    // Try to connect and verify existing instance
    const existingInstance = await this.tryConnectAndVerify();

    if (!existingInstance) {
      // No existing instance found, can start immediately
      log('INFO', `[Singleton] ✅ No existing instance, can start on port ${this.port}`);
      return {
        isExisting: false,
        canStart: true,
        message: `No existing instance found on port ${this.port}`,
      };
    }

    // Found existing instance
    const existingPid = existingInstance.pid;
    log('WARN', `[Singleton] ⚠️  Found existing instance (PID ${existingPid}) on port ${this.port}`);

    if (!this.shutdownExisting) {
      // Don't shutdown, report conflict
      log('ERROR', `[Singleton] ❌ Cannot start: existing instance running (PID ${existingPid})`);
      return {
        isExisting: true,
        canStart: false,
        existingPid,
        message: `Existing instance found on port ${this.port} (PID ${existingPid})`,
      };
    }

    // Try to shutdown existing instance
    const shutdownResult = await this.sendShutdownRequest();

    if (!shutdownResult.accepted) {
      // Shutdown rejected
      log('ERROR', `[Singleton] ❌ Shutdown rejected: ${shutdownResult.reason}`);
      return {
        isExisting: true,
        canStart: false,
        existingPid,
        message: `Shutdown rejected: ${shutdownResult.reason}`,
      };
    }

    // Shutdown accepted, wait for old instance to stop
    log('INFO', `[Singleton] Shutdown accepted, waiting for old instance (PID ${existingPid}) to exit...`);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Wait for port to become available
    const portAvailable = await this.waitForPortAvailable();

    if (portAvailable) {
      log('INFO', `[Singleton] ✅ Old instance exited, can start on port ${this.port}`);
      return {
        isExisting: true,
        canStart: true,
        existingPid,
        message: `Shutdown existing instance (PID ${existingPid}), ready to start`,
      };
    } else {
      log('ERROR', `[Singleton] ❌ Old instance did not exit, port still in use`);
      return {
        isExisting: true,
        canStart: false,
        existingPid,
        message: `Old instance (PID ${existingPid}) did not exit after shutdown`,
      };
    }
  }
}

// ============================================================
// Singleton Handler (for PRIMARY instance)
// ============================================================

export class SingletonHandler {
  private appId: string;
  private canShutdownCallback: (() => boolean) | null = null;
  private shutdownCallback: (() => Promise<void>) | null = null;

  constructor(appId: string) {
    this.appId = appId;
  }

  /**
   * Set callback to check if shutdown is allowed
   */
  setCanShutdownCallback(callback: () => boolean): void {
    this.canShutdownCallback = callback;
  }

  /**
   * Set callback that gracefully releases resources (close the HTTP server, end
   * MCP sessions) right before the process exits on an accepted SHUTDOWN.
   */
  setShutdownCallback(callback: () => Promise<void>): void {
    this.shutdownCallback = callback;
  }

  /**
   * Handle singleton protocol message
   */
  handleMessage(message: SingletonMessage): SingletonMessage | null {
    // Validate protocol
    if (message.protocol !== PROTOCOL_VERSION) {
      log('WARN', `[Singleton] Invalid protocol: ${message.protocol}`);
      return null;
    }

    if (message.appId !== this.appId) {
      log('WARN', `[Singleton] Invalid app ID: ${message.appId}`);
      return null;
    }

    const { type, pid } = message;
    log('INFO', `[Singleton] Received ${type} from PID ${pid}`);

    switch (type) {
      case MessageType.CHECK:
        // Respond with ALIVE
        return {
          protocol: PROTOCOL_VERSION,
          type: MessageType.ALIVE,
          pid: process.pid,
          timestamp: Date.now(),
          appId: this.appId,
          isPrimary: true,
        };

      case MessageType.STATUS:
        // Respond with status
        const canShutdown = this.canShutdownCallback ? this.canShutdownCallback() : true;
        return {
          protocol: PROTOCOL_VERSION,
          type: MessageType.STATUS_RESPONSE,
          pid: process.pid,
          timestamp: Date.now(),
          appId: this.appId,
          canShutdown,
        };

      case MessageType.SHUTDOWN:
        // Check if shutdown is allowed
        const allowed = this.canShutdownCallback ? this.canShutdownCallback() : true;

        if (allowed) {
          log('WARN', `[Singleton] 🔴 Shutdown accepted from PID ${pid}, will exit...`);

          // Schedule shutdown after sending response. Release the port
          // gracefully first: closing the HTTP server ends any connected MCP
          // client's stream cleanly so it re-initializes, instead of a raw TCP
          // reset from a bare process.exit() mid-request. A hard-exit timer
          // guarantees we still exit even if the graceful close hangs (e.g. on a
          // long-lived SSE stream).
          setTimeout(async () => {
            const hardExit = setTimeout(() => {
              log('WARN', `[Singleton] Graceful shutdown timed out, forcing exit`);
              process.exit(0);
            }, 2000);
            try {
              if (this.shutdownCallback) {
                await this.shutdownCallback();
              }
            } catch (err: any) {
              log('ERROR', `[Singleton] Error during graceful shutdown:`, err?.message || err);
            } finally {
              clearTimeout(hardExit);
              log('INFO', `[Singleton] Exiting process...`);
              process.exit(0);
            }
          }, 300);

          return {
            protocol: PROTOCOL_VERSION,
            type: MessageType.SHUTDOWN_ACK,
            pid: process.pid,
            timestamp: Date.now(),
            appId: this.appId,
            accepted: true,
            reason: 'Shutdown accepted',
          };
        } else {
          log('WARN', `[Singleton] ⚠️  Shutdown rejected from PID ${pid}: server is busy`);
          return {
            protocol: PROTOCOL_VERSION,
            type: MessageType.SHUTDOWN_ACK,
            pid: process.pid,
            timestamp: Date.now(),
            appId: this.appId,
            accepted: false,
            reason: 'Server is busy or has active sessions',
          };
        }

      default:
        log('WARN', `[Singleton] Unknown message type: ${type}`);
        return null;
    }
  }
}
