import React, { ReactNode } from 'react';
import { useUser } from '../../hooks/useUser';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { Lock, LogIn, ShieldAlert } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
  lang?: Language;
  requireAuth?: boolean;
  fallbackMessage?: string;
  onLoginRequest?: () => void;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  lang = 'en',
  requireAuth = true,
  fallbackMessage,
  onLoginRequest
}) => {
  const { isLoggedIn, user } = useUser();

  if (!requireAuth || isLoggedIn) {
    return <>{children}</>;
  }

  const t = TRANSLATIONS[lang];
  const defaultMessage = fallbackMessage || 'This page requires authentication. Please login to continue.';

  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <ShieldAlert className="text-white" size={40} />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
              Authentication Required
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm">
              {defaultMessage}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-4 py-2 rounded-lg">
            <Lock size={14} />
            <span>Protected Content</span>
          </div>

          {onLoginRequest && (
            <button
              onClick={onLoginRequest}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium py-3 px-6 rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <LogIn size={18} />
              Login to Access
            </button>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            If you don't have an account, you can register when logging in.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthGuard;
