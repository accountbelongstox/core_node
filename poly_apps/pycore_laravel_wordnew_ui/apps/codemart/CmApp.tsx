import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from '../../core/i18n/UiI18n';
import { createAppRouteElements } from '../../shared/routing/AppRouteElements';
import { CmAccessGate } from './auth/CmAccessGate';
import { CmLayout } from './CmLayout';
import { registerCmLocales } from './cm-locales';
import { CM_PAGES } from './cmPages';
import './styles/cm-public-home.css';
import './styles/cm-workspace.css';

const CmPublicHomePage = lazy(() => import('./pages/CmPublicHomePage'));

registerCmLocales();

const CmPageFallback: React.FC = () => {
  const { t } = useTranslation('cm');
  return <div className="cm-page-fallback">{t('common.loading')}</div>;
};

const wrapPage = (node: React.ReactNode): React.ReactElement => (
  <Suspense fallback={<CmPageFallback />}>{node}</Suspense>
);

const cmPageRoutes = createAppRouteElements(CM_PAGES.map((page) => ({
  key: page.id,
  path: page.path,
  element: wrapPage(<page.Component />),
})));

const CmApp: React.FC = () => (
  <Routes>
    <Route index element={wrapPage(<CmPublicHomePage />)} />
    <Route element={<CmAccessGate><CmLayout /></CmAccessGate>}>
      {cmPageRoutes}
    </Route>
    <Route path="*" element={<Navigate to="/codemart" replace />} />
  </Routes>
);

export default CmApp;
