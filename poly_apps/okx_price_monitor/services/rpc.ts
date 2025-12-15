import { RPCResponse, CoinSummary, Alert, SystemConfig, SystemStats } from '../types';

// Use relative path - Vite proxy will forward /rpc to backend (58888)
// In dev mode: /rpc -> http://localhost:58888/rpc (via Vite proxy)
// In production: /rpc -> same origin (static files served by backend)
const API_BASE = '/rpc';

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
    case 'monitor.stats':
      return {
        total_coins: 297,
        total_records: 1542031,
        update_rate: '5s',
        last_update: Date.now() / 1000
      } as SystemStats;
    
    case 'monitor.all_summaries':
      return {
        count: params.limit || 297,
        summaries: generateMockSummaries(params.limit || 297)
      };

    case 'monitor.alerts':
      return {
        count: 4,
        alerts: generateMockAlerts()
      };

    case 'monitor.config':
      return {
        update_interval_ms: 5000,
        alert_thresholds: { change_1m: 0.5, change_5m: 1.2 },
        max_coins: 297
      } as SystemConfig;

    case 'monitor.update_config':
      return { updated: Object.keys(params.updates || {}) };

    case 'monitor.start':
    case 'monitor.stop':
      return { status: 'ok' };

    default:
      throw new Error(`Unknown mock method: ${method}`);
  }
};

export class RPCClient {
  static async call<T>(method: string, params: Record<string, any> = {}): Promise<T> {
    const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const body = {
      route: method,
      params,
      id
    };

    try {
      const response = await fetch(`${API_BASE}/${method}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const json: RPCResponse<T> = await response.json();

      if (!json.success || !json.result?.success) {
        throw new Error(json.error || 'Unknown RPC error');
      }

      return json.result.data;
    } catch (error) {
      console.warn(`RPC connection failed for ${method}, falling back to simulation data.`);
      // Fallback to mock data for simulation/demo purposes
      return handleMockCall(method, params) as Promise<T>;
    }
  }

  // Convenience methods matching the API spec
  static async getStats() {
    return this.call<{
      total_coins: number;
      total_records: number;
      update_rate: string;
      last_update: number;
    }>('monitor.stats');
  }

  static async getAllSummaries(limit: number = 297) {
    return this.call<{ count: number; summaries: CoinSummary[] }>('monitor.all_summaries', { limit });
  }

  static async getAlerts() {
    return this.call<{ count: number; alerts: Alert[] }>('monitor.alerts');
  }

  static async getConfig() {
    return this.call<SystemConfig>('monitor.config');
  }

  static async updateConfig(updates: Record<string, any>) {
    return this.call<{ updated: string[] }>('monitor.update_config', { updates });
  }

  static async startMonitor() {
    return this.call('monitor.start');
  }

  static async stopMonitor() {
    return this.call('monitor.stop');
  }
}