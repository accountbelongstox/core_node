/**
 * AuthGuard – unified gate for login-required views.
 *
 * DESIGN (follow this style):
 * - When not logged in and requireAuth is true, we call onLoginRequest() in useEffect so the
 *   login modal opens immediately (no extra click). Parent must pass onLoginRequest that opens
 *   the global LoginModal (e.g. setShowLoginModal(true)).
 * - After login, isLoggedIn becomes true and children render; user sees the real page.
 * - openedRef ensures we only open the modal once per mount (e.g. when switching to another
 *   view and back, AuthGuard remounts and we open again if still not logged in).
 */

import React, { ReactNode, useEffect, useRef } from 'react';
import { useUser } from '../../hooks/useUser';
import { Language } from '../../types';

interface AuthGuardProps {
  children: ReactNode;
  lang?: Language;
  requireAuth?: boolean;
  /** Optional message for future placeholder; currently we render null so the login modal is the only UI. */
  fallbackMessage?: string;
  onLoginRequest?: () => void;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requireAuth = true,
  onLoginRequest
}) => {
  const { isLoggedIn } = useUser();
  const openedRef = useRef(false);

  useEffect(() => {
    if (!requireAuth || isLoggedIn) return;
    if (onLoginRequest && !openedRef.current) {
      openedRef.current = true;
      onLoginRequest();
    }
  }, [requireAuth, isLoggedIn, onLoginRequest]);

  if (!requireAuth || isLoggedIn) {
    return <>{children}</>;
  }

  // Do not render placeholder behind the login modal so the modal is the only visible UI (full-block).
  // Parent opens the global LoginModal on mount; when user closes it via Cancel, they see empty content until they log in or navigate away.
  return null;
};

export default AuthGuard;
