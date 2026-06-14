/* [v4.1-Iris] Login — ported from poly_apps/qy_capacitor/pages/Auth/Login.tsx.
 * Self-contained: wires to useWfApp().login (wordflowApi) and react-router
 * useNavigate + wfPath(). Login/register dual mode faithful to the original:
 * register posts username+password plus optional email/nickname/invite code to
 * wordflowApi.register() (the backend returns the login envelope, so a
 * successful registration logs the user straight in via setToken + setUser).
 * Graceful error messages, keeps the faithful Iris auth look (gradient logo
 * block + glass panel inputs). */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWfApp, useWfT } from '../WfAppContext';
import { Button, Badge } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { notify } from '../../../core/notify/notify';

const WfAuthLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, setUser } = useWfApp();
  const { t } = useWfT();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  /** Map register-mode backend errors to localized messages (original Login.tsx
   * error-code branches, keyed off the verified backend message strings). */
  const registerErrorMessage = (err: any): string => {
    const backendMsg = typeof err?.message === 'string' ? err.message : '';
    if (err?.status === 400) {
      if (/username already exists/i.test(backendMsg)) {
        return t('auth.usernameExists') || 'Username already exists';
      }
      if (/email already exists/i.test(backendMsg)) {
        return t('auth.emailExists') || 'Email already exists';
      }
      if (/invalid invite code/i.test(backendMsg)) {
        return t('auth.inviteCodeInvalid') || 'Invalid invite code';
      }
      if (/invite code is expired|already used/i.test(backendMsg)) {
        return t('auth.inviteCodeExpired') || 'Invite code is expired or already used';
      }
    }
    if (backendMsg && !/^API Error/i.test(backendMsg)) return backendMsg;
    return t('auth.registerFailed') || 'Registration failed';
  };

  const handleSubmit = async () => {
    if (loading) return;

    // All login/register feedback goes through the global toaster (core/notify).
    if (!username || !password) {
      notify.error(t('auth.usernameRequired') + ' / ' + t('auth.passwordRequired'));
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      notify.error(t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username, password);
        notify.success(t('auth.loginSuccess'));
      } else {
        // Mirrors WfAppContext.login (which is login-endpoint specific, left
        // untouched): call the API, persist the Bearer token, store the user.
        // Nickname is auto-generated server-side (Haikunator) and editable later
        // in Profile, so the form intentionally does not collect it.
        const result = await wordflowApi.register({
          username,
          password,
          email: email || undefined,
          invite_code: inviteCode || undefined,
        });
        if (result?.token) wordflowApi.setToken(result.token);
        if (result?.user) setUser(result.user);
        notify.success(t('auth.registerSuccess'));
      }
      navigate(wfPath(''));
    } catch (err: any) {
      if (mode === 'register') {
        notify.error(registerErrorMessage(err));
      } else {
        // request() attaches the HTTP status and the parsed backend body to the
        // error; err.message carries the backend's `message` when available.
        const backendMsg =
          typeof err?.message === 'string' && err.message && !/^API Error/i.test(err.message)
            ? err.message
            : '';
        notify.error(
          err?.status === 422
            ? (t('auth.invalidCredentials') || backendMsg)
            : (backendMsg || t('auth.invalidCredentials'))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const inputClass =
    'w-full p-4 rounded-[var(--radius-button)] ds-glass ds-glass-edge border border-[var(--border-highlight)] outline-none text-[var(--color-text-primary)] transition-all disabled:opacity-50 focus:shadow-[0_0_0_3px_var(--klein-ring)]';

  return (
    <div
      className="flex flex-col min-h-screen bg-transparent route-fade"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-[var(--page-padding-h)] py-[var(--page-padding-v)] pt-16 animate-fade-in">
        {/* Gradient logo block */}
        <div
          className="w-24 h-24 rounded-[var(--radius-card)] mb-10 flex items-center justify-center text-4xl font-bold transform rotate-6"
          style={{ background: 'var(--klein-gradient)', color: 'var(--klein-on)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          W
        </div>
        <h1 className="ds-section-title !text-3xl mb-2 text-center">WordFlow AI</h1>
        <p className="text-[var(--color-text-secondary)] mb-[var(--space-breath)] text-center">
          {t('home.welcome')}
        </p>

        <div className="w-full ds-modal-panel p-6 sm:p-8 max-w-md">
          <div className="w-full space-y-5">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('auth.username')}
              disabled={loading}
              autoComplete="username"
              className={inputClass}
            />

            {mode === 'register' && (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`${t('auth.email')} (${t('common.optional') || 'optional'})`}
                  disabled={loading}
                  autoComplete="email"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t('auth.inviteCode')}
                  disabled={loading}
                  className={inputClass}
                />
              </>
            )}

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('auth.password')}
              disabled={loading}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className={inputClass}
            />

            {mode === 'register' && (
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t('auth.confirmPassword')}
                disabled={loading}
                autoComplete="new-password"
                className={inputClass}
              />
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => navigate(wfPath('auth/forgot-password'))}
                  className="ds-link-more text-sm font-semibold text-[var(--klein-blue)] transition-colors hover:opacity-80"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
            )}

            <Button variant="grad" onClick={handleSubmit} disabled={loading}>
              {loading ? t('common.loading') : mode === 'login' ? t('auth.login') : t('auth.register')}
            </Button>
            <Button
              variant="ghost"
              disabled={loading}
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? t('auth.register') : t('auth.login')}
            </Button>
          </div>

          <div className="mt-[var(--space-breath)] flex justify-center">
            <Badge tone="neutral">{t('common.info')}: Laravel API v1</Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WfAuthLoginPage;
