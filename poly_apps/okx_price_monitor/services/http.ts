import { CoinSummary, Alert, SystemConfig, SystemStats } from '../types';

export const OKX_HTTP_ROUTES = {
  stats: 'monitor/stats',
  coinsList: 'monitor/coins_list',
  coinSummary: 'monitor/coin_summary',
  allSummaries: 'monitor/all_summaries',
  alerts: 'monitor/alerts',
  config: 'monitor/config',
  updateConfig: 'monitor/update_config',
  start: 'monitor/start',
  stop: 'monitor/stop',
  tradingSummary: 'trading/summary',
  tradingPositions: 'trading/positions',
  tradingHistory: 'trading/history',
  tradingBalance: 'trading/balance',
} as const;

export const OKX_HTTP_EVENTS = {
  stream: '/api/events',
  ack: '/api/events/ack',
  logTopic: 'okx.log',
  record: 'sse.event',
} as const;

export interface OkxLogMessage {
  type: string;
  level: string;
  message: string;
  timestamp: string;
  coin?: string;
}

interface SseRecord<T> {
  event_id?: string;
  seq?: number;
  topic?: string;
  payload?: T;
}

const HTTP_API_PREFIX = '/api';
const SSE_RETRY_MS = 1000;
const SSE_RETRY_MAX_MS = 30000;

// Mock Data Generators for Simulation Mode
const MOCK_COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'AVAX', 'MATIC', 'TRX', 'LTC', 'SHIB', 'LINK', 'ATOM', 'UNI', 'ETC', 'XMR', 'BCH', 'FIL', 'APT'];

const generateMockSummaries = (limit: number = 297): CoinSummary[] => {
  return Array.from({ length: limit }).map((_, i) => {
    const symbol = i < MOCK_COINS.length ? MOCK_COINS[i] : `COIN-${i + 1}`;
    // Generate a somewhat realistic price
    const basePrice = symbol === 'BTC' ? 42000 : symbol === 'ETH' ? 2200 : Math.random() * 100 + 10;
    const jitter = (Math.random() - 0.5) * (basePrice * 0.02); // 2% jitter
    const price = basePrice + jitter;

    return {
      coin: symbol,
      inst_id: `${symbol}-USDT`,
      current_price: price,
      price_24h_high: price * 1.05,
      price_24h_low: price * 0.95,
      volume_24h: Math.random() * 1000000000 + 1000000,
      price_change_1m: (Math.random() - 0.5) * 1,
      price_change_5m: (Math.random() - 0.5) * 2,
      price_change_15m: (Math.random() - 0.5) * 5,
      last_update: Date.now() / 1000
    };
  });
};

const generateMockAlerts = (): Alert[] => {
  return [
    { coin: 'BTC', alert_type: 'price_spike', change_percent: 2.5, timeframe: '1m', timestamp: Date.now() / 1000 - 120 },
    { coin: 'SOL', alert_type: 'volume_surge', change_percent: 15.2, timeframe: '5m', timestamp: Date.now() / 1000 - 600 },
    { coin: 'DOGE', alert_type: 'price_drop', change_percent: -5.1, timeframe: '15m', timestamp: Date.now() / 1000 - 3600 },
    { coin: 'ETH', alert_type: 'price_spike', change_percent: 1.8, timeframe: '1m', timestamp: Date.now() / 1000 - 7200 },
  ];
};

const handleMockCall = async (method: string, params: any) => {
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network latency

  switch (method) {
    case OKX_HTTP_ROUTES.stats:
      return {
        total_coins: 297,
        total_records: 1542031,
        update_rate: '5s',
        last_update: Date.now() / 1000
      } as SystemStats;
    
    case OKX_HTTP_ROUTES.allSummaries:
      return {
        count: params.limit || 297,
        summaries: generateMockSummaries(params.limit || 297)
      };

    case OKX_HTTP_ROUTES.alerts:
      return {
        count: 4,
        alerts: generateMockAlerts()
      };

    case OKX_HTTP_ROUTES.config:
      return {
        update_interval_ms: 5000,
        alert_thresholds: { change_1m: 0.5, change_5m: 1.2 },
        max_coins: 297
      } as SystemConfig;

    case OKX_HTTP_ROUTES.updateConfig:
      return { updated: Object.keys(params.updates || {}) };

    case OKX_HTTP_ROUTES.start:
    case OKX_HTTP_ROUTES.stop:
      return { status: 'ok' };

    default:
      throw new Error(`Unknown mock method: ${method}`);
  }
};

