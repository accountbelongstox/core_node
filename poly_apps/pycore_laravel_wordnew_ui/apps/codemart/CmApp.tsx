import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from '../../core/i18n/UiI18n';
import { createAppRouteElements } from '../../shared/routing/AppRouteElements';
import { CmAccessGate } from './auth/CmAccessGate';
import { CmCapabilityGate } from './components/access/CmCapabilityGate';
import { CM_PUBLIC_ROUTE } from './components/public-home/cmPublicRoutes';
import { CmBootstrapProvider } from './contexts/CmBootstrapContext';
import { CmLayout } from './CmLayout';
import { registerCmLocales } from './cm-locales';
import { CM_PAGES } from './cmPages';
import { CM_PUBLIC_PAGES } from './cmPublicPages';
import { CM_ADMIN_ROUTES } from './admin/cmAdminRouteTable';
import { useCmUiMode } from './shared/cmUiMode';
import './styles/cm-public-home.css';
import './styles/cm-workspace.css';

const CmAdminLayout = lazy(() => import('./admin/CmAdminLayout'));
const CmProjectDetailPage = lazy(() => import('./pages/CmProjectDetailPage'));
const CmMobileApp = lazy(() => import('./mobile/CmMobileApp'));

registerCmLocales();

const PROJECTS_PAGE = CM_PAGES.find((page) => page.id === 'projects') ?? CM_PAGES[0];

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
  element: <CmCapabilityGate page={page}>{wrapPage(<page.Component />)}</CmCapabilityGate>,
})));

const CmWebRoutes: React.FC = () => (
  <Routes>
    {/* Public surface */}
    {CM_PUBLIC_PAGES.map((page) => (
      <Route key={page.id} index={page.path === ''} path={page.path === '' ? undefined : page.path} element={wrapPage(<page.Component />)} />
    ))}

    {/* Administration console (separate interface, admin-gated) */}
    <Route element={<CmAccessGate>{wrapPage(<CmAdminLayout />)}</CmAccessGate>}>
      {CM_ADMIN_ROUTES.map((page) => (
        <Route key={page.id} path={page.path} element={wrapPage(<page.Component />)} />
      ))}
    </Route>

    {/* Authenticated user workspace */}
    <Route element={<CmAccessGate><CmLayout /></CmAccessGate>}>
      {cmPageRoutes}
      <Route path="projects/:projectId" element={<CmCapabilityGate page={PROJECTS_PAGE}>{wrapPage(<CmProjectDetailPage />)}</CmCapabilityGate>} />
    </Route>
    <Route path="*" element={<Navigate to={CM_PUBLIC_ROUTE.home} replace />} />
  </Routes>
);

const CmApp: React.FC = () => {
  const uiMode = useCmUiMode();
  return (
    <CmBootstrapProvider>
      {uiMode === 'mobile' ? wrapPage(<CmMobileApp />) : <CmWebRoutes />}
    </CmBootstrapProvider>
  );
};

export default CmApp;
