import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    
    return {
      server: {
        port: parseInt(process.env.PORT || '3000'),
        host: '0.0.0.0',
        // BrowserRouter support: Vite dev server automatically handles SPA routing
        // All routes return index.html, allowing React Router to handle routing
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
      },
      build: {
        // Production build optimizations
        target: 'esnext',
        minify: 'esbuild',
        sourcemap: !isProduction,
        rollupOptions: {
          output: {
            // Code splitting for better caching
            manualChunks: {
              'react-vendor': ['react', 'react-dom', 'react-router-dom'],
              'ui-vendor': ['lucide-react', 'recharts', 'sonner'],
              'ai-vendor': ['@google/genai'],
            },
          },
        },
        // Optimize chunk size
        chunkSizeWarningLimit: 1000,
      },
      // Optimize dependencies pre-bundling
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'react-router-dom',
          'lucide-react',
          'recharts',
          'sonner',
          '@google/genai',
          '@fontsource/inter',
        ],
      },
    };
});
