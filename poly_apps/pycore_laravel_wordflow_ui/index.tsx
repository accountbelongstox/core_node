import React from 'react';
import ReactDOM from 'react-dom/client';
import './core/i18n';
import './themes/index.css';
import ShellApp from './shell/ShellApp';
import StandaloneApp from './shell/StandaloneApp';
import { FLAVOR, IS_STANDALONE } from './shell/flavor';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Reflect the flavor's name + theme color at runtime (no destructive HTML edits).
if (typeof document !== 'undefined') {
  document.title = FLAVOR.name;
  if (FLAVOR.themeColor) {
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = FLAVOR.themeColor;
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {/* VITE_APP_FLAVOR selects the build: the full multi-app shell (default), or
        a single sub-app mounted standalone as the homepage. */}
    {IS_STANDALONE ? <StandaloneApp flavor={FLAVOR} /> : <ShellApp />}
  </React.StrictMode>
);
