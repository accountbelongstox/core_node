import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAuthToken } from '../../../core/auth/AuthSession';
import { CM_PUBLIC_ROUTE } from '../components/public-home/cmPublicRoutes';
import { cmAuthApi } from './CmAuthApi';
import { cmClearReturnPath } from './cmAuthSession';

const SESSION_CLEAR_FALLBACK_MS = 1500;

export interface CmSignOutState {
  signOut: () => Promise<void>;
  signingOut: boolean;
}

/**
 * Revoke the server token and return to the public home. The local session is
 * cleared once the protected layout has unmounted, so the access gate does not
 * redirect the leaving visitor to the sign-in page.
 */
export function useCmSignOut(): CmSignOutState {
  const navigate = useNavigate();
  const signedOutRef = useRef(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => () => {
    if (signedOutRef.current) setAuthToken(null);
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    setSigningOut(true);
    await cmAuthApi.logout();
    cmClearReturnPath();
    signedOutRef.current = true;
    navigate(CM_PUBLIC_ROUTE.home, { replace: true });
    window.setTimeout(() => setAuthToken(null), SESSION_CLEAR_FALLBACK_MS);
  }, [navigate]);

  return { signOut, signingOut };
}
