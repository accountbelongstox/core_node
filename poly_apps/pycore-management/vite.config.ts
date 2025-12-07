import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
<<<<<<< HEAD
        proxy: {
          '/api': {
            target: env.VITE_API_BASE_URL || 'http://localhost:59000',
            changeOrigin: true,
            secure: false,
            rewrite: (path) => path,
          },
        },
=======
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522
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
