
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './contexts/AppContext';
import { apiManager } from './services/ApiManager';
import { Toaster } from 'sonner';
// Import Tailwind CSS styles (processed by PostCSS)
import './src/index.css';
// Import Inter font from @fontsource (bundled via Vite, no CDN dependency)
// All fonts are bundled locally for production builds
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

// 初始化API管理器
// Note: Health check is now handled by ApiHealthCheckProvider using React Hook useInterval
// No need to manually call startHealthCheck() - React Context handles it automatically
apiManager.initialize({
  autoDetect: true,
  timeout: 1000,
  testPath: '/',
}).then(() => {
  console.log('API Manager initialized. Current endpoint:', apiManager.getCurrentEndpoint()?.description);
}).catch((error) => {
  console.error('Failed to initialize API Manager:', error);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppProvider>
      <App />
      <Toaster 
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: 'var(--slate-50)',
            border: '1px solid var(--slate-200)',
          },
        }}
      />
    </AppProvider>
  </React.StrictMode>
);
