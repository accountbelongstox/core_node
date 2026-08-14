/**
 * API Health Check Listener (background service worker)
 *
 * The popup CANNOT do a meaningful cross-origin health check: a popup `fetch`
 * is subject to CORS, so ApiManager falls back to `mode: 'no-cors'`, which only
 * proves the host answered *something* (an opaque response) — not that the API
 * actually works. The background service worker, however, has host_permissions
 * for <all_urls>, so its fetches BYPASS CORS and can READ the real response.
 *
 * This listener performs that real check on the popup's behalf: it hits the
 * lightweight `/api/health` endpoint (laravel_main returns `{status:'healthy'}`),
 * reads the status, and reports whether the API is genuinely healthy.
 */
import { fetchWithTimeout } from '@/utils/async';
import { registerRuntimeMessageHandler, toErrorMessage } from '@/utils/runtime-message';

export function initApiHealthListener() {
  registerRuntimeMessageHandler('api_health_check', async (message: any) => {
    const base = String(message.url || '').trim().replace(/\/+$/, '');
    const timeoutMs = Number(message.timeoutMs) > 0 ? Number(message.timeoutMs) : 3000;
    const started = Date.now();
    try {
      const response = await fetchWithTimeout(`${base}/api/health`, timeoutMs, {
        method: 'GET',
        cache: 'no-store',
      });
      return {
        ok: true,
        reachable: true,
        healthy: response.ok,
        status: response.status,
        responseTime: Date.now() - started,
      };
    } catch (error) {
      return {
        ok: false,
        reachable: false,
        healthy: false,
        error: toErrorMessage(error) || 'unreachable',
        responseTime: Date.now() - started,
      };
    }
  });

  console.log('[API Health Listener] Initialized');
}
