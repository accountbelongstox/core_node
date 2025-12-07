
import { WSRequest, WSResponse } from '../types/api';
import { MockBackend } from './mockBackend';

type MessageHandler = (response: WSResponse) => void;

class WebSocketService {
  private mockBackend: MockBackend;
  private listeners: Set<MessageHandler>;
  private isConnected: boolean = false;

  constructor() {
    this.mockBackend = new MockBackend();
    this.listeners = new Set();
  }

  // Simulate Connection
  public connect() {
    console.log('[WS] Connecting to Unified WebSocket...');
    setTimeout(() => {
      this.isConnected = true;
      console.log('[WS] Connected.');
      // Notify listeners of connection if needed, or just allow requests
    }, 500);
  }

  public addListener(handler: MessageHandler) {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  public send(namespace: string, action: string, data: any = {}) {
    if (!this.isConnected) {
      console.warn('[WS] Not connected, queueing or dropping message:', action);
    }

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

  private notifyListeners(response: WSResponse) {
    this.listeners.forEach(listener => listener(response));
  }
}

export const wsService = new WebSocketService();
