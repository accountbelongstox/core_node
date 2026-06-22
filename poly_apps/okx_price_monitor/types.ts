export interface RPCResponse<T> {
  success: boolean;
  result?: {
    success: boolean;
    data: T;
  };
  error?: string;
}

export interface CoinSummary {
  coin: string;
  inst_id?: string;
  current_price: number;
  price_24h_high: number;
  price_24h_low: number;
  volume_24h: number;
  price_change_1m: number;
  price_change_5m: number;
  price_change_15m: number;
  last_update?: number;
}

export interface CoinListResponse {
  total_coins: number;
  coins: CoinSummary[];
}

export interface SummaryResponse {
  count: number;
  summaries: CoinSummary[];
}

export interface Alert {
  coin: string;
  alert_type: string;
  change_percent: number;
  timeframe: string;
  timestamp: number;
}

export interface AlertsResponse {
  count: number;
  alerts: Alert[];
}

export interface SystemConfig {
  update_interval_ms: number;
  max_coins: number;
  alert_thresholds: Record<string, number>;
}

export interface SystemStats {
  total_coins: number;
  total_records: number;
  update_rate: string;
  last_update: number;
  db_size_mb?: number;
  uptime_seconds?: number;
}

export type PageRoute = 'monitor' | 'history' | 'alerts' | 'config' | 'stats';