/**
 * Reconnecting JSON WebSocket: jittered backoff, application heartbeat,
 * handshake timeout, and immediate retry when the network or tab wakes.
 */
import { WEBSOCKET_TIMINGS } from '../../config/NetworkTiming';

const CLOSE_NORMAL = 1000;
const CLOSE_CLIENT_RESTART = 4000;
const CLOSE_HEARTBEAT_TIMEOUT = 4001;
const CLOSE_OPEN_TIMEOUT = 4002;

export type WsConnectionState = 'idle' | 'connecting' | 'open' | 'closed';
export type WsFrame = Record<string, unknown>;
type StateListener = (state: WsConnectionState) => void;

export interface ReconnectingWebSocketOptions {
  /** Resolved before every attempt so cursors and targets stay current. */
  resolveUrl: () => Promise<string>;
  /** Runs once per opened socket, before any other frame is sent. */
  onOpen: (socket: ReconnectingWebSocket) => void;
  onFrame: (frame: WsFrame) => void;
  /** Heartbeat request; any inbound frame proves the peer is alive. */
  pingFrame: () => WsFrame;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  openTimeoutMs?: number;
  reconnectMinMs?: number;
  reconnectMaxMs?: number;
}

export class ReconnectingWebSocket {
  private readonly options: Required<ReconnectingWebSocketOptions>;
  private readonly stateListeners = new Set<StateListener>();
  private socket: WebSocket | null = null;
  private state: WsConnectionState = 'idle';
  private running = false;
  private backoffStep = 0;
  private failuresSinceOpen = 0;
  private lastInboundAt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private livenessTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ReconnectingWebSocketOptions) {
    this.options = {
      heartbeatIntervalMs: WEBSOCKET_TIMINGS.heartbeatIntervalMs,
      heartbeatTimeoutMs: WEBSOCKET_TIMINGS.heartbeatTimeoutMs,
      openTimeoutMs: WEBSOCKET_TIMINGS.openTimeoutMs,
      reconnectMinMs: WEBSOCKET_TIMINGS.reconnectMinMs,
      reconnectMaxMs: WEBSOCKET_TIMINGS.reconnectMaxMs,
      ...options,
    };
  }

  static isSupported(): boolean {
    return typeof WebSocket !== 'undefined';
  }

  get connectionState(): WsConnectionState {
    return this.state;
  }

  /** Attempts that closed without ever opening since the last open socket. */
  get consecutiveFailures(): number {
    return this.failuresSinceOpen;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.addWakeListeners();
    void this.connect();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.removeWakeListeners();
    this.clearReconnectTimer();
    this.teardownSocket(CLOSE_NORMAL);
    this.setState('idle');
  }

  /** Drop the current socket and connect again without backoff. */
  reconnectNow(): void {
    if (!this.running) return;
    this.teardownSocket(CLOSE_CLIENT_RESTART);
    this.backoffStep = 0;
    this.setState('closed');
    this.clearReconnectTimer();
    this.scheduleReconnect(0);
  }

  send(frame: WsFrame): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(frame));
    return true;
  }

  onState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => { this.stateListeners.delete(listener); };
  }

  private async connect(): Promise<void> {
    if (!this.running || this.socket) return;
    this.setState('connecting');
    let socket: WebSocket;
    try {
      const url = await this.options.resolveUrl();
      if (!this.running || this.socket) return;
      socket = new WebSocket(url);
    } catch {
      this.handleClosed(false);
      return;
    }
    this.socket = socket;
    this.openTimer = setTimeout(() => this.closeSocket(socket, CLOSE_OPEN_TIMEOUT), this.options.openTimeoutMs);
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.clearOpenTimer();
      this.backoffStep = 0;
      this.failuresSinceOpen = 0;
      this.lastInboundAt = Date.now();
      this.setState('open');
      this.options.onOpen(this);
      this.startHeartbeat();
    };
    socket.onmessage = (event: MessageEvent) => {
      if (this.socket !== socket) return;
      this.lastInboundAt = Date.now();
      const frame = parseFrame(event.data);
      if (frame) this.options.onFrame(frame);
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      const wasOpen = this.state === 'open';
      this.socket = null;
      this.handleClosed(wasOpen);
    };
  }

  private handleClosed(wasOpen: boolean): void {
    this.stopHeartbeat();
    this.clearOpenTimer();
    if (!wasOpen) this.failuresSinceOpen += 1;
    this.setState('closed');
    this.scheduleReconnect();
  }

  private scheduleReconnect(delayMs: number = this.nextBackoffMs()): void {
    if (!this.running || this.reconnectTimer !== null) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delayMs);
  }

  private nextBackoffMs(): number {
    const { reconnectMinMs, reconnectMaxMs } = this.options;
    const step = Math.min(reconnectMaxMs, reconnectMinMs * 2 ** this.backoffStep);
    if (step < reconnectMaxMs) this.backoffStep += 1;
    return step / 2 + Math.random() * (step / 2);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => this.beat(), this.options.heartbeatIntervalMs);
  }

  private beat(): void {
    const socket = this.socket;
    if (!socket || !this.send(this.options.pingFrame())) return;
    const sentAt = Date.now();
    if (this.livenessTimer !== null) clearTimeout(this.livenessTimer);
    this.livenessTimer = setTimeout(() => {
      this.livenessTimer = null;
      if (this.socket === socket && this.lastInboundAt < sentAt) this.closeSocket(socket, CLOSE_HEARTBEAT_TIMEOUT);
    }, this.options.heartbeatTimeoutMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) clearInterval(this.heartbeatTimer);
    if (this.livenessTimer !== null) clearTimeout(this.livenessTimer);
    this.heartbeatTimer = null;
    this.livenessTimer = null;
  }

  private closeSocket(socket: WebSocket, code: number): void {
    if (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) return;
    socket.close(code);
  }

  private teardownSocket(code: number): void {
    const socket = this.socket;
    this.socket = null;
    this.stopHeartbeat();
    this.clearOpenTimer();
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    this.closeSocket(socket, code);
  }

  private clearOpenTimer(): void {
    if (this.openTimer !== null) clearTimeout(this.openTimer);
    this.openTimer = null;
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private setState(state: WsConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state));
  }

  private readonly wake = (): void => {
    if (!this.running) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (this.state === 'open') {
      this.beat();
      return;
    }
    if (this.state === 'connecting') return;
    this.backoffStep = 0;
    this.clearReconnectTimer();
    this.scheduleReconnect(0);
  };

  private addWakeListeners(): void {
    if (typeof window !== 'undefined') window.addEventListener('online', this.wake);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.wake);
  }

  private removeWakeListeners(): void {
    if (typeof window !== 'undefined') window.removeEventListener('online', this.wake);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.wake);
  }
}

function parseFrame(data: unknown): WsFrame | null {
  if (typeof data !== 'string') return null;
  try {
    const frame: unknown = JSON.parse(data);
    return frame && typeof frame === 'object' && !Array.isArray(frame) ? frame as WsFrame : null;
  } catch {
    return null;
  }
}
