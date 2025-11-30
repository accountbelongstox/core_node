/**
 * Unified HTTP/WebSocket Client
 *
 * Features:
 * - Middleware support for request/response interception
 * - Automatic health check and failover
 * - Request queue with retry for failed requests
 * - CSRF token management
 * - WebSocket support
 */

import { apiEndpointsHelper } from './api-endpoints-helper';

export interface HttpClientConfig {
  timeout?: number;
  retryDelay?: number;
  maxRetries?: number;
  enableQueue?: boolean;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: HeadersInit;
  body?: any;
  skipCsrf?: boolean;
  skipQueue?: boolean;
}

export interface Middleware {
  name: string;
  onRequest?: (url: string, options: RequestOptions) => Promise<RequestOptions> | RequestOptions;
  onResponse?: (response: Response) => Promise<Response> | Response;
  onError?: (error: Error) => Promise<Error> | Error;
}

interface QueuedRequest {
  url: string;
  options: RequestOptions;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retries: number;
  timestamp: number;
}

class HttpClient {
  private static instance: HttpClient;
  private middlewares: Middleware[] = [];
  private requestQueue: QueuedRequest[] = [];
  private csrfToken: string | null = null;
  private isProcessingQueue = false;
  private config: Required<HttpClientConfig>;
  private ws: WebSocket | null = null;

  private constructor(config: HttpClientConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 30000,
      retryDelay: config.retryDelay ?? 2000,
      maxRetries: config.maxRetries ?? 3,
      enableQueue: config.enableQueue ?? true
    };

