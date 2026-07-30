import React from 'react';
import ReactDOM from 'react-dom/client';
import './core/i18n';
import './themes/index.css';
import ShellApp from './shell/ShellApp';
import StandaloneApp from './shell/StandaloneApp';
import { applyFlavorDocument, FLAVOR, IS_STANDALONE } from './shell/flavor';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

applyFlavorDocument(FLAVOR);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {/* VITE_APP_FLAVOR selects the build: the full multi-app shell (default), or
        a single sub-app mounted standalone as the homepage. */}
    {IS_STANDALONE ? <StandaloneApp flavor={FLAVOR} /> : <ShellApp />}
  </React.StrictMode>
);
