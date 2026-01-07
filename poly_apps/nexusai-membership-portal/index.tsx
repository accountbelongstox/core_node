
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { apiManager } from './services/api';
import './index.css';

// Initialize API manager
apiManager.initialize({ autoDetect: true, timeout: 1000 }).catch(console.error);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
