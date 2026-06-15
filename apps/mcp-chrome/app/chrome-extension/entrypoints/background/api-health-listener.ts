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
export function initApiHealthListener() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'api_health_check') return;

    const base = String(message.url || '').trim().replace(/\/+$/, '');
    const timeoutMs = Number(message.timeoutMs) > 0 ? Number(message.timeoutMs) : 3000;

    (async () => {
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        // Real read (CORS bypassed in the background). /api/health is tiny JSON.
        const res = await fetch(`${base}/api/health`, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        });
        const responseTime = Date.now() - started;
        sendResponse({
          ok: true,
          reachable: true,
          healthy: res.ok, // a real 2xx from /api/health => the API truly works
          status: res.status,
          responseTime,
        });
      } catch (error: any) {
        sendResponse({
          ok: false,
          reachable: false,
          healthy: false,
          error: error?.message || 'unreachable',
          responseTime: Date.now() - started,
        });
      } finally {
        clearTimeout(timer);
      }
    })();

    return true; // async sendResponse
  });

  console.log('[API Health Listener] Initialized');
}