    this.initCsrfToken();
  }

  static getInstance(config?: HttpClientConfig): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient(config);
    }
    return HttpClient.instance;
  }

  /**
   * Add middleware
   */
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Remove middleware
   */
  removeMiddleware(name: string): void {
    this.middlewares = this.middlewares.filter(m => m.name !== name);
  }

  /**
   * Initialize CSRF token from meta tag or API
   */
  private async initCsrfToken(): Promise<void> {
    if (typeof window === 'undefined') return;

    // Try to get CSRF from meta tag
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) {
      this.csrfToken = metaTag.getAttribute('content');
      return;
    }

    // Try to get from API
    try {
      const baseUrl = apiEndpointsHelper.getActiveBaseUrl();
      if (baseUrl) {
        const response = await fetch(`${baseUrl}/api/csrf-token`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          this.csrfToken = data.token;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch CSRF token:', error);
    }
  }

  /**
   * Get CSRF token
   */
  getCsrfToken(): string | null {
    return this.csrfToken;
  }

  /**
   * Set CSRF token manually
   */
  setCsrfToken(token: string): void {
    this.csrfToken = token;
  }

  /**
   * Apply middleware chain to request
   */
  private async applyRequestMiddleware(url: string, options: RequestOptions): Promise<RequestOptions> {
    let processedOptions = { ...options };

    for (const middleware of this.middlewares) {
      if (middleware.onRequest) {
        processedOptions = await middleware.onRequest(url, processedOptions);
      }
    }

    return processedOptions;
  }

  /**
   * Apply middleware chain to response
   */
  private async applyResponseMiddleware(response: Response): Promise<Response> {
    let processedResponse = response;

    for (const middleware of this.middlewares) {
      if (middleware.onResponse) {
        processedResponse = await middleware.onResponse(processedResponse);
      }
    }

    return processedResponse;
  }

  /**
   * Apply middleware chain to error
   */
  private async applyErrorMiddleware(error: Error): Promise<Error> {
    let processedError = error;

    for (const middleware of this.middlewares) {
      if (middleware.onError) {
        processedError = await middleware.onError(processedError);
      }
    }

    return processedError;
  }

  /**
   * Check if API endpoint is healthy
   */
  private async isHealthy(): Promise<boolean> {
    const baseUrl = apiEndpointsHelper.getActiveBaseUrl();
    if (!baseUrl) return false;

    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Add request to queue
   */
  private queueRequest(url: string, options: RequestOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        url,
        options,
        resolve,
        reject,
        retries: 0,
        timestamp: Date.now()
      });

      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const healthy = await this.isHealthy();
      if (!healthy) {
        console.log('[HttpClient] API unhealthy, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        continue;
      }

      const request = this.requestQueue.shift();
      if (!request) break;

      try {
        const result = await this.executeRequest(request.url, request.options);
        request.resolve(result);
      } catch (error) {
        request.retries++;

        if (request.retries < this.config.maxRetries) {
          console.log(`[HttpClient] Retry ${request.retries}/${this.config.maxRetries} for ${request.url}`);
          this.requestQueue.push(request);
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        } else {
          request.reject(error);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute HTTP request
   */
  private async executeRequest(url: string, options: RequestOptions): Promise<any> {
    const baseUrl = apiEndpointsHelper.getActiveBaseUrl();
    if (!baseUrl) {
      throw new Error('No active API endpoint available');
    }

    // Build full URL
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

    // Prepare options
    let processedOptions = await this.applyRequestMiddleware(fullUrl, options);

    // Add CSRF token for non-GET requests
    if (!processedOptions.skipCsrf && processedOptions.method !== 'GET' && this.csrfToken) {
      processedOptions.headers = {
        ...processedOptions.headers,
        'X-CSRF-Token': this.csrfToken
      };
    }

    // Add default headers
    processedOptions.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...processedOptions.headers
    };

    // Convert body to JSON if needed
    if (processedOptions.body && typeof processedOptions.body !== 'string') {
      processedOptions.body = JSON.stringify(processedOptions.body);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(fullUrl, {
        method: processedOptions.method || 'GET',
        headers: processedOptions.headers,
        body: processedOptions.body,
        signal: controller.signal,
        credentials: 'include'
      });

      clearTimeout(timeoutId);

      const processedResponse = await this.applyResponseMiddleware(response);

      if (!processedResponse.ok) {
        throw new Error(`HTTP ${processedResponse.status}: ${processedResponse.statusText}`);
      }

      return await processedResponse.json();
    } catch (error) {
      const processedError = await this.applyErrorMiddleware(error as Error);
      throw processedError;
    }
  }

  /**
   * Make HTTP request (with queue support)
   */
  async request(url: string, options: RequestOptions = {}): Promise<any> {
    const shouldQueue = this.config.enableQueue &&
                       options.method === 'POST' &&
                       !options.skipQueue &&
                       !(await this.isHealthy());

    if (shouldQueue) {
      return this.queueRequest(url, options);
    }

    return this.executeRequest(url, options);
  }

  /**
   * GET request
   */
  async get(url: string, options: RequestOptions = {}): Promise<any> {
    return this.request(url, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post(url: string, body?: any, options: RequestOptions = {}): Promise<any> {
    return this.request(url, { ...options, method: 'POST', body });
  }

  /**
   * PUT request
   */
  async put(url: string, body?: any, options: RequestOptions = {}): Promise<any> {
    return this.request(url, { ...options, method: 'PUT', body });
  }

  /**
   * DELETE request
   */
  async delete(url: string, options: RequestOptions = {}): Promise<any> {
    return this.request(url, { ...options, method: 'DELETE' });
  }

  /**
   * PATCH request
   */
  async patch(url: string, body?: any, options: RequestOptions = {}): Promise<any> {
    return this.request(url, { ...options, method: 'PATCH', body });
  }

  /**
   * Connect WebSocket
   */
  connectWebSocket(path: string, callbacks: {
    onOpen?: () => void;
    onMessage?: (data: any) => void;
    onError?: (error: Event) => void;
    onClose?: () => void;
  } = {}): void {
    const endpoint = apiEndpointsHelper.getActiveEndpoint();
    if (!endpoint) {
      throw new Error('No active API endpoint available');
    }

    const wsProtocol = endpoint.protocol === 'https' ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${endpoint.url}${endpoint.port ? `:${endpoint.port}` : ''}${path}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[HttpClient] WebSocket connected');
      callbacks.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callbacks.onMessage?.(data);
      } catch {
        callbacks.onMessage?.(event.data);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[HttpClient] WebSocket error:', error);
      callbacks.onError?.(error);
    };

    this.ws.onclose = () => {
      console.log('[HttpClient] WebSocket closed');
      callbacks.onClose?.();
      this.ws = null;
    };
  }

  /**
   * Send WebSocket message
   */
  sendWebSocket(data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const message = typeof data === 'string' ? data : JSON.stringify(data);
    this.ws.send(message);
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Get WebSocket connection status
   */
  get isWebSocketConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const httpClient = HttpClient.getInstance();

// Export class for creating custom instances if needed
export default HttpClient;
