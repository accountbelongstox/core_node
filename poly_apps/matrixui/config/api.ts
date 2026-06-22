/**
 * Centralized API Configuration
 * All backend URLs should be configured here to support different environments
 */

// Environment variables (from .env.local or .env.development)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:48000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:48000';

/**
 * API Configuration Constants
 *
 * Usage:
 * import { API_CONFIG } from '@/config/api';
 *
 * const ws = new WebSocket(API_CONFIG.WS_VIDEO_YUV_URL(deviceId, 'cuda'));
 */
export const API_CONFIG = {
  // HTTP API Base URL
  HTTP_BASE_URL: BACKEND_URL,

  // WebSocket RPC URL
  WS_RPC_URL: `${WS_URL}/rpc/ws`,

  // WebSocket Video URLs
  WS_VIDEO_YUV_URL: (deviceId: string, hwaccel?: string) => {
    const encodedId = encodeURIComponent(deviceId);
    let url = `${WS_URL}/video/yuv/${encodedId}`;
    if (hwaccel) {
      url += `?hwaccel=${hwaccel}`;
    }
    return url;
  },

  WS_VIDEO_H264_URL: (deviceId: string) => {
    const encodedId = encodeURIComponent(deviceId);
    return `${WS_URL}/video/${encodedId}`;
  },

  // HTTP API Endpoints
  ENDPOINTS: {
    HEALTH: `${BACKEND_URL}/health`,
    DEVICES: `${BACKEND_URL}/devices`,
    CONFIG: `${BACKEND_URL}/config`,
  },

  // Connection Settings
  CONNECTION: {
    TIMEOUT: 10000, // 10 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second
  },
} as const;

// Type-safe API configuration
export type ApiConfig = typeof API_CONFIG;

// Helper: Get backend URL (for debugging)
export const getBackendInfo = () => ({
  httpUrl: BACKEND_URL,
  wsUrl: WS_URL,
  source: import.meta.env.VITE_BACKEND_URL ? 'environment' : 'default'
});
