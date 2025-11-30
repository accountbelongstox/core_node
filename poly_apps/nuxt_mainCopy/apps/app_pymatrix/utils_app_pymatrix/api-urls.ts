/**
 * API URL utilities for PyMatrix
 * Centralized URL construction for HTTP and WebSocket connections
 */

import PYMATRIX_CONFIG from '@/apps/app_pymatrix/config_app_pymatrix';

/**
 * Get base URLs from config
 * Uses PYMATRIX_CONFIG as the source of truth
 */
function getBaseUrls() {
  return {
    http: PYMATRIX_CONFIG.API_BASE_URL,
    ws: PYMATRIX_CONFIG.WS_BASE_URL,
  };
}

/**
 * Build HTTP API URL
 */
export function buildApiUrl(path: string): string {
  const { http } = getBaseUrls();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${http}${normalizedPath}`;
}

/**
 * Build WebSocket URL
 */
export function buildWsUrl(path: string): string {
  const { ws } = getBaseUrls();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${ws}${normalizedPath}`;
}

/**
 * Build control WebSocket URL
 * @param serial Device serial number
 * @param customBaseUrl Optional custom base URL (for backward compatibility with components passing baseUrl prop)
 */
export function buildControlWsUrl(serial: string, customBaseUrl?: string): string {
  if (customBaseUrl) {
    const base = customBaseUrl.replace(/\/$/, '');
    return `${base}/ws/control/${serial}`;
  }
  return buildWsUrl(`/ws/control/${serial}`);
}

/**
 * Build video stream WebSocket URL
 * @param serial Device serial number
 * @param options Video options and optional custom base URL
 */
export function buildVideoWsUrl(serial: string, options?: {
  quality?: string;
  fps?: number;
  bitrate?: number;
  baseUrl?: string;
}): string {
  let url = `/ws/video/${serial}`;

  if (options) {
    const params = new URLSearchParams();
    if (options.quality) params.append('quality', options.quality);
    if (options.fps) params.append('fps', options.fps.toString());
    if (options.bitrate) params.append('bitrate', options.bitrate.toString());

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    // Support custom baseUrl for backward compatibility
    if (options.baseUrl) {
      const base = options.baseUrl.replace(/\/$/, '');
      return `${base}${url}`;
    }
  }

  return buildWsUrl(url);
}

/**
 * Build devices list WebSocket URL
 */
export function buildDevicesWsUrl(): string {
  return buildWsUrl('/ws/devices');
}

/**
 * Build group WebSocket URL
 */
export function buildGroupWsUrl(): string {
  return buildWsUrl('/ws/group');
}

/**
 * Get HTTP base URL
 */
export function getHttpBaseUrl(): string {
  return getBaseUrls().http;
}

/**
 * Get WebSocket base URL
 */
export function getWsBaseUrl(): string {
  return getBaseUrls().ws;
}
