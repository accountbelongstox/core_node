import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import {
  DEFAULT_FRONTEND_PORT,
  FRONTEND_APP_FLAVOR,
  FRONTEND_BUILD_TARGET,
} from './core/config/FrontendConfig';
import {
  BIND_ANY_HOST,
  CORE_NODE_DATA_DIR_POSIX,
  CORE_NODE_DATA_DIR_WINDOWS_SUBPATH,
  GLOBAL_VAR_DIR_NAME,
  WEB_ACCESS_CONFIG_FILE_NAME,
} from './core/contracts/ServiceContract';

// Unified shell: laravel-manager, pycore-manager, wordnew. Pycore-manager uses
// the direct pycore HTTP transport (no Vite reverse proxy).

// Dashboard allowed-hosts come from an EXTERNAL constant-path file written
// idempotently by the 132 domain-binding helper (one hostname per line).
// Contract hosts are always present; the external file adds runtime domains.
// All path pieces come from the canonical service contract.
const CORE_NODE_DATA_DIR = process.env.CORE_NODE_DATA_DIR
  ?? (process.platform === 'win32'
    ? path.join(path.parse(process.cwd()).root, CORE_NODE_DATA_DIR_WINDOWS_SUBPATH)
    : CORE_NODE_DATA_DIR_POSIX);
const WEB_ACCESS_CONFIG_FILE = path.join(CORE_NODE_DATA_DIR, GLOBAL_VAR_DIR_NAME, WEB_ACCESS_CONFIG_FILE_NAME);

const readExternalAllowedHosts = (): string[] | undefined => {
  try {
    const document = JSON.parse(fs.readFileSync(WEB_ACCESS_CONFIG_FILE, 'utf8')) as {
      allowedHosts?: unknown;
    };
    if (Array.isArray(document.allowedHosts)
      && document.allowedHosts.every((host) => typeof host === 'string' && host.length > 0)) {
      return Array.from(new Set(document.allowedHosts));
    }
  } catch {
  }
  return undefined;
};

// Serve the shell-written UI domain config (api region prefix) same-origin.
// The file is re-read from disk on EVERY request (no caching), so a shell-side
// change is visible to the frontend immediately in both dev and preview. A
// missing/unreadable file answers 404 and the frontend keeps its defaults.
const serveWebAccessConfig = (req, res, next) => {
  const pathName = (req.url || '').split('?')[0];
  if (pathName !== `/${WEB_ACCESS_CONFIG_FILE_NAME}`) {
    next();
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  let body;
  try {
    body = fs.readFileSync(WEB_ACCESS_CONFIG_FILE, 'utf8');
  } catch {
    res.statusCode = 404;
    res.end(JSON.stringify({}));
    return;
  }
  res.end(body);
};
export default defineConfig(() => {
    const capacitorShim = (name: string) =>
      path.resolve(__dirname, 'apps/wordnew/platform/capacitor-web-shims', name + '.ts');

    const useNativeCapacitor = FRONTEND_BUILD_TARGET === 'native';
    const capacitorAliases = useNativeCapacitor ? {} : {
      '@capacitor/core': capacitorShim('core'),
      '@capacitor/preferences': capacitorShim('preferences'),
      '@capacitor/dialog': capacitorShim('dialog'),
      '@capacitor/toast': capacitorShim('toast'),
      '@capacitor/status-bar': capacitorShim('status-bar'),
      '@capacitor/keyboard': capacitorShim('keyboard'),
      '@capacitor/app': capacitorShim('app'),
      '@capacitor/geolocation': capacitorShim('geolocation'),
      '@capacitor/network': capacitorShim('network'),
      '@capacitor/device': capacitorShim('device'),
      '@capacitor-community/voice-recorder': capacitorShim('voice-recorder'),
      // The installed replacement package (community one was unpublished) —
      // web builds keep using the MediaRecorder shim.
      'capacitor-voice-recorder': capacitorShim('voice-recorder'),
      '@capacitor/haptics': capacitorShim('haptics'),
      '@capacitor-community/text-to-speech': capacitorShim('text-to-speech'),
      '@capacitor-community/speech-recognition': capacitorShim('speech-recognition'),
      '@capacitor-community/keep-awake': capacitorShim('keep-awake'),
      '@capacitor/local-notifications': capacitorShim('local-notifications'),
      '@capacitor/filesystem': capacitorShim('filesystem'),
      '@capacitor/camera': capacitorShim('camera'),
      '@capacitor-community/sqlite': capacitorShim('community-sqlite'),
      '@capacitor/browser': capacitorShim('browser'),
    };

    return {
      define: {
        __APP_FLAVOR__: JSON.stringify(FRONTEND_APP_FLAVOR),
      },
      server: {
        port: DEFAULT_FRONTEND_PORT,
        host: BIND_ANY_HOST,
        strictPort: true,
        allowedHosts: readExternalAllowedHosts(),
      },
      preview: {
        allowedHosts: readExternalAllowedHosts(),
      },
      plugins: [
        react(),
        {
          name: 'web-access-config-server',
          configureServer(server) {
            server.middlewares.use(serveWebAccessConfig);
          },
          configurePreviewServer(server) {
            server.middlewares.use(serveWebAccessConfig);
          },
        },
        tailwindcss(),
      ],
      resolve: {
        dedupe: ['react', 'react-dom'],
        alias: {
          '@': path.resolve(__dirname, '.'),
          ...capacitorAliases,
        },
      },
    };
});
