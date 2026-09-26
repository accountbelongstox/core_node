import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from '../../core/i18n/UiI18n';
import { createAppRouteElements } from '../../shared/routing/AppRouteElements';
import { CmAccessGate } from './auth/CmAccessGate';
import { CmCapabilityGate } from './components/access/CmCapabilityGate';
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
const CmShowcasePage = lazy(() => import('./pages/CmShowcasePage'));
const CmLoginPage = lazy(() => import('./pages/CmLoginPage'));
const CmRegisterPage = lazy(() => import('./pages/CmPublicAuthPages').then((module) => ({ default: module.CmRegisterPage })));
const CmForgotPasswordPage = lazy(() => import('./pages/CmPublicAuthPages').then((module) => ({ default: module.CmForgotPasswordPage })));
const CmPasswordResetPage = lazy(() => import('./pages/CmPublicAuthPages').then((module) => ({ default: module.CmPasswordResetPage })));

const CmAdminLayout = lazy(() => import('./admin/CmAdminLayout'));
const CmAdminOverviewPage = lazy(() => import('./admin/CmAdminPages').then((module) => ({ default: module.CmAdminOverviewPage })));
const CmAdminUsersPage = lazy(() => import('./admin/CmAdminPages').then((module) => ({ default: module.CmAdminUsersPage })));
const CmAdminKycPage = lazy(() => import('./admin/CmAdminPages').then((module) => ({ default: module.CmAdminKycPage })));
const CmAdminDepositsPage = lazy(() => import('./admin/CmAdminFinancePages').then((module) => ({ default: module.CmAdminDepositsPage })));
const CmAdminRefundsPage = lazy(() => import('./admin/CmAdminFinancePages').then((module) => ({ default: module.CmAdminRefundsPage })));
const CmAdminProjectsPage = lazy(() => import('./admin/CmAdminFinancePages').then((module) => ({ default: module.CmAdminProjectsPage })));
const CmAdminUserDetailPage = lazy(() => import('./admin/CmAdminUserDetailPage'));
const CmAdminWithdrawalsPage = lazy(() => import('./admin/CmAdminFinancePages').then((module) => ({ default: module.CmAdminWithdrawalsPage })));
const CmAdminPaymentsPage = lazy(() => import('./admin/CmAdminFinancePages').then((module) => ({ default: module.CmAdminPaymentsPage })));
const CmAdminTestimonialsPage = lazy(() => import('./admin/CmAdminModerationPages').then((module) => ({ default: module.CmAdminTestimonialsPage })));
const CmAdminReviewerApplicationsPage = lazy(() => import('./admin/CmAdminModerationPages').then((module) => ({ default: module.CmAdminReviewerApplicationsPage })));
const CmAdminContactMessagesPage = lazy(() => import('./admin/CmAdminModerationPages').then((module) => ({ default: module.CmAdminContactMessagesPage })));
const CmAdminActivityPage = lazy(() => import('./admin/CmAdminModerationPages').then((module) => ({ default: module.CmAdminActivityPage })));
const CmProjectDetailPage = lazy(() => import('./pages/CmProjectDetailPage'));

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
      <Route path="showcase" element={wrapPage(<CmShowcasePage />)} />
      <Route path="login" element={wrapPage(<CmLoginPage />)} />
      <Route path="register" element={wrapPage(<CmRegisterPage />)} />
      <Route path="forgot-password" element={wrapPage(<CmForgotPasswordPage />)} />
      <Route path="password-reset/:token" element={wrapPage(<CmPasswordResetPage />)} />

      {/* Administration console (separate interface, admin-gated) */}
      <Route element={<CmAccessGate>{wrapPage(<CmAdminLayout />)}</CmAccessGate>}>
        <Route path="admin" element={wrapPage(<CmAdminOverviewPage />)} />
        <Route path="admin/users" element={wrapPage(<CmAdminUsersPage />)} />
        <Route path="admin/kyc" element={wrapPage(<CmAdminKycPage />)} />
        <Route path="admin/deposits" element={wrapPage(<CmAdminDepositsPage />)} />
        <Route path="admin/refunds" element={wrapPage(<CmAdminRefundsPage />)} />
        <Route path="admin/projects" element={wrapPage(<CmAdminProjectsPage />)} />
        <Route path="admin/users/:userId" element={wrapPage(<CmAdminUserDetailPage />)} />
        <Route path="admin/withdrawals" element={wrapPage(<CmAdminWithdrawalsPage />)} />
        <Route path="admin/payments" element={wrapPage(<CmAdminPaymentsPage />)} />
        <Route path="admin/testimonials" element={wrapPage(<CmAdminTestimonialsPage />)} />
        <Route path="admin/reviewer-applications" element={wrapPage(<CmAdminReviewerApplicationsPage />)} />
        <Route path="admin/contact-messages" element={wrapPage(<CmAdminContactMessagesPage />)} />
        <Route path="admin/activity" element={wrapPage(<CmAdminActivityPage />)} />
      </Route>

      {/* Authenticated user workspace */}
      <Route element={<CmAccessGate><CmLayout /></CmAccessGate>}>
        {cmPageRoutes}
        <Route path="projects/:projectId" element={<CmCapabilityGate page={PROJECTS_PAGE}>{wrapPage(<CmProjectDetailPage />)}</CmCapabilityGate>} />
      </Route>
      <Route path="*" element={<Navigate to="/codemart" replace />} />
    </Routes>
  </CmBootstrapProvider>
);

export default CmApp;
