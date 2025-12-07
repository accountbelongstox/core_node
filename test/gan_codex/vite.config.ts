import path from 'path';
<<<<<<< HEAD
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

=======
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
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
<<<<<<< HEAD
});
=======
});
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522
