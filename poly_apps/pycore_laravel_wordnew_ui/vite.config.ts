import path from 'path';
import os from 'os';
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
  CORE_NODE_DATA_DIR_NAME,
  GLOBAL_VAR_DIR_NAME,
  TAILNET_DNS_SUFFIX,
  WEB_ACCESS_CONFIG_FILE_NAME,
} from './core/contracts/ServiceContract';
import { readTailnetPeersSync, serveTailnetPeers } from './core/devserver/TailnetPeersMiddleware';
import { nativeDebugBridge } from './core/devserver/NativeDebugBridge';

// Unified shell: laravel-manager, pycore-manager, wordnew. Pycore-manager uses
// the direct pycore HTTP transport (no Vite reverse proxy).

// Dashboard allowed-hosts come from an EXTERNAL constant-path file written
// idempotently by the 132 domain-binding helper (one hostname per line).
// Contract hosts are always present; the external file adds runtime domains.
// Directory names come from the canonical service contract; the WWW bases
// follow the data-root rule every end shares (pycore core_node_dirs, ncore
// system_paths.js, runtime_environment.sh, PathMapper::getCoreNodeRuntimeDir):
// CORE_NODE_DATA_DIR wins, else D:\www\core_node on Windows, else
// /www/www/core_node when /www is the NTFS dual-boot root, else /www/core_node,
// then the legacy /var/_core_node and ~/core_node when those do not exist.
const WINDOWS_WWW_BASE = 'D:\\www';
const LINUX_WWW_ROOT = '/www';
const LINUX_NTFS_WWW_BASE = '/www/www';
const LEGACY_LINUX_DATA_DIR = '/var/_core_node';
const PROC_MOUNTS_FILE = '/proc/mounts';
const NTFS_FILE_SYSTEMS = new Set(['ntfs', 'ntfs3', 'fuseblk', 'ntfs-3g']);
const CORE_NODE_DATA_DIR = resolveCoreNodeDataDir();
const WEB_ACCESS_CONFIG_FILE = path.join(CORE_NODE_DATA_DIR, GLOBAL_VAR_DIR_NAME, WEB_ACCESS_CONFIG_FILE_NAME);
// Every tailnet machine is reached as <machine>.<tailnet>.<suffix> through the
// 175 FrankenPHP proxy; a leading dot allows all of its subdomains.
const TAILNET_ALLOWED_HOST = `.${TAILNET_DNS_SUFFIX}`;

function mountOf(target: string): { source: string; fileSystem: string } | null {
  let best: { mountPoint: string; source: string; fileSystem: string } | null = null;
  try {
    for (const line of fs.readFileSync(PROC_MOUNTS_FILE, 'utf8').split('\n')) {
      const [source, rawMountPoint, fileSystem] = line.split(' ');
      if (!source || !rawMountPoint || !fileSystem) continue;
      const mountPoint = rawMountPoint.replace(/\\040/g, ' ');
      const covers = target === mountPoint || target.startsWith(`${mountPoint.replace(/\/$/, '')}/`);
      if (covers && (!best || mountPoint.length > best.mountPoint.length)) best = { mountPoint, source, fileSystem };
    }
  } catch {
    return null;
  }
  return best;
}

function linuxWwwBase(): string {
  const www = mountOf(LINUX_WWW_ROOT);
  const root = mountOf('/');
  const ntfsDataRoot = Boolean(www && root && www.source !== root.source && NTFS_FILE_SYSTEMS.has(www.fileSystem))
    && fs.existsSync(LINUX_NTFS_WWW_BASE);
  return ntfsDataRoot ? LINUX_NTFS_WWW_BASE : LINUX_WWW_ROOT;
}

function resolveCoreNodeDataDir(): string {
  const configured = (process.env.CORE_NODE_DATA_DIR || '').trim();
  if (configured) return configured;
  if (process.platform === 'win32') return path.win32.join(WINDOWS_WWW_BASE, CORE_NODE_DATA_DIR_NAME);
  const preferred = path.posix.join(linuxWwwBase(), CORE_NODE_DATA_DIR_NAME);
  const candidates = [preferred, LEGACY_LINUX_DATA_DIR, path.join(os.homedir(), CORE_NODE_DATA_DIR_NAME)];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? preferred;
}

const readExternalAllowedHosts = (): string[] => {
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
  return [];
};

const resolveAllowedHosts = (): string[] => Array.from(new Set([TAILNET_ALLOWED_HOST, ...readExternalAllowedHosts()]));

// allowedHosts is read once at startup; the shell rewrites the file later
// (e.g. once Tailscale connects), so restart the dev server when it changes.
const restartOnAllowedHostsChange = (server) => {
  let current = JSON.stringify(resolveAllowedHosts());
  server.watcher.add(WEB_ACCESS_CONFIG_FILE);
  server.watcher.on('all', (_event: string, changedPath: string) => {
    if (path.resolve(changedPath) !== path.resolve(WEB_ACCESS_CONFIG_FILE)) return;
    const next = JSON.stringify(resolveAllowedHosts());
    if (next === current) return;
    current = next;
    server.config.logger.info(`[web-access] allowedHosts changed in ${WEB_ACCESS_CONFIG_FILE}; restarting`);
    void server.restart();
  });
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
    const capacitorShims: Record<string, string> = {
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
    const capacitorAliases = useNativeCapacitor ? {} : capacitorShims;
    // Native dev servers pre-bundle the real plugins up front (lazy discovery
    // answers 504 Outdated Optimize Dep to the WebView) and keep their own
    // cache so a concurrent web dev server never invalidates it.
    const nativePluginDeps = Object.keys(capacitorShims)
      .filter((name) => fs.existsSync(path.resolve(__dirname, 'node_modules', name, 'package.json')));

    return {
      cacheDir: useNativeCapacitor ? 'node_modules/.vite-native' : 'node_modules/.vite',
      optimizeDeps: useNativeCapacitor ? { include: ['@capacitor/core', ...nativePluginDeps] } : {},
      define: {
        __APP_FLAVOR__: JSON.stringify(FRONTEND_APP_FLAVOR),
        __TAILNET_PEERS_SEED__: JSON.stringify(readTailnetPeersSync()),
      },
      server: {
        port: DEFAULT_FRONTEND_PORT,
        host: BIND_ANY_HOST,
        strictPort: true,
        // Native/Gradle build outputs must not trigger HMR page reloads.
        watch: { ignored: ['**/native/**', '**/artifacts/**', '**/dist/**', '**/scripts/**'] },
        allowedHosts: resolveAllowedHosts(),
        warmup: {
          clientFiles: [
            './core/integrations/laravel/LaravelAPI.ts',
            './core/integrations/laravel/LaravelRequest.ts',
            './core/integrations/laravel/LaravelRelayAPI.ts',
            './core/integrations/laravel/LaravelRelayOperationEvents.ts',
          ],
        },
      },
      preview: {
        allowedHosts: resolveAllowedHosts(),
      },
      plugins: [
        react(),
        {
          name: 'web-access-config-server',
          configureServer(server) {
            server.middlewares.use(serveWebAccessConfig);
            server.middlewares.use(serveTailnetPeers);
            restartOnAllowedHostsChange(server);
          },
          configurePreviewServer(server) {
            server.middlewares.use(serveWebAccessConfig);
            server.middlewares.use(serveTailnetPeers);
          },
        },
        tailwindcss(),
        nativeDebugBridge(),
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
