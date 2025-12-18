import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Support PORT env var and CLI args (CLI args take precedence)
    const port = parseInt(process.env.PORT || process.env.VITE_PORT || '3100');
    const host = process.env.HOST || process.env.VITE_HOST || '0.0.0.0';
    return {
      server: {
        port,
        host,
        strictPort: true,  // Fail if port is in use instead of auto-incrementing
        proxy: {
          '/api': {
            target: env.VITE_API_BASE_URL || 'http://localhost:59000',
            changeOrigin: true,
            secure: false,
            rewrite: (path) => path,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
