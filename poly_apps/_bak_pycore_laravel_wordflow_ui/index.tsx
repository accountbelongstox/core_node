import React from 'react';
import ReactDOM from 'react-dom/client';
import './core/i18n';
import './themes/index.css';
import ShellApp from './shell/ShellApp';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ShellApp />
  </React.StrictMode>
);