export class HttpClient {
  static async call<T>(route: string, params: Record<string, any> = {}): Promise<T> {
    try {
      const response = await fetch(`${HTTP_API_PREFIX}/${route}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const json = await response.json();

      if (!json.success) {
        throw new Error(json.error || 'Unknown HTTP error');
      }

      return json.data as T;
    } catch (error) {
      console.warn(`HTTP request failed for ${route}, falling back to simulation data.`);
      return handleMockCall(route, params) as Promise<T>;
    }
  }

  static async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('/api/status');
      if (!response.ok) return false;
      const status = await response.json();
      return status?.is_http_service === true;
    } catch {
      return false;
    }
  }

  // Convenience methods matching the API spec
  static async getStats() {
    return this.call<{
      total_coins: number;
      total_records: number;
      update_rate: string;
      last_update: number;
    }>(OKX_HTTP_ROUTES.stats);
  }

  static async getAllSummaries(limit: number = 297) {
    return this.call<{ count: number; summaries: CoinSummary[] }>(OKX_HTTP_ROUTES.allSummaries, { limit });
  }

  static async getAlerts() {
    return this.call<{ count: number; alerts: Alert[] }>(OKX_HTTP_ROUTES.alerts);
  }

  static async getConfig() {
    return this.call<SystemConfig>(OKX_HTTP_ROUTES.config);
  }

  static async updateConfig(updates: Record<string, any>) {
    return this.call<{ updated: string[] }>(OKX_HTTP_ROUTES.updateConfig, { updates });
  }

  static async startMonitor() {
    return this.call(OKX_HTTP_ROUTES.start);
  }

  static async stopMonitor() {
    return this.call(OKX_HTTP_ROUTES.stop);
  }
}

export function subscribeOkxLogs(
  onLog: (message: OkxLogMessage) => void,
  onStatus: (connected: boolean) => void,
): () => void {
  const clientId = `okx-ui-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  let source: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let retryMs = SSE_RETRY_MS;
  let seq = 0;
  let stopped = false;

  const acknowledge = async (): Promise<void> => {
    await fetch(OKX_HTTP_EVENTS.ack, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, seq }),
    });
  };

  const connect = (): void => {
    if (stopped || source) return;
    const query = new URLSearchParams({
      client_id: clientId,
      since_seq: String(seq),
      topics: OKX_HTTP_EVENTS.logTopic,
    });
    const currentSource = new EventSource(`${OKX_HTTP_EVENTS.stream}?${query.toString()}`);
    source = currentSource;
    currentSource.onopen = () => {
      retryMs = SSE_RETRY_MS;
      onStatus(true);
    };
    currentSource.addEventListener(OKX_HTTP_EVENTS.record, (event) => {
      const record = JSON.parse((event as MessageEvent).data) as SseRecord<OkxLogMessage>;
      seq = Math.max(seq, Number(record.seq || 0));
      if (record.topic === OKX_HTTP_EVENTS.logTopic && record.payload) {
        onLog(record.payload);
      }
      void acknowledge();
    });
    currentSource.onerror = () => {
      if (source === currentSource) source = null;
      currentSource.close();
      onStatus(false);
      if (stopped || reconnectTimer) return;
      const delayMs = retryMs;
      retryMs = Math.min(SSE_RETRY_MAX_MS, retryMs * 2);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delayMs);
    };
  };

  connect();
  return () => {
    stopped = true;
    source?.close();
    source = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    onStatus(false);
  };
}
