import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CmBootstrapRefreshNotice } from '../../components/access/CmBootstrapRefreshNotice';
import { CM_PROTECTED_ROUTE } from '../../components/public-home/cmPublicRoutes';
import { MobileChromeProvider, useMobileChromeState } from '../ui/mobileChrome';
import { MobileAppBar } from './MobileAppBar';
import { MobileDrawer } from './MobileDrawer';
import { MobileScroll } from './MobileScroll';
import { MobileTabBar } from './MobileTabBar';
import { isMobileRootPath, mobilePageForPath } from './mobileRoutes';
import { useMobileTabs } from './mobileTabs';

const HISTORY_INDEX_KEY = 'idx';

/** Signed-in app frame: top bar with drawer menu, scrolling content, bottom tab bar. */
export const MobileShell: React.FC = () => {
  const { t } = useTranslation('cm');
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = useMobileTabs();
  const chrome = useMobileChromeState();
  const [menuOpen, setMenuOpen] = useState(false);
  const rootPaths = tabs.map((tab) => tab.path);
  const isRoot = isMobileRootPath(location.pathname, rootPaths);
  const page = mobilePageForPath(location.pathname);

  useEffect(() => {
    setMenuOpen(false);
    chrome.scrollRef.current?.scrollTo({ top: 0 });
  }, [location.pathname, chrome.scrollRef]);

  const goBack = (): void => {
    const canGoBack = Number((window.history.state as Record<string, unknown> | null)?.[HISTORY_INDEX_KEY] ?? 0) > 0;
    if (canGoBack) navigate(-1);
    else navigate(CM_PROTECTED_ROUTE.dashboard, { replace: true });
  };

  return (
    <MobileChromeProvider value={chrome}>
      <div className="cmm-shell" data-end="codemart-mobile">
        <MobileAppBar
          title={chrome.title ?? (page ? t(page.labelKey) : t('brand.name'))}
          leading={isRoot ? 'menu' : 'back'}
          onLeading={isRoot ? () => setMenuOpen(true) : goBack}
          setActionsSlot={chrome.setActionsSlot}
        />
        <MobileScroll>
          <CmBootstrapRefreshNotice />
          <Outlet />
        </MobileScroll>
        <MobileTabBar tabs={tabs.map((tab) => ({ id: tab.id, path: tab.path, label: t(tab.labelKey), Icon: tab.Icon, badge: tab.badge }))} label={t('mobile.shell.tabs')} />
        <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} tabPageIds={tabs.map((tab) => tab.pageId)} />
      </div>
    </MobileChromeProvider>
  );
};
