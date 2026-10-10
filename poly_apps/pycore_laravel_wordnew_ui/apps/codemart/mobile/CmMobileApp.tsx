import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthSession } from '../../../core/auth/useAuthSession';
import { CM_ADMIN_ROUTES } from '../admin/cmAdminRouteTable';
import { CmAccessGate } from '../auth/CmAccessGate';
import { CmCapabilityGate } from '../components/access/CmCapabilityGate';
import { CM_PROTECTED_ROUTE, CM_PUBLIC_ROUTE } from '../components/public-home/cmPublicRoutes';
import { CM_PAGES } from '../cmPages';
import { CM_PUBLIC_PAGES } from '../cmPublicPages';
import { MOBILE_ADMIN_SCREENS, MOBILE_PUBLIC_SCREENS, MOBILE_WORKSPACE_SCREENS } from './cmMobileScreens';
import { MobileAdminGate } from './shell/MobileAdminGate';
import { MobilePublicShell } from './shell/MobilePublicShell';
import { MobileShell } from './shell/MobileShell';
import { MobileWebFallback } from './shell/MobileWebFallback';
import { useMobileBackButton } from './shell/useMobileBackButton';
import { MobileSkeletonList } from './ui/MobileSkeleton';
import './styles/cm-mobile.css';

const PROJECT_DETAIL_SCREEN_ID = 'project-detail';
const PROJECTS_PAGE = CM_PAGES.find((page) => page.id === 'projects') ?? CM_PAGES[0];
const ProjectDetailWebPage = React.lazy(() => import('../pages/CmProjectDetailPage'));
const AdminLayoutWeb = React.lazy(() => import('../admin/CmAdminLayout'));

const wrapScreen = (node: React.ReactNode): React.ReactElement => (
  <Suspense fallback={<MobileSkeletonList rows={4} />}>{node}</Suspense>
);

const withWebFallback = (Screen: React.ComponentType | undefined, Web: React.ComponentType): React.ReactElement => (
  Screen ? <Screen /> : <MobileWebFallback><Web /></MobileWebFallback>
);

const mobilePublicPages = CM_PUBLIC_PAGES.filter((page) => MOBILE_PUBLIC_SCREENS[page.id] !== undefined);
const webPublicPages = CM_PUBLIC_PAGES.filter((page) => MOBILE_PUBLIC_SCREENS[page.id] === undefined);
const mobileAdminRoutes = CM_ADMIN_ROUTES.filter((page) => MOBILE_ADMIN_SCREENS[page.id] !== undefined);
const webAdminRoutes = CM_ADMIN_ROUTES.filter((page) => MOBILE_ADMIN_SCREENS[page.id] === undefined);
const HOME_PAGE_ID = 'home';

/**
 * The mobile CodeMart UI: same routes and same data layer as the web UI, an
 * app frame (top bar, drawer, bottom tabs) and compact screens. A page without
 * a mobile screen yet keeps showing its web page inside the frame.
 */
const CmMobileApp: React.FC = () => {
  const authenticated = useAuthSession();
  useMobileBackButton();

  return (
    <Routes>
      <Route element={<MobilePublicShell />}>
        {mobilePublicPages.map((page) => {
          const Screen = MOBILE_PUBLIC_SCREENS[page.id];
          const element = page.id === HOME_PAGE_ID && authenticated
            ? <Navigate to={CM_PROTECTED_ROUTE.dashboard} replace />
            : wrapScreen(<Screen />);
          return <Route key={page.id} index={page.path === ''} path={page.path === '' ? undefined : page.path} element={element} />;
        })}
      </Route>
      {webPublicPages.map((page) => {
        const element = page.id === HOME_PAGE_ID && authenticated
          ? <Navigate to={CM_PROTECTED_ROUTE.dashboard} replace />
          : wrapScreen(<page.Component />);
        return <Route key={page.id} index={page.path === ''} path={page.path === '' ? undefined : page.path} element={element} />;
      })}

      <Route element={<CmAccessGate><MobileShell /></CmAccessGate>}>
        {CM_PAGES.map((page) => (
          <Route
            key={page.id}
            path={page.path}
            element={<CmCapabilityGate page={page}>{wrapScreen(withWebFallback(MOBILE_WORKSPACE_SCREENS[page.id], page.Component))}</CmCapabilityGate>}
          />
        ))}
        <Route
          path="projects/:projectId"
          element={<CmCapabilityGate page={PROJECTS_PAGE}>{wrapScreen(withWebFallback(MOBILE_WORKSPACE_SCREENS[PROJECT_DETAIL_SCREEN_ID], ProjectDetailWebPage))}</CmCapabilityGate>}
        />
        <Route element={<MobileAdminGate />}>
          {mobileAdminRoutes.map((page) => {
            const Screen = MOBILE_ADMIN_SCREENS[page.id];
            return <Route key={page.id} path={page.path} element={wrapScreen(<Screen />)} />;
          })}
        </Route>
      </Route>

      <Route element={<CmAccessGate>{wrapScreen(<AdminLayoutWeb />)}</CmAccessGate>}>
        {webAdminRoutes.map((page) => (
          <Route key={page.id} path={page.path} element={wrapScreen(<page.Component />)} />
        ))}
      </Route>

      <Route path="*" element={<Navigate to={CM_PUBLIC_ROUTE.home} replace />} />
    </Routes>
  );
};

export default CmMobileApp;
