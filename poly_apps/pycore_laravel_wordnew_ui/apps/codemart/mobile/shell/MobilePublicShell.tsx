import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Compass, House, LogIn, Settings2 } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CmBrand } from '../../components/CmBrand';
import { CM_PUBLIC_ROUTE } from '../../components/public-home/cmPublicRoutes';
import { MobileChromeProvider, useMobileChromeState } from '../ui/mobileChrome';
import { MobileSheet } from '../ui/MobileSheet';
import { MobileAppBar } from './MobileAppBar';
import { MobilePreferences } from './MobilePreferences';
import { MobileScroll } from './MobileScroll';
import { MobileTabBar } from './MobileTabBar';

const AUTH_PATHS: readonly string[] = [CM_PUBLIC_ROUTE.login, CM_PUBLIC_ROUTE.register, CM_PUBLIC_ROUTE.forgotPassword, CM_PUBLIC_ROUTE.passwordReset];

/** Signed-out app frame: brand bar with language and theme, bottom tabs Welcome, Showcase and Sign in. */
export const MobilePublicShell: React.FC = () => {
  const { t } = useTranslation('cm');
  const chrome = useMobileChromeState();
  const [prefsOpen, setPrefsOpen] = useState(false);

  return (
    <MobileChromeProvider value={chrome}>
      <div className="cmm-shell" data-end="codemart-mobile">
        <MobileAppBar
          title={chrome.title ?? t('brand.name')}
          leading="none"
          onLeading={() => undefined}
          setActionsSlot={chrome.setActionsSlot}
          brand={<span className="cmm-appbar__brand"><CmBrand compact /></span>}
        />
        <MobileScroll><Outlet /></MobileScroll>
        <MobileTabBar
          label={t('mobile.shell.tabs')}
          tabs={[
            { id: 'welcome', path: CM_PUBLIC_ROUTE.home, exact: true, label: t('mobile.tabs.welcome'), Icon: House },
            { id: 'showcase', path: CM_PUBLIC_ROUTE.showcase, label: t('mobile.tabs.showcase'), Icon: Compass },
            { id: 'login', path: CM_PUBLIC_ROUTE.login, activePaths: AUTH_PATHS, label: t('nav.login'), Icon: LogIn },
            { id: 'prefs', label: t('mobile.shell.preferences'), Icon: Settings2, onClick: () => setPrefsOpen(true) },
          ]}
        />
        <MobileSheet open={prefsOpen} onClose={() => setPrefsOpen(false)} title={t('mobile.shell.preferences')}>
          <MobilePreferences />
        </MobileSheet>
      </div>
    </MobileChromeProvider>
  );
};
