import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useAuthSession } from '../../../../core/auth/useAuthSession';
import { closeTopMobileOverlay } from '../ui/useMobileOverlay';
import { MOBILE_HOME_PATH, MOBILE_WELCOME_PATH } from './mobileRoutes';

const HISTORY_INDEX_KEY = 'idx';

/**
 * Android hardware back button (native only): close the open sheet or drawer,
 * else step back in the app history, else return to the home screen, else leave the app.
 */
export function useMobileBackButton(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const authenticated = useAuthSession();
  const stateRef = useRef({ pathname: location.pathname, authenticated });
  stateRef.current = { pathname: location.pathname, authenticated };

  useEffect(() => {
    let cancelled = false;
    let remove: (() => Promise<void>) | null = null;
    try {
      if (!Capacitor.isNativePlatform()) return undefined;
    } catch {
      return undefined;
    }
    void App.addListener('backButton', () => {
      if (closeTopMobileOverlay()) return;
      const { pathname, authenticated: signedIn } = stateRef.current;
      const home = signedIn ? MOBILE_HOME_PATH : MOBILE_WELCOME_PATH;
      const historyIndex = Number((window.history.state as Record<string, unknown> | null)?.[HISTORY_INDEX_KEY] ?? 0);
      const atHome = pathname.replace(/\/+$/, '') === home;
      if (atHome) {
        void App.exitApp();
      } else if (historyIndex > 0) {
        navigate(-1);
      } else {
        navigate(home, { replace: true });
      }
    }).then((handle) => {
      if (cancelled) void handle.remove();
      else remove = () => handle.remove();
    });
    return () => {
      cancelled = true;
      if (remove) void remove();
    };
  }, [navigate]);
}
