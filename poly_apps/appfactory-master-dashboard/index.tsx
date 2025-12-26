
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './contexts/AppContext';
import { apiManager } from './services/ApiManager';
import { Toaster } from 'sonner';

// 初始化API管理器
apiManager.initialize({
  autoDetect: true,
  timeout: 1000,
  testPath: '/',
}).then(() => {
  // 启动后台健康检查（每60秒检查一次）
  apiManager.startHealthCheck(60000);
  
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
