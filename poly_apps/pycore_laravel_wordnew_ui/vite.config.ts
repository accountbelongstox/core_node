import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { DEFAULT_FRONTEND_PORT } from './config/constants';

// Unified shell: laravel-manager, pycore-manager, wordnew. Pycore-manager uses
// the direct pycore HTTP transport (no Vite reverse proxy).
export default defineConfig(() => {
    const capacitorShim = (name: string) =>
      path.resolve(__dirname, 'shared/capacitor-web-shims', name + '.ts');

    const useNativeCapacitor = process.env.VITE_BUILD_TARGET === 'native';
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
        __APP_FLAVOR__: JSON.stringify(process.env.VITE_APP_FLAVOR || 'shell'),
      },
      server: {
        port: DEFAULT_FRONTEND_PORT,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss(),
        {
          name: 'laravel-api-mock-server',
          configureServer(server) {
            server.middlewares.use((req, res, next) => {
              const fullUrl = req.url || '';
              if (!fullUrl.startsWith('/api')) {
                next();
                return;
              }
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
                    id: 'u1',
                    name: 'Guest Admin',
                    email: 'admin@example.com',
                    avatar_url: 'https://i.pravatar.cc/150?u=admin',
                    role: 'admin',
                    nickname: 'Admin',
                  },
                  data: {
                    user: {
                      id: 'u1',
                      name: 'Guest Admin',
                      email: 'admin@example.com',
                      avatar_url: 'https://i.pravatar.cc/150?u=admin',
                      role: 'admin',
                      nickname: 'Admin',
                    },
                  },
                }));
                return;
              }

              if (pathName === '/api/app_qy_v1/group/list' || pathName === '/api/app_qy_v1/group/get_all' || pathName.includes('/group')) {
                res.end(JSON.stringify({ success: true, data: [] }));
                return;
              }

              if (pathName.includes('/learning/collections') || pathName.includes('/collections')) {
                res.end(JSON.stringify({ success: true, data: [] }));
                return;
              }

              if (pathName.includes('/login')) {
                res.end(JSON.stringify({
                  success: true,
                  token: 'mock-jwt-token-xyz-123',
                  user: {
                    id: 'u1',
                    name: 'Guest Admin',
                    email: 'admin@example.com',
                    avatar_url: 'https://i.pravatar.cc/150?u=admin',
                  },
                }));
                return;
              }

              res.end(JSON.stringify({ success: true, data: [] }));
            });
          },
        },
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
