import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Unified shell: this single Vite app hosts three ends (laravel-manager,
// pycore-manager, wordflow). Each end keeps its own API library; the pycore end
// historically talked to a Node `/pyapi` reverse proxy, so in dev we recreate
// that proxy here straight to the pycore backend (:59000). WordFlow was a
// Capacitor app, so its `@capacitor/*` imports are aliased to web shims.
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    // pycore backend base for the dev `/pyapi` reverse proxy. Override with
    // PYCORE_API_BASE when the backend runs on another host/port.
    const pycoreApiBase = process.env.PYCORE_API_BASE || 'http://localhost:59000';

    const capacitorShim = (name: string) =>
      path.resolve(__dirname, 'shared/capacitor-web-shims', name + '.ts');

    return {
      server: {
        // Canonical pycore UI port (matches pyservice $UiPort / UI_PORT default,
        // callmodule/config.py + capabilities.py, and start_dashboard.ps1). pyservice
        // passes --port anyway; this default keeps a standalone `pnpm dev` /
        // start_dashboard.ps1 on the SAME port as pyservice.
        port: parseInt(process.env.PORT || process.env.VITE_PORT || "13054"),
        host: '0.0.0.0',
        proxy: {
          // pycore-manager end: mirror the desktop-manager Node bridge so the
          // ported pycore API library's `/pyapi/*` paths reach the backend in dev.
          '/pyapi': {
            target: pycoreApiBase,
            changeOrigin: true,
            ws: true,
            rewrite: (p) => p.replace(/^\/pyapi/, ''),
          },
        },
      },
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
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
