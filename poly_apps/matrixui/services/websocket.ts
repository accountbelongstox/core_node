
import { WSRequest, WSResponse } from '../types/api';
import { MockBackend } from './mockBackend';

type MessageHandler = (response: WSResponse) => void;

class WebSocketService {
  private mockBackend: MockBackend;
  private listeners: Set<MessageHandler>;
  private isConnected: boolean = false;
  private messageQueue: Array<{ namespace: string; action: string; data: any }> = [];
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    this.mockBackend = new MockBackend();
    this.listeners = new Set();
  }

  // Simulate Connection
  public connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve) => {
      console.log('[WS] Connecting to Unified WebSocket...');
      setTimeout(() => {
        this.isConnected = true;
        console.log('[WS] Connected.');
        // Process queued messages
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

    // Simulate Network Delay and Backend Processing
    setTimeout(() => {
      const response = this.mockBackend.processMessage(request);
      console.log(`[WS-IN] ${response.namespace}:${response.action}`, response.data);
      this.notifyListeners(response);
    }, 150 + Math.random() * 200);
  }

  public async send(namespace: string, action: string, data: any = {}): Promise<void> {
    if (!this.isConnected) {
      // Silently queue message without warning (this is expected during initialization)
      this.messageQueue.push({ namespace, action, data });
      // Try to connect if not already connecting
      if (!this.connectionPromise) {
        await this.connect();
      } else {
        // Wait for existing connection to complete
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
