/* [v4.1-Iris] useWfProtectedAction — unified auth guard for user-only actions.
 * Replicates qy_capacitor's handleProtectedAction (Dashboard/Home.tsx) with a
 * Sheet-based confirm instead of window.confirm: logged-in users run the action
 * directly; anonymous users get a portal/z-scale-compliant bottom Sheet
 * ("Login Required" → navigate to wfPath('auth/login')).
 *
 * Usage:
 *   const { runProtected, loginConfirmSheet } = useWfProtectedAction();
 *   <button onClick={() => runProtected(() => doAuthThing())} />
 *   ...
 *   {loginConfirmSheet}   // render once near the page root
 */
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button, Sheet } from '../WfUI';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';

export interface WfProtectedAction {
  /** True when a user session is active (actions run immediately). */
  isAuthenticated: boolean;
  /** Run `action` if logged in, otherwise open the login-required Sheet. */
  runProtected: (action: () => void) => void;
  /** The login-required confirm Sheet — render it once in the page tree. */
  loginConfirmSheet: React.ReactNode;
}

export function useWfProtectedAction(): WfProtectedAction {
  const navigate = useNavigate();
  const { isAuthenticated, t } = useWfApp();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runProtected = useCallback(
    (action: () => void) => {
      if (isAuthenticated) {
        action();
      } else {
        setConfirmOpen(true);
      }
    },
    [isAuthenticated]
  );

  const loginConfirmSheet = (
    <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} position="bottom">
      <div className="flex flex-col items-center text-center gap-3 pb-2">
        <div className="w-14 h-14 rounded-full bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)]">
          <Lock className="w-6 h-6" aria-hidden />
        </div>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
          {t('home.loginRequired') || 'Login Required'}
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-xs leading-relaxed">
          {t('home.accountRequired') || 'Account required for this feature. Login now?'}
        </p>
        <div className="flex gap-3 w-full mt-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmOpen(false)}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button
            variant="grad"
            className="flex-1"
            onClick={() => {
              setConfirmOpen(false);
              navigate(wfPath('auth/login'));
            }}
          >
            {t('auth.login') || 'Login'}
          </Button>
        </div>
      </div>
    </Sheet>
  );

  return { isAuthenticated, runProtected, loginConfirmSheet };
}

export default useWfProtectedAction;
