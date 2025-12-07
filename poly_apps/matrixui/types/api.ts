
// --- Common Data Structures ---

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  version: string;
  timestamp: string;
}

export interface APIInfo {
  message: string;
  version: string;
  description: string;
  protocol: string;
  endpoints: {
    websocket: string;
    documentation: string;
  };
  namespaces: string[];
}

export interface DeviceInfo {
  serial: string;
  status: 'device' | 'offline' | 'unauthorized';
  model: string;
  manufacturer: string | null;
  android_version: string | null;
}

export interface DeviceDetail {
  serial: string;
  model: string;
  manufacturer: string;
  android_version: string;
  sdk_version: string;
  resolution: {
    width: number;
    height: number;
  };
  dpi: number;
}

// --- WebSocket Messages ---

export interface WSRequest<T = any> {
  namespace: string;
  action: string;
  data: T;
  messageId?: string;
}

export interface WSResponse<T = any> {
  namespace: string;
  action: string;
  data: T | { error: WSError };
  messageId?: string;
}

export interface WSError {
  code: string;
  message: string;
}

// --- Payload Types ---

export interface DeviceConnectPayload {
  serial: string;
  max_size?: number;
  bit_rate?: number;
  max_fps?: number;
  codec?: string;
  control?: boolean;
  locked_video_orientation?: number;
  device_name?: string;
}

export interface DeviceActionPayload {
  serial: string;
}
