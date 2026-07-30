import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 58889,  // Frontend port (different from backend 58888)
        host: '0.0.0.0',
        strictPort: false,  // Allow fallback to other ports if 58889 is busy
        proxy: {
          '/api': {
            target: 'http://localhost:58888',
            changeOrigin: true,
          }
        }
      },
      plugins: [react()],
      define: {
        // Only define if env vars exist (prevent undefined causing Vite startup issues)
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
