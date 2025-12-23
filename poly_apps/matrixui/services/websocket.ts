
import { WSRequest, WSResponse } from '../types/api';
import { MockBackend } from './mockBackend';
import { API_CONFIG } from '../config/api';

type MessageHandler = (response: WSResponse) => void;
type RpcEventHandler = (data: any) => void;

interface RpcClientOptions {
  baseUrl?: string;
  wsPath?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  debug?: boolean;
  clientId?: string;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  route: string;
  timestamp: number;
}

class WebSocketService {
  private mockBackend: MockBackend;
  private listeners: Set<MessageHandler>;
  private isConnected: boolean = false;
  private messageQueue: Array<{ namespace: string; action: string; data: any }> = [];
  private connectionPromise: Promise<void> | null = null;

  // RPC v2 Client properties
  private rpcWs: WebSocket | null = null;
  private rpcOptions: RpcClientOptions;
  private rpcPending: Map<string, PendingRequest> = new Map();
  private rpcEventHandlers: Map<string, RpcEventHandler> = new Map();
  private rpcReconnectAttempts: number = 0;
  private rpcReconnectTimer: number | null = null;
  private rpcHeartbeatTimer: number | null = null;
  private rpcClientId: string;

  constructor() {
    this.mockBackend = new MockBackend();
    this.listeners = new Set();
    
    // Initialize RPC v2 client options
    this.rpcClientId = this.getOrCreateClientId();
    this.rpcOptions = {
      baseUrl: API_CONFIG.HTTP_BASE_URL,
      wsPath: '/rpc/ws',
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      debug: false,
      clientId: this.rpcClientId
    };
  }

