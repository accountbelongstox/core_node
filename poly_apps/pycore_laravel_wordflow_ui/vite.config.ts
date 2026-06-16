import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Single config source — fixed ports live in config/constants.ts (no env vars).
import { DEFAULT_FRONTEND_PORT, PYCORE_DEV_PROXY_TARGET } from './config/constants';

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
            // Suppress ECONNREFUSED noise during startup (the Python worker takes
            // a few seconds to bind :59000 after Vite is already serving).
            configure: (proxy) => {
              proxy.on('error', (_err, _req, res) => {
                if (res && 'writeHead' in res && !res.headersSent) {
                  (res as import('http').ServerResponse).writeHead(502);
                  (res as import('http').ServerResponse).end();
                }
              });
            },
          },
        },
      },
      plugins: [react(), tailwindcss()],
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
