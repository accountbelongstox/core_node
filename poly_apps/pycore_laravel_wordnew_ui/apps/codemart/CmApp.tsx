import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from '../../core/i18n/UiI18n';
import { createAppRouteElements } from '../../shared/routing/AppRouteElements';
import { CmAccessGate } from './auth/CmAccessGate';
import { CmBootstrapProvider } from './contexts/CmBootstrapContext';
import { CmLayout } from './CmLayout';
import { registerCmLocales } from './cm-locales';
import { CM_PAGES } from './cmPages';
import './styles/cm-public-home.css';
import './styles/cm-workspace.css';

const CmPublicHomePage = lazy(() => import('./pages/CmPublicHomePage'));
const CmEstimatePage = lazy(() => import('./pages/CmEstimatePage'));
const CmAboutPage = lazy(() => import('./pages/CmInfoPages').then((module) => ({ default: module.CmAboutPage })));
const CmDeliveryProcessPage = lazy(() => import('./pages/CmInfoPages').then((module) => ({ default: module.CmDeliveryProcessPage })));
const CmServicesPage = lazy(() => import('./pages/CmInfoPages').then((module) => ({ default: module.CmServicesPage })));
const CmPrivacyPage = lazy(() => import('./pages/CmInfoPages').then((module) => ({ default: module.CmPrivacyPage })));
const CmTermsPage = lazy(() => import('./pages/CmInfoPages').then((module) => ({ default: module.CmTermsPage })));
const CmInformationPage = lazy(() => import('./pages/CmInfoPages').then((module) => ({ default: module.CmInformationPage })));
const CmDownloadPage = lazy(() => import('./pages/CmDownloadPage'));

const CmAdminLayout = lazy(() => import('./admin/CmAdminLayout'));
const CmAdminOverviewPage = lazy(() => import('./admin/CmAdminPages').then((module) => ({ default: module.CmAdminOverviewPage })));
const CmAdminUsersPage = lazy(() => import('./admin/CmAdminPages').then((module) => ({ default: module.CmAdminUsersPage })));
const CmAdminKycPage = lazy(() => import('./admin/CmAdminPages').then((module) => ({ default: module.CmAdminKycPage })));
const CmAdminDepositsPage = lazy(() => import('./admin/CmAdminFinancePages').then((module) => ({ default: module.CmAdminDepositsPage })));
const CmAdminRefundsPage = lazy(() => import('./admin/CmAdminFinancePages').then((module) => ({ default: module.CmAdminRefundsPage })));
const CmAdminProjectsPage = lazy(() => import('./admin/CmAdminFinancePages').then((module) => ({ default: module.CmAdminProjectsPage })));
const CmProjectDetailPage = lazy(() => import('./pages/CmProjectDetailPage'));

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
  <CmBootstrapProvider>
    <Routes>
      {/* Public surface */}
      <Route index element={wrapPage(<CmPublicHomePage />)} />
      <Route path="about" element={wrapPage(<CmAboutPage />)} />
      <Route path="delivery-process" element={wrapPage(<CmDeliveryProcessPage />)} />
      <Route path="services" element={wrapPage(<CmServicesPage />)} />
      <Route path="estimate" element={wrapPage(<CmEstimatePage />)} />
      <Route path="download" element={wrapPage(<CmDownloadPage />)} />
      <Route path="privacy" element={wrapPage(<CmPrivacyPage />)} />
      <Route path="terms" element={wrapPage(<CmTermsPage />)} />
      <Route path="information" element={wrapPage(<CmInformationPage />)} />

      {/* Administration console (separate interface, admin-gated) */}
      <Route element={<CmAccessGate>{wrapPage(<CmAdminLayout />)}</CmAccessGate>}>
        <Route path="admin" element={wrapPage(<CmAdminOverviewPage />)} />
        <Route path="admin/users" element={wrapPage(<CmAdminUsersPage />)} />
        <Route path="admin/kyc" element={wrapPage(<CmAdminKycPage />)} />
        <Route path="admin/deposits" element={wrapPage(<CmAdminDepositsPage />)} />
        <Route path="admin/refunds" element={wrapPage(<CmAdminRefundsPage />)} />
        <Route path="admin/projects" element={wrapPage(<CmAdminProjectsPage />)} />
      </Route>

      {/* Authenticated user workspace */}
      <Route element={<CmAccessGate><CmLayout /></CmAccessGate>}>
        {cmPageRoutes}
        <Route path="projects/:projectId" element={wrapPage(<CmProjectDetailPage />)} />
      </Route>
      <Route path="*" element={<Navigate to="/codemart" replace />} />
    </Routes>
  </CmBootstrapProvider>
);

export default CmApp;
