import path from 'path';
import { WebSocketServer } from 'ws';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Single config source — fixed ports live in config/constants.ts (no env vars).
import { DEFAULT_FRONTEND_PORT, PYCORE_DEV_PROXY_TARGET, PYCORE_SANDBOX_MOCK } from './config/constants';

// Unified shell: this single Vite app hosts three ends (laravel-manager,
// pycore-manager, wordflow). Each end keeps its own API library; the pycore end
// historically talked to a Node `/pyapi` reverse proxy, so in dev we recreate
// that proxy here straight to the pycore backend (:59000). WordFlow was a
// Capacitor app, so its `@capacitor/*` imports are aliased to web shims.
//
// NO environment variables / baked-in constants: the frontend never carries
// build-time config. All ports are FIXED and known (FE :13054, API :9000,
// pycore RPC :59000); runtime config that pycore controls (e.g. language) is
// passed to the app via URL parameters, not env vars.
export default defineConfig(() => {
    // pycore backend base for the dev `/pyapi` reverse proxy (fixed RPC port,
    // sourced from the single config file — never an env var).
    const pycoreApiBase = PYCORE_DEV_PROXY_TARGET;

    const capacitorShim = (name: string) =>
      path.resolve(__dirname, 'shared/capacitor-web-shims', name + '.ts');

    return {
      server: {
        // Canonical pycore UI port (matches pyservice $UiPort / UI_PORT default,
        // callmodule/config.py + capabilities.py, and start_dashboard.ps1).
        // pyservice passes `--port` on the CLI when it needs a different one (the
        // CLI flag overrides this default) — so we keep a fixed default here
        // rather than reading an environment variable.
        port: DEFAULT_FRONTEND_PORT,
        host: '0.0.0.0',
        proxy: {
          // pycore-manager end: mirror the desktop-manager Node bridge so the
          // ported pycore API library's `/pyapi/*` paths reach the backend in dev.
          '/pyapi': {
            target: pycoreApiBase,
            changeOrigin: true,
            ws: true,
            rewrite: (p) => p.replace(/^\/pyapi/, ''),
            // When pycore is not reachable (still starting, or simply not running),
            // return a clean JSON instead of a raw 502 so the UI shows a friendly
            // message. If you want the UI to work fully offline, flip
            // PYCORE_SANDBOX_MOCK=true (config/constants.ts) to use mock data.
            configure: (proxy) => {
              proxy.on('error', (_err, _req, res) => {
                const r = res as import('http').ServerResponse;
                if (r && 'writeHead' in r && !r.headersSent) {
                  r.writeHead(503, { 'Content-Type': 'application/json' });
                  r.end(JSON.stringify({
                    success: false,
                    error: 'Pycore backend offline (start pycore on :59000, or set '
                      + 'PYCORE_SANDBOX_MOCK=true in config/constants.ts for mock data)',
                  }));
                }
              });
            },
          },
        },
      },
      plugins: [
        react(),
        tailwindcss(),
        {
          name: 'pyapi-sandbox-mock-server',
          configureServer(server) {
            // DATA SOURCE SWITCH (see PYCORE_SANDBOX_MOCK in config/constants.ts):
            //   default false -> REAL pycore: every /pyapi/* (incl. /pyapi/rpc/ws)
            //     is proxied to :59000; the pycore mocks below are skipped.
            //   true -> MOCK: the sandbox WS + HTTP mocks answer /pyapi/* so the UI
            //     works with NO pycore backend. Mock code is kept here on purpose.
            // (The /api laravel mock further below is independent of this switch.)

            // Setup WebSocket Mock Server inside Vite Dev Server for Sandbox.
            // Only when mocking — otherwise the /pyapi proxy (ws:true) reaches the
            // real pycore RPC WebSocket on :59000.
            if (PYCORE_SANDBOX_MOCK) {
              const wss = new WebSocketServer({ noServer: true });
              server.httpServer?.on('upgrade', (req, socket, head) => {
                const url = req.url || '';
                if (url.includes('/pyapi/rpc/ws')) {
                  wss.handleUpgrade(req, socket, head, (ws) => {
                    wss.emit('connection', ws, req);
                  });
                }
              });

              wss.on('connection', (ws) => {
                ws.on('message', (message) => {
                  try {
                    const data = JSON.parse(message.toString());
                    if (data.type === 'request') {
                      let result: any = { success: true };
                      if (data.route === 'laravel_api.list') {
                        result = { endpoints: [] };
                      } else if (data.route === 'video_extract.backend_status') {
                        result = { status: 'idle' };
                      }
                      ws.send(JSON.stringify({ type: 'response', id: data.id, result, error: null }));
                    }
                  } catch (err) {
                    // Ignore
                  }
                });
              });
            }

            server.middlewares.use((req, res, next) => {
              const fullUrl = req.url || '';

              // INTERCEPT WORD FLOW & GENERAL API PATHS
              if (fullUrl.startsWith('/api')) {
                const pathName = fullUrl.split('?')[0];

                res.setHeader('Content-Type', 'application/json');

                if (pathName === '/api/health') {
                  res.end(JSON.stringify({ status: 'ok', service: 'laravel-mock' }));
                  return;
                }

                if (pathName === '/api/app_qy_v1/user/profile' || pathName === '/api/user/profile') {
                  res.end(JSON.stringify({
                    success: true,
                    user: {
                      id: "u1",
                      name: "Guest Admin",
                      email: "admin@example.com",
                      avatar_url: "https://i.pravatar.cc/150?u=admin",
                      role: "admin",
                      nickname: "Admin"
                    },
                    data: {
                      user: {
                        id: "u1",
                        name: "Guest Admin",
                        email: "admin@example.com",
                        avatar_url: "https://i.pravatar.cc/150?u=admin",
                        role: "admin",
                        nickname: "Admin"
                      }
                    }
                  }));
                  return;
                }

                if (pathName === '/api/app_qy_v1/group/list' || pathName === '/api/app_qy_v1/group/get_all' || pathName.includes('/group')) {
                  res.end(JSON.stringify({
                    success: true,
                    data: []
                  }));
                  return;
                }

                if (pathName.includes('/learning/collections') || pathName.includes('/collections')) {
                  res.end(JSON.stringify({
                    success: true,
                    data: []
                  }));
                  return;
                }

                if (pathName.includes('/login')) {
                  res.end(JSON.stringify({
                    success: true,
                    token: "mock-jwt-token-xyz-123",
                    user: {
                      id: "u1",
                      name: "Guest Admin",
                      email: "admin@example.com",
                      avatar_url: "https://i.pravatar.cc/150?u=admin"
                    }
                  }));
                  return;
                }

                res.end(JSON.stringify({
                  success: true,
                  data: []
                }));
                return;
              }

              // INTERCEPT PYAPI PATHS — only in MOCK mode. With PYCORE_SANDBOX_MOCK
              // false (default), fall through so the real /pyapi reverse proxy sends
              // these to the live pycore backend on :59000 (real reads AND writes,
              // e.g. CodeSync "Start distributing").
              if (fullUrl.startsWith('/pyapi') && PYCORE_SANDBOX_MOCK) {
                const parsedUrl = fullUrl.substring(6);
                const pathName = parsedUrl.split('?')[0];

                if (pathName === '/rpc/sse') {
                  res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                  });
                  res.write(`event: stream.open\ndata: {"seq": 1}\n\n`);
                  return;
                }

                res.setHeader('Content-Type', 'application/json');

                if (pathName === '/api/local/user-data/video-extract') {
                  res.end(JSON.stringify({
                    success: true,
                    base_dir: "",
                    entries: [],
                    last_options: { subtitle: true, model: "", formats: [], lang: "en" }
                  }));
                  return;
                }
                if (pathName === '/api/local/ocr/status') {
                  res.end(JSON.stringify({
                    success: true,
                    best: null,
                    available_count: 0,
                    engines: []
                  }));
                  return;
                }
                if (pathName === '/api/local/user-data/system-settings') {
                  res.end(JSON.stringify({
                    success: true,
                    settings: {}
                  }));
                  return;
                }
                if (pathName === '/api/local/ai/gateway') {
                  res.end(JSON.stringify({
                    success: true,
                    providers: [],
                    records: []
                  }));
                  return;
                }
                if (pathName === '/api/local/capabilities/status') {
                  res.end(JSON.stringify({
                    success: true,
                    cuda: {
                      available: false,
                      driver_version: null,
                      cuda_version: null,
                      gpu_count: 0,
                      gpus: [],
                      torch_installed: false,
                      onnxruntime_installed: false
                    },
                    libraries: []
                  }));
                  return;
                }
                if (pathName === '/ping') {
                  res.end(JSON.stringify({
                    success: true,
                    status: "ok"
                  }));
                  return;
                }
                if (pathName === '/api/local/tts/status') {
                  res.end(JSON.stringify({
                    success: true,
                    providers: [],
                    best: null,
                    active: null,
                    edge_cooldown_remaining: 0,
                    engines: []
                  }));
                  return;
                }
                if (pathName === '/voice-subtitle/queue') {
                  res.end(JSON.stringify({
                    success: true,
                    queue: [],
                    current_index: 0,
                    enabled: false
                  }));
                  return;
                }
                if (pathName === '/voice-subtitle/clipboard-monitor/status') {
                  res.end(JSON.stringify({
                    success: true,
                    enabled: false
                  }));
                  return;
                }
                if (pathName === '/voice-subtitle/screenshot-monitor/status') {
                  res.end(JSON.stringify({
                    success: true,
                    enabled: false,
                    interval: 10
                  }));
                  return;
                }
                if (pathName === '/api/local/video-extract/capabilities') {
                  res.end(JSON.stringify({
                    success: true,
                    models: [],
                    all_models: [],
                    installed_models: [],
                    default_model: "",
                    languages: [],
                    default_lang: "en",
                    ffmpeg_found: false
                  }));
                  return;
                }
                if (pathName === '/api/local/system/resources') {
                  res.end(JSON.stringify({
                    success: true,
                    cpu_percent: 0,
                    mem: { used_mb: 0, total_mb: 16384, percent: 0 },
                    gpus: []
                  }));
                  return;
                }
                if (pathName === '/api/local/books/state') {
                  res.end(JSON.stringify({
                    success: true,
                    sources: [],
                    last_options: {}
                  }));
                  return;
                }
                if (pathName === '/api/local/books/supported-formats') {
                  res.end(JSON.stringify({
                    success: true,
                    formats: ["pdf", "epub", "mobi", "txt"]
                  }));
                  return;
                }

                res.end(JSON.stringify({
                  success: false,
                  error: "Pycore backend offline in sandbox"
                }));
                return;
              }
              next();
            });
          }
        }
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          // WordFlow (qy_capacitor) was a Capacitor app. In this web shell its
          // native plugin imports resolve to thin web shims (localStorage /
          // window dialogs / no-ops). WordFlow's services already guard native
          // calls behind Capacitor.isNativePlatform(), which the shim reports false.
          '@capacitor/core': capacitorShim('core'),
          '@capacitor/preferences': capacitorShim('preferences'),
          '@capacitor/dialog': capacitorShim('dialog'),
          '@capacitor/toast': capacitorShim('toast'),
          '@capacitor/status-bar': capacitorShim('status-bar'),
          '@capacitor/keyboard': capacitorShim('keyboard'),
          '@capacitor/app': capacitorShim('app'),
        }
      }
    };
});
