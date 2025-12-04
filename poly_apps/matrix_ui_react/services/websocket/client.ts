// WebSocket Client - Unified WebSocket connection
import { API_CONFIG } from '../api/config';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketMessage {
  namespace: string;
  action: string;
  data?: any;
  messageId?: string;
}

export interface WebSocketResponse extends WebSocketMessage {
  error?: {
    code: string;
    message: string;
  };
}

type MessageHandler = (response: WebSocketResponse) => void;
type StatusHandler = (status: WebSocketStatus) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private status: WebSocketStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers = new Map<string, Set<MessageHandler>>();
  private statusHandlers = new Set<StatusHandler>();
  private pendingMessages: WebSocketMessage[] = [];
  private messageIdCounter = 0;

  constructor() {
    this.url = API_CONFIG.wsURL;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setStatus('connecting');

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.setStatus('connected');
          this.reconnectAttempts = 0;
          this.flushPendingMessages();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketResponse = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          this.setStatus('error');
          reject(error);
        };

        this.ws.onclose = () => {
          this.setStatus('disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        this.setStatus('error');
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  private setStatus(status: WebSocketStatus) {
    this.status = status;
    this.statusHandlers.forEach((handler) => handler(status));
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    this.setStatus('connecting');

    setTimeout(() => {
      this.connect().catch(() => {
        // Reconnect will be attempted again
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private flushPendingMessages() {
    while (this.pendingMessages.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.pendingMessages.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  send(message: WebSocketMessage): Promise<WebSocketResponse> {
    return new Promise((resolve, reject) => {
      if (!message.messageId) {
        message.messageId = `msg_${++this.messageIdCounter}_${Date.now()}`;
      }

      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify(message));

          // Set up one-time handler for response
          const handler: MessageHandler = (response) => {
            if (response.messageId === message.messageId) {
              this.off(message.namespace, message.action, handler);
              if (response.error) {
                reject(new Error(response.error.message));
              } else {
                resolve(response);
              }
            }
          };

          this.on(message.namespace, message.action, handler);

          // Timeout after 30 seconds
          setTimeout(() => {
            this.off(message.namespace, message.action, handler);
            reject(new Error('Request timeout'));
          }, 30000);
        } catch (error) {
          reject(error);
        }
      } else {
        // Queue message for when connection is ready
        this.pendingMessages.push(message);
        this.connect()
          .then(() => {
            // Message will be sent when connection opens
            this.send(message).then(resolve).catch(reject);
          })
          .catch(reject);
      }
    });
  }

  on(namespace: string, action: string, handler: MessageHandler) {
    const key = `${namespace}:${action}`;
    if (!this.messageHandlers.has(key)) {
      this.messageHandlers.set(key, new Set());
    }
    this.messageHandlers.get(key)!.add(handler);
  }

  off(namespace: string, action: string, handler: MessageHandler) {
    const key = `${namespace}:${action}`;
    const handlers = this.messageHandlers.get(key);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.messageHandlers.delete(key);
      }
    }
  }

  onStatusChange(handler: StatusHandler) {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  private handleMessage(message: WebSocketResponse) {
    const key = `${message.namespace}:${message.action}`;
    const handlers = this.messageHandlers.get(key);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }

    // Also notify wildcard handlers
    const wildcardKey = `${message.namespace}:*`;
    const wildcardHandlers = this.messageHandlers.get(wildcardKey);
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(message));
    }
  }

  getStatus(): WebSocketStatus {
    return this.status;
  }

  // Convenience methods for common actions
  async systemHealth(): Promise<WebSocketResponse> {
    return this.send({ namespace: 'system', action: 'health' });
  }

  async systemHealthDetailed(): Promise<WebSocketResponse> {
    return this.send({ namespace: 'system', action: 'health_detailed' });
  }

  async deviceList(): Promise<WebSocketResponse> {
    return this.send({ namespace: 'device', action: 'list' });
  }

  async deviceGet(serial: string): Promise<WebSocketResponse> {
    return this.send({
      namespace: 'device',
      action: 'get',
      data: { serial },
    });
  }

  async deviceConnect(serial: string, config?: any): Promise<WebSocketResponse> {
    return this.send({
      namespace: 'device',
      action: 'connect',
      data: { serial, ...config },
    });
  }

  async deviceDisconnect(serial: string): Promise<WebSocketResponse> {
    return this.send({
      namespace: 'device',
      action: 'disconnect',
      data: { serial },
    });
  }

  async screenPower(serial: string, action: 'on' | 'off' | 'toggle'): Promise<WebSocketResponse> {
    return this.send({
      namespace: 'screen',
      action: 'power',
      data: { serial, action },
    });
  }

  async screenSetBrightness(serial: string, level: number): Promise<WebSocketResponse> {
    return this.send({
      namespace: 'screen',
      action: 'set_brightness',
      data: { serial, level },
    });
  }

  async screenGetBrightness(serial: string): Promise<WebSocketResponse> {
    return this.send({
      namespace: 'screen',
      action: 'get_brightness',
      data: { serial },
    });
  }

  async controlTouch(
    serial: string,
    action: string,
    x: number,
    y: number,
    screenWidth: number,
    screenHeight: number,
    pressure = 1.0
  ): Promise<WebSocketResponse> {
    return this.send({
      namespace: 'control',
      action: 'touch',
      data: {
        serial,
        action,
        x,
        y,
        pressure,
        screenWidth,
        screenHeight,
      },
    });
  }

  async controlKey(serial: string, keyCode: number, action: string, metaState = 0): Promise<WebSocketResponse> {
    return this.send({
      namespace: 'control',
      action: 'key',
      data: {
        serial,
        action,
        keyCode,
        metaState,
      },
    });
  }

  async controlSystemKey(serial: string, keyCode: number): Promise<WebSocketResponse> {
    return this.send({
      namespace: 'control',
      action: 'systemkey',
      data: { serial, keyCode },
    });
  }

  async groupList(): Promise<WebSocketResponse> {
    return this.send({ namespace: 'group', action: 'list' });
  }

  async groupGet(groupId: string): Promise<WebSocketResponse> {
    return this.send({
      namespace: 'group',
      action: 'get',
      data: { groupId },
    });
  }

  async groupCreate(name: string, parentId?: string): Promise<WebSocketResponse> {
    return this.send({
      namespace: 'group',
      action: 'create',
      data: { name, parentId },
    });
  }
}

export const wsClient = new WebSocketClient();

