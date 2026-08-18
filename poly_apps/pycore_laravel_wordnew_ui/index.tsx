import React from 'react';
import ReactDOM from 'react-dom/client';
import './core/i18n/UiI18n';
import './shell/shellTranslations';
import './apps/laravel-manager/i18n';
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
let rootMounted = true;
const unmountRoot = (): void => {
  if (!rootMounted) return;
  rootMounted = false;
  root.unmount();
};
const handlePageHide = (event: PageTransitionEvent): void => {
  if (!event.persisted) unmountRoot();
};

window.addEventListener('pagehide', handlePageHide, { once: true });

root.render(
  <React.StrictMode>
    {/* Central code configuration selects the full shell or standalone app. */}
    {IS_STANDALONE ? <StandaloneApp flavor={FLAVOR} /> : <ShellApp />}
  </React.StrictMode>
);
