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
        <div className="relative flex items-center justify-center mb-1">
          <span className="ds-loading-aura absolute w-14 h-14 opacity-25" aria-hidden />
          <span className="ds-empty-icon relative w-16 h-16 rounded-full ds-glass ds-glass-edge flex items-center justify-center text-[var(--klein-blue)]">
            <Lock className="w-7 h-7" aria-hidden />
          </span>
        </div>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
          {t('home.loginRequired') || 'Login Required'}
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-xs leading-relaxed">
          {t('home.accountRequired') || 'Account required for this feature. Login now?'}
        </p>
        <div className="flex gap-3 w-full mt-3">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmOpen(false)}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button
            variant="grad"
            className="flex-1"
            icon={<Lock />}
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
