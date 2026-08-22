/**
 * Shared authorized Mercure SSE transport for Laravel clients.
 *
 * The pinned hub uses repeated `topic` parameters and topic-scoped Mercure
 * selectors. Every connection obtains a fresh topic-scoped subscriber token
 * from Laravel and presents it as an Authorization Bearer header.
 */

import { protocolFetch } from '../../network/ProtocolFetch';

export interface LaravelMercureHubConfig {
  hub_url: string;
  topics: string[];
  subscribe_url?: string;
}

export interface LaravelMercureAuthorization {
  subscribe_url: string;
  token: string;
  token_ttl_seconds: number;
}

export interface LaravelMercureCallbacks {
  authorize: () => Promise<LaravelMercureAuthorization>;
  onSubscribed: () => void;
  onEvent: (event: string, data: unknown) => void;
  onClose: () => void;
}

export class LaravelMercureConnection {
  private controller: AbortController | null = null;
  private connected = false;
  private generation = 0;
  private lastEventId: string | null = null;

  connect(
    config: LaravelMercureHubConfig,
    callbacks: LaravelMercureCallbacks,
  ): void {
    this.close();
    const generation = ++this.generation;
    void this.open(generation, config, callbacks).catch(() => {
      if (this.generation !== generation) return;
      this.connected = false;
      this.controller = null;
      callbacks.onClose();
    });
  }

  close(): void {
    this.generation += 1;
    const controller = this.controller;
    this.controller = null;
    this.connected = false;
    controller?.abort();
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async open(
    generation: number,
    config: LaravelMercureHubConfig,
    callbacks: LaravelMercureCallbacks,
  ): Promise<void> {
    const authorization = await callbacks.authorize();
    if (this.generation !== generation) return;
    if (!authorization.token) throw new Error('MERCURE_SUBSCRIBER_TOKEN_UNAVAILABLE');
    const controller = new AbortController();
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${authorization.token}`,
      'Cache-Control': 'no-cache',
    };
    this.controller = controller;

    const response = await protocolFetch(this.resumeUrl(
      authorization.subscribe_url || config.subscribe_url || this.subscribeUrl(config),
    ), {
      credentials: 'omit',
      headers,
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`MERCURE_SUBSCRIPTION_HTTP_${response.status}`);
    }
    if (this.generation !== generation) return;
    this.connected = true;
    callbacks.onSubscribed();
    await this.consume(response.body, generation, callbacks);
    if (this.generation !== generation) return;
    this.connected = false;
    this.controller = null;
    callbacks.onClose();
  }

  private async consume(
    stream: ReadableStream<Uint8Array>,
    generation: number,
    callbacks: LaravelMercureCallbacks,
  ): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let dataLines: string[] = [];
    let eventType = 'message';
    let eventId: string | null = null;

    const dispatch = (): void => {
      if (dataLines.length > 0) {
        callbacks.onEvent(eventType, this.parseData(dataLines.join('\n')));
      }
      if (eventId !== null) this.lastEventId = eventId;
      dataLines = [];
      eventType = 'message';
      eventId = null;
    };

    const consumeLine = (rawLine: string): void => {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
      if (line === '') {
        dispatch();
        return;
      }
      if (line.startsWith(':')) return;
      const separator = line.indexOf(':');
      const field = separator < 0 ? line : line.slice(0, separator);
      let value = separator < 0 ? '' : line.slice(separator + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'data') dataLines.push(value);
      else if (field === 'event') eventType = value || 'message';
      else if (field === 'id' && !value.includes('\u0000')) eventId = value;
    };

    while (this.generation === generation) {
      const result = await reader.read();
      buffer += decoder.decode(result.value, { stream: !result.done });
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        consumeLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
      if (result.done) {
        if (buffer !== '') consumeLine(buffer);
        dispatch();
        return;
      }
    }
  }

  private subscribeUrl(config: LaravelMercureHubConfig): string {
    const url = new URL(config.hub_url);
    for (const topic of config.topics) url.searchParams.append('topic', topic);
    return url.toString();
  }

  private resumeUrl(value: string): string {
    if (!this.lastEventId) return value;
    const url = new URL(value);
    url.searchParams.set('lastEventID', this.lastEventId);
    return url.toString();
  }

  private parseData(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
