// API Client for Developer Hub
// Handles HTTP and WebSocket communication with backend services

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ToolExecutionParams {
  [key: string]: any;
}

export interface WebSocketMessage {
  id: string;
  method: string;
  params?: any;
  result?: any;
  error?: string;
}

export interface WebSocketCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
}

class ApiClient {
  private baseUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private wsCallbacks: WebSocketCallbacks = {};
  private messageId = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor() {
    // Use 127.0.0.1 as requested
    this.baseUrl = 'http://127.0.0.1:8080';
    this.wsUrl = 'ws://127.0.0.1:8081';
  }

  // HTTP API Methods
  async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API GET ${endpoint} error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async post<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API POST ${endpoint} error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // IT Tools API
  async getAllTools(): Promise<ApiResponse> {
    return this.get('/api/tools');
  }

  async getToolsByCategory(category: string): Promise<ApiResponse> {
    return this.get(`/api/tools/category/${encodeURIComponent(category)}`);
  }

  async searchTools(query: string): Promise<ApiResponse> {
    return this.get(`/api/tools/search?q=${encodeURIComponent(query)}`);
  }

  async executeTool(toolId: string, params: ToolExecutionParams): Promise<ApiResponse> {
    return this.post(`/api/tools/${encodeURIComponent(toolId)}/execute`, params);
  }

  // Server Status API
  async getServerStatus(): Promise<ApiResponse> {
    return this.get('/api/status');
  }

  async getIntegrationStatus(): Promise<ApiResponse> {
    return this.get('/api/integration/status');
  }

  // WebSocket Methods
  connectWebSocket(callbacks: WebSocketCallbacks = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wsCallbacks = callbacks;
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          callbacks.onOpen?.();
          resolve();
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          callbacks.onClose?.();
          this.cleanupPendingRequests();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          callbacks.onError?.(error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleWebSocketMessage(message);
            callbacks.onMessage?.(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleWebSocketMessage(message: WebSocketMessage): void {
    const { id, result, error } = message;

    if (id && this.pendingRequests.has(id)) {
      const { resolve, reject, timeout } = this.pendingRequests.get(id)!;
      this.pendingRequests.delete(id);
      clearTimeout(timeout);

      if (error) {
        reject(new Error(error));
      } else {
        resolve(result);
      }
    }
  }

  private cleanupPendingRequests(): void {
    for (const [id, { reject, timeout }] of this.pendingRequests) {
      clearTimeout(timeout);
      reject(new Error('WebSocket disconnected'));
      this.pendingRequests.delete(id);
    }
  }

  async callWebSocketMethod(method: string, params?: any, timeout = 30000): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const id = `msg_${++this.messageId}`;
    const message: WebSocketMessage = { id, method, params };

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('WebSocket request timeout'));
      }, timeout);

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      this.ws!.send(JSON.stringify(message));
    });
  }

  // WebSocket RPC Methods
  async wsExecuteTool(toolId: string, params: ToolExecutionParams): Promise<any> {
    return this.callWebSocketMethod('tools.execute', { toolId, params });
  }

  async wsGetAllTools(): Promise<any> {
    return this.callWebSocketMethod('tools.list');
  }

  async wsSearchTools(query: string): Promise<any> {
    return this.callWebSocketMethod('tools.search', { query });
  }

  async wsGetToolsByCategory(category: string): Promise<any> {
    return this.callWebSocketMethod('tools.category', { category });
  }

  async wsGetIntegrationStatus(): Promise<any> {
    return this.callWebSocketMethod('integration.status');
  }

  async wsRegisterRoutes(routes: any[]): Promise<any> {
    return this.callWebSocketMethod('integration.register.routes', { routes });
  }

  async wsRegisterWsHandlers(handlers: any[]): Promise<any> {
    return this.callWebSocketMethod('integration.register.ws_handlers', { handlers });
  }

  // Connection Status
  get isWebSocketConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get connectionStatus(): string {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'unknown';
    }
  }
}

// Create singleton instance
const apiClient = new ApiClient();

export default apiClient;