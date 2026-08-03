/**
 * AuthGuard – unified gate for login-required views.
 *
 * DESIGN (follow this style):
 * - When not logged in and requireAuth is true, the central auth request opens
 *   the global LoginModal immediately.
 * - Children remain mounted and visible behind the modal so protected panels do
 *   not disappear while authentication is pending.
 * - openedRef ensures we only open the modal once per mount (e.g. when switching to another
 *   view and back, AuthGuard remounts and we open again if still not logged in).
 */

import React, { ReactNode, useEffect, useRef } from 'react';
import { useUser } from '../../hooks/useUser';
import { isDebugAuthBypass } from '../../config/auth';
import { requestAuthLogin } from '../../core/auth/AuthRequestCenter';

interface AuthGuardProps {
  children: ReactNode;
  requireAuth?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requireAuth = true,
}) => {
  const { isLoggedIn } = useUser();
  const openedRef = useRef(false);

  // Loopback DEBUG bypass: when the backend reports debug_mode (request came
  // from 127.0.0.1), treat the user as authenticated everywhere — render the
  // protected content and never open the login modal.
  const debugBypass = isDebugAuthBypass();
  const authed = isLoggedIn || debugBypass;

  useEffect(() => {
    if (!requireAuth || authed) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    requestAuthLogin({ source: 'auth-guard', reason: 'protected-view' });
  }, [requireAuth, authed]);

  return <>{children}</>;
};

export default AuthGuard;
