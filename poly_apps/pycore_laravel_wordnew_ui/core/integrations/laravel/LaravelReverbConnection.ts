/** Dependency-free Reverb/Pusher WebSocket transport shared by Laravel clients. */

export interface LaravelReverbConfig {
  app_key: string;
  host: string;
  port: number;
  scheme: string;
  channel: string;
}

export interface LaravelReverbAuthorization {
  auth: string;
  channel_data?: string;
  shared_secret?: string;
}

export interface LaravelReverbCallbacks {
  authorize?: (
    socketId: string,
    channel: string,
  ) => Promise<LaravelReverbAuthorization>;
  onSubscribed: () => void;
  onEvent: (event: string, data: unknown) => void;
  onClose: () => void;
}

interface PusherFrame {
  event: string;
  channel?: string;
  data?: unknown;
}

const PUSHER_PROTOCOL = 7;
const PUSHER_CLIENT_VERSION = '1.0';

export class LaravelReverbConnection {
  private socket: WebSocket | null = null;
  private connected = false;
  private generation = 0;

  connect(
    baseURL: string,
    config: LaravelReverbConfig,
    callbacks: LaravelReverbCallbacks,
    clientName: string,
  ): void {
    this.close();
    const generation = ++this.generation;
    const url = this.websocketUrl(baseURL, config, clientName);
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onmessage = (message) => {
      void this.handleMessage(socket, generation, config, callbacks, message.data)
        .catch(() => socket.close());
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (this.socket !== socket || this.generation !== generation) return;
      this.socket = null;
      this.connected = false;
      callbacks.onClose();
    };
  }

  close(): void {
    const socket = this.socket;
    this.generation += 1;
    this.socket = null;
    this.connected = false;
    if (socket) socket.close();
  }

  isConnected(): boolean {
    return this.connected;
  }

  private websocketUrl(
    baseURL: string,
    config: LaravelReverbConfig,
    clientName: string,
  ): string {
    const endpoint = new URL(baseURL);
    const configuredHost = String(config.host || '').trim();
    const host = !configuredHost || configuredHost === '0.0.0.0' || configuredHost === '::'
      ? endpoint.hostname
      : configuredHost;
    const secure = config.scheme === 'https' || endpoint.protocol === 'https:';
    const url = new URL(`${secure ? 'wss' : 'ws'}://${host}`);
    url.port = secure
      ? String(endpoint.port || 443)
      : String(config.port || 80);
    url.pathname = `/app/${encodeURIComponent(config.app_key)}`;
    url.searchParams.set('protocol', String(PUSHER_PROTOCOL));
    url.searchParams.set('client', clientName);
    url.searchParams.set('version', PUSHER_CLIENT_VERSION);
    url.searchParams.set('flash', 'false');
    return url.toString();
  }

  private parseObject(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object') return value as Record<string, unknown>;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }

  private parseFrame(value: unknown): PusherFrame | null {
    const parsed = this.parseObject(value);
    return parsed && typeof parsed.event === 'string' ? parsed as unknown as PusherFrame : null;
  }

  private async handleMessage(
    socket: WebSocket,
    generation: number,
    config: LaravelReverbConfig,
    callbacks: LaravelReverbCallbacks,
    value: unknown,
  ): Promise<void> {
    const frame = this.parseFrame(value);
    if (!frame || this.socket !== socket || this.generation !== generation) return;
    if (frame.event === 'pusher:connection_established') {
      const connection = this.parseObject(frame.data);
      const socketId = String(connection?.socket_id || '');
      const authorization = callbacks.authorize
        ? await callbacks.authorize(socketId, config.channel)
        : { auth: '' };
      if (this.socket !== socket || this.generation !== generation) return;
      socket.send(JSON.stringify({
        event: 'pusher:subscribe',
        data: { channel: config.channel, ...authorization },
      }));
      return;
    }
    if (frame.event === 'pusher:ping') {
      socket.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
      return;
    }
    if (frame.event === 'pusher_internal:subscription_succeeded') {
      this.connected = true;
      callbacks.onSubscribed();
      return;
    }
    if (frame.event.startsWith('pusher:') || frame.event.startsWith('pusher_internal:')) return;
    callbacks.onEvent(frame.event, frame.data);
  }
}