  private getOrCreateClientId(): string {
    try {
      const stored = localStorage.getItem('fastapi_rpc_client_id');
      if (stored) return stored;
      const newId = this.generateUUID();
      localStorage.setItem('fastapi_rpc_client_id', newId);
      return newId;
    } catch {
      return this.generateUUID();
    }
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // RPC v2 Client Methods
  public configureRpc(options: Partial<RpcClientOptions>) {
    this.rpcOptions = { ...this.rpcOptions, ...options };
    if (options.clientId) {
      this.rpcClientId = options.clientId;
      try {
        localStorage.setItem('fastapi_rpc_client_id', options.clientId);
      } catch {}
    }
  }

  public async connectRpc(): Promise<void> {
    // 如果已经连接，直接返回
    if (this.rpcWs && this.rpcWs.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    // 如果正在连接中，等待现有连接完成
    if (this.rpcWs && this.rpcWs.readyState === WebSocket.CONNECTING) {
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.rpcWs) {
            if (this.rpcWs.readyState === WebSocket.OPEN) {
              clearInterval(checkInterval);
              resolve();
            } else if (this.rpcWs.readyState === WebSocket.CLOSED) {
              clearInterval(checkInterval);
              // 连接失败，重新尝试连接
              this.connectRpc().then(resolve).catch(reject);
            }
          } else {
            clearInterval(checkInterval);
            reject(new Error('WebSocket instance lost'));
          }
        }, 100);
        
        // 超时保护：10秒后取消等待
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Connection timeout'));
        }, 10000);
      });
    }

    // 如果存在旧连接但已关闭，先清理
    if (this.rpcWs && this.rpcWs.readyState === WebSocket.CLOSED) {
      this.rpcWs = null;
    }

    return new Promise((resolve, reject) => {
      const wsUrl = this.rpcOptions.baseUrl!.replace(/^http/, 'ws') + 
                   this.rpcOptions.wsPath + 
                   `?client_id=${this.rpcOptions.clientId}`;
      
      if (this.rpcOptions.debug) {
        console.log('[RPC] Connecting to', wsUrl, 'at', new Date().toISOString());
      }

      try {
        const ws = new WebSocket(wsUrl);
        this.rpcWs = ws;

        ws.onopen = () => {
          this.isConnected = true;
          this.rpcReconnectAttempts = 0;
          if (this.rpcOptions.debug) {
            console.log('[RPC] WebSocket connected at', new Date().toISOString());
          }
          this.startRpcHeartbeat();
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            this.handleRpcMessage(payload);
          } catch (err) {
            console.error('[RPC] Invalid message', err);
          }
        };

        ws.onerror = (err) => {
          const errorInfo = {
            error: err,
            timestamp: new Date().toISOString(),
            readyState: ws.readyState
          };
          console.error('[RPC] WebSocket error', errorInfo);
          if (!this.isConnected) {
            reject(err instanceof Error ? err : new Error('WebSocket error'));
          }
        };

        ws.onclose = (event: CloseEvent) => {
          this.isConnected = false;
          this.stopRpcHeartbeat();
          
          const closeInfo = {
            code: event.code,
            reason: event.reason || '(no reason)',
            wasClean: event.wasClean,
            timestamp: new Date().toISOString()
          };
          
          if (this.rpcOptions.debug) {
            console.warn('[RPC] WebSocket closed', closeInfo);
            
            // 根据 close code 提供更详细的日志
            if (event.code === 1000) {
              console.log('[RPC] Normal closure (1000)');
            } else if (event.code === 1001) {
              console.log('[RPC] Going away (1001) - endpoint leaving');
            } else if (event.code === 1002) {
              console.error('[RPC] Protocol error (1002)');
            } else if (event.code === 1006) {
              console.error('[RPC] Abnormal closure (1006) - no close frame received');
            } else if (event.code === 1011) {
              console.error('[RPC] Internal server error (1011)');
            } else {
              console.warn(`[RPC] Unknown close code: ${event.code}`);
            }
          }
          
          this.handleRpcDisconnect();
        };
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to create WebSocket'));
      }
    });
  }

  public async callRpc(route: string, params: any = {}): Promise<any> {
    if (!this.isConnected || !this.rpcWs || this.rpcWs.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket not connected'));
    }

    const requestId = this.generateUUID();
    const payload = {
      type: 'request',
      id: requestId,
      route,
      params
    };

    return new Promise((resolve, reject) => {
      this.rpcPending.set(requestId, {
        resolve,
        reject,
        route,
        timestamp: Date.now()
      });

      try {
        this.rpcWs.send(JSON.stringify(payload));
      } catch (err) {
        this.rpcPending.delete(requestId);
        reject(err instanceof Error ? err : new Error('Failed to send request'));
      }
    });
  }

  // RPC v2 format (as per SIDEBAR_TOOLS_API.md) - uses 'data' instead of 'params'
  public async callRpcV2(route: string, data: any = {}): Promise<any> {
    if (!this.isConnected || !this.rpcWs || this.rpcWs.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket not connected'));
    }

    const requestId = `${route}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const payload = {
      type: 'request',
      id: requestId,
      route,
      data,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      this.rpcPending.set(requestId, {
        resolve,
        reject,
        route,
        timestamp: Date.now()
      });

      try {
        this.rpcWs.send(JSON.stringify(payload));
      } catch (err) {
        this.rpcPending.delete(requestId);
        reject(err instanceof Error ? err : new Error('Failed to send request'));
      }
    });
  }

  public onRpcEvent(route: string, handler: RpcEventHandler) {
    if (typeof handler !== 'function') {
      throw new Error('Event handler must be a function');
    }
    this.rpcEventHandlers.set(route, handler);
  }

  public offRpcEvent(route: string) {
    this.rpcEventHandlers.delete(route);
  }

  public disconnectRpc() {
    // 禁用自动重连（用户主动断开）
    const wasReconnecting = !!this.rpcReconnectTimer;
    
    if (this.rpcReconnectTimer) {
      clearTimeout(this.rpcReconnectTimer);
      this.rpcReconnectTimer = null;
    }
    
    this.stopRpcHeartbeat();
    
    if (this.rpcWs) {
      // 如果 WebSocket 正在连接或已连接，正常关闭
      if (this.rpcWs.readyState === WebSocket.CONNECTING || this.rpcWs.readyState === WebSocket.OPEN) {
        try {
          this.rpcWs.close(1000, 'Client disconnect');
        } catch (err) {
          if (this.rpcOptions.debug) {
            console.warn('[RPC] Error closing WebSocket', err);
          }
        }
      }
      this.rpcWs = null;
    }
    
    this.isConnected = false;
    this.rpcReconnectAttempts = 0;
    
    if (this.rpcOptions.debug && wasReconnecting) {
      console.log('[RPC] Disconnected (reconnect cancelled)');
    }
  }

  public getRpcClientId(): string {
    return this.rpcClientId;
  }

  public isRpcConnected(): boolean {
    return this.isConnected && this.rpcWs?.readyState === WebSocket.OPEN;
  }

  // ============================================================
  // Video Streaming - Batch Start
  // ============================================================

  public async batchStartStreams(serials: string[]): Promise<any> {
    /**
     * Start multiple video streams concurrently
     *
     * @param serials - Array of device serial numbers
     * @returns Promise with batch start results
     *
     * Events emitted for each device:
     * - 'device.ready': Device stream started successfully
     * - 'device.failed': Device stream failed to start
     */
    console.log('🔧 [wsService.batchStartStreams] ENTRY');
    console.log('🔧 [wsService.batchStartStreams] serials parameter:', serials);
    console.log('🔧 [wsService.batchStartStreams] serials.length:', serials.length);
    console.log('🔧 [wsService.batchStartStreams] typeof serials:', typeof serials);
    console.log('🔧 [wsService.batchStartStreams] Calling callRpcV2 with data:', { serials });

    const result = await this.callRpcV2('video.batch_start', { serials });

    console.log('🔧 [wsService.batchStartStreams] RPC result:', result);
    return result;
  }

  public onDeviceReady(callback: (event: any) => void) {
    /**
     * Listen for device ready events (from batch start)
     *
     * Event format: { type: 'device.ready', serial: string, timestamp: number }
     */
    this.onRpcEvent('device.ready', callback);
  }

  public onDeviceFailed(callback: (event: any) => void) {
    /**
     * Listen for device failed events (from batch start)
     *
     * Event format: { type: 'device.failed', serial: string, error: string }
     */
    this.onRpcEvent('device.failed', callback);
  }

  private handleRpcMessage(message: any) {
    if (this.rpcOptions.debug) {
      console.log('[RPC] Message', message);
    }

    if (message.type === 'response' && message.id) {
      const pending = this.rpcPending.get(message.id);
      if (pending) {
        this.rpcPending.delete(message.id);
        
        // Handle error response (RPC v2 format: response.data.error)
        if (message.data && message.data.error) {
          const error = message.data.error;
          pending.reject(new Error(error.message || error.code || 'Unknown error'));
        } else if (message.error) {
          // Legacy format
          pending.reject(new Error(message.error));
        } else {
          // RPC v2 format: response.data contains the result
          // Legacy format: message.result contains the result
          const result = message.data !== undefined ? message.data : message.result;
          pending.resolve(result);
        }
        
        if (message.requires_ack) {
          this.sendRpcAck(message.id);
        }
      }
    } else if (message.type === 'event') {
      const eventName = message.route || message.event;
      if (eventName && this.rpcEventHandlers.has(eventName)) {
        try {
          this.rpcEventHandlers.get(eventName)!(message.data || message);
        } catch (err) {
          console.error('[RPC] Event handler error', err);
        }
      }
    } else if (message.type === 'welcome') {
      if (this.rpcOptions.debug) {
        console.log('[RPC] Welcome payload received');
      }
    }
  }

  private sendRpcAck(requestId: string) {
    if (!this.rpcWs) return;
    const payload = { type: 'ack', id: requestId };
    this.rpcWs.send(JSON.stringify(payload));
  }

  private handleRpcDisconnect() {
    // Reject all pending requests
    for (const [id, pending] of this.rpcPending.entries()) {
      pending.reject(new Error('Connection lost'));
    }
    this.rpcPending.clear();

    // Attempt reconnect if enabled and not already reconnecting
    if (this.rpcOptions.reconnect && !this.rpcReconnectTimer) {
      this.attemptRpcReconnect();
    }
  }

  private attemptRpcReconnect() {
    // 如果已经有重连定时器在运行，不要重复创建
    if (this.rpcReconnectTimer) {
      return;
    }

    // 如果正在连接中，不要启动新的重连
    if (this.rpcWs && this.rpcWs.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (this.rpcReconnectAttempts >= this.rpcOptions.maxReconnectAttempts!) {
      console.error('[RPC] Max reconnect attempts reached');
      return;
    }

    this.rpcReconnectAttempts += 1;
    if (this.rpcOptions.debug) {
      console.log(`[RPC] Attempting reconnect ${this.rpcReconnectAttempts}/${this.rpcOptions.maxReconnectAttempts} in ${this.rpcOptions.reconnectInterval}ms`);
    }
    
    this.rpcReconnectTimer = window.setTimeout(() => {
      this.rpcReconnectTimer = null;
      this.connectRpc().catch((err) => {
        console.error('[RPC] Reconnect failed', err);
        // 只有在重连失败且没有达到最大次数时才继续重连
        if (this.rpcReconnectAttempts < this.rpcOptions.maxReconnectAttempts!) {
          this.attemptRpcReconnect();
        }
      });
    }, this.rpcOptions.reconnectInterval);
  }

  private startRpcHeartbeat() {
    this.stopRpcHeartbeat();
    this.rpcHeartbeatTimer = window.setInterval(() => {
      if (this.rpcWs && this.rpcWs.readyState === WebSocket.OPEN) {
        try {
          this.rpcWs.send(JSON.stringify({ type: 'ping' }));
        } catch (err) {
          if (this.rpcOptions.debug) {
            console.warn('[RPC] Failed to send ping', err);
          }
        }
      }
    }, 5000);
  }

  private stopRpcHeartbeat() {
    if (this.rpcHeartbeatTimer) {
      clearInterval(this.rpcHeartbeatTimer);
      this.rpcHeartbeatTimer = null;
    }
  }

  // Legacy WebSocket Methods (for backward compatibility)
  public connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve) => {
      console.log('[WS] Connecting to Unified WebSocket...');
      setTimeout(() => {
        this.isConnected = true;
        console.log('[WS] Connected.');
        this.processMessageQueue();
        resolve();
      }, 500);
    });

    return this.connectionPromise;
  }

  public addListener(handler: MessageHandler) {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  private processMessageQueue() {
    if (this.messageQueue.length > 0) {
      console.log(`[WS] Processing ${this.messageQueue.length} queued messages`);
      const queue = [...this.messageQueue];
      this.messageQueue = [];
      queue.forEach(({ namespace, action, data }) => {
        this.sendInternal(namespace, action, data);
      });
    }
  }

  private sendInternal(namespace: string, action: string, data: any = {}) {
    const request: WSRequest = {
      namespace,
      action,
      data,
      messageId: crypto.randomUUID()
    };

    console.log(`[WS-OUT] ${namespace}:${action}`, data);

    setTimeout(() => {
      const response = this.mockBackend.processMessage(request);
      console.log(`[WS-IN] ${response.namespace}:${response.action}`, response.data);
      this.notifyListeners(response);
    }, 150 + Math.random() * 200);
  }

  public async send(namespace: string, action: string, data: any = {}): Promise<void> {
    if (!this.isConnected) {
      this.messageQueue.push({ namespace, action, data });
      if (!this.connectionPromise) {
        await this.connect();
      } else {
        await this.connectionPromise;
      }
      return;
    }

    this.sendInternal(namespace, action, data);
  }

  private notifyListeners(response: WSResponse) {
    this.listeners.forEach(listener => listener(response));
  }
}

export const wsService = new WebSocketService();
