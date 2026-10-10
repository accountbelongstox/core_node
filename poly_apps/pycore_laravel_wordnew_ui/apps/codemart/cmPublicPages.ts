import { lazy, type ComponentType } from 'react';

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
const CmBrandGalleryPage = lazy(() => import('./pages/CmBrandGalleryPage'));
const CmLoginPage = lazy(() => import('./pages/CmLoginPage'));
const CmRegisterPage = lazy(() => import('./pages/CmPublicAuthPages').then((module) => ({ default: module.CmRegisterPage })));
const CmForgotPasswordPage = lazy(() => import('./pages/CmPublicAuthPages').then((module) => ({ default: module.CmForgotPasswordPage })));
const CmPasswordResetPage = lazy(() => import('./pages/CmPublicAuthPages').then((module) => ({ default: module.CmPasswordResetPage })));

export interface CmPublicPageDef {
  id: string;
  /** Route path relative to the app base; '' is the index route. */
  path: string;
  Component: ComponentType;
}

/** Signed-out pages; the mobile UI overrides a page by id and falls back to the web page for the rest. */
export const CM_PUBLIC_PAGES: CmPublicPageDef[] = [
  { id: 'home', path: '', Component: CmPublicHomePage },
  { id: 'about', path: 'about', Component: CmAboutPage },
  { id: 'delivery-process', path: 'delivery-process', Component: CmDeliveryProcessPage },
  { id: 'services', path: 'services', Component: CmServicesPage },
  { id: 'estimate', path: 'estimate', Component: CmEstimatePage },
  { id: 'download', path: 'download', Component: CmDownloadPage },
  { id: 'privacy', path: 'privacy', Component: CmPrivacyPage },
  { id: 'terms', path: 'terms', Component: CmTermsPage },
  { id: 'information', path: 'information', Component: CmInformationPage },
  { id: 'showcase', path: 'showcase', Component: CmShowcasePage },
  { id: 'brand-gallery', path: 'brand-gallery', Component: CmBrandGalleryPage },
  { id: 'login', path: 'login', Component: CmLoginPage },
  { id: 'register', path: 'register', Component: CmRegisterPage },
  { id: 'forgot-password', path: 'forgot-password', Component: CmForgotPasswordPage },
  { id: 'password-reset', path: 'password-reset/:token', Component: CmPasswordResetPage },
];
