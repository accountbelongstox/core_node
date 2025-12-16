import React, { useState, useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Button } from '../../components/UI';
import { AuthModel } from '../../models';
import { LanguageCenter } from '../../i18n/LanguageCenter';
import { StateManager, GlobalState } from '../../services/StateManager';

const LoginPage = () => {
  const { login } = useContext(AppContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const t = (key: string) => LanguageCenter.t(key);

  const handleLogin = async () => {
    if (loading) {
      return;
    }

    setError('');

    if (!username || !password) {
      setError(t('auth.usernameRequired') + ' / ' + t('auth.passwordRequired'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError(t('auth.passwordMismatch') || 'Passwords do not match');
      return;
    }

    setLoading(true);
    StateManager.set(GlobalState.IS_LOADING, true);

    try {
      if (mode === 'login') {
        console.log('[Login] Calling AuthModel.login...');
        const result = await AuthModel.login({ username, password });

        console.log('[Login] AuthModel.login returned:', result);
        console.log('[Login] result.success:', result.success);
        console.log('[Login] result.user:', result.user);

        if (result.success && result.user) {
          console.log('[Login] Login successful, calling AppContext.login()');
          StateManager.set(GlobalState.USER, result.user);
          StateManager.set(GlobalState.IS_LOGGED_IN, true);
          login(result.user);
          console.log('[Login] AppContext.login() called');
        } else {
          console.log('[Login] Login failed:', result.error);
          setError(result.error?.message || t('auth.invalidCredentials'));
          StateManager.set(GlobalState.ERROR_MESSAGE, result.error?.message);
        }
      } else {
        const result = await AuthModel.register({
          username,
          password,
          password_confirmation: confirmPassword,
          email: email || undefined,
          nickname: nickname || undefined,
          invite_code: inviteCode || undefined,
        });

        if (result.success && result.user) {
          StateManager.set(GlobalState.USER, result.user);
          StateManager.set(GlobalState.IS_LOGGED_IN, true);
          login(result.user);
        } else {
          const errorCode = result.error?.code || '';
          let errorMessage = result.error?.message || t('auth.registerFailed');
          
          // Map error codes to localized messages
          if (errorCode === 'EMAIL_EXISTS') {
            errorMessage = t('auth.emailExists');
          } else if (errorCode === 'USERNAME_EXISTS') {
            errorMessage = t('auth.usernameExists');
          } else if (errorCode === 'PHONE_EXISTS') {
            errorMessage = t('auth.phoneExists');
          } else if (errorCode === 'INVITE_CODE_INVALID') {
            errorMessage = t('auth.inviteCodeInvalid');
          } else if (errorCode === 'INVITE_CODE_EXPIRED') {
            errorMessage = t('auth.inviteCodeExpired');
          } else if (errorMessage && !errorMessage.includes('auth.')) {
            // Use backend message if it's not a translation key
            errorMessage = result.error?.message || t('auth.registrationFailed');
          }
          
          setError(errorMessage);
          StateManager.set(GlobalState.ERROR_MESSAGE, errorMessage);
        }
      }
    } catch (err: any) {
      const errorMsg = err.message || (mode === 'login' ? t('auth.loginFailed') : t('auth.registerFailed'));
      setError(errorMsg);
      StateManager.set(GlobalState.ERROR_MESSAGE, errorMsg);
    } finally {
      setLoading(false);
      StateManager.set(GlobalState.IS_LOADING, false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleLogin();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 animate-fade-in">
      <div className="w-24 h-24 bg-gradient-to-tr from-blue-400 to-purple-500 rounded-3xl shadow-2xl mb-8 flex items-center justify-center text-4xl text-white font-bold transform rotate-6 animate-blob">
        W
      </div>
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">WordFlow AI</h1>
      <p className="text-slate-500 dark:text-slate-300 mb-10 text-center">
        {t('home.welcome')}
      </p>

      <div className="w-full max-w-sm space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={t('auth.username')}
          disabled={loading}
          className="w-full p-4 rounded-xl glass-panel bg-white/40 dark:bg-black/20 outline-none focus:ring-2 ring-blue-400 dark:text-white transition-all disabled:opacity-50"
          autoComplete="username"
        />

        {mode === 'register' && (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email') || 'Email (optional)'}
              disabled={loading}
              className="w-full p-4 rounded-xl glass-panel bg-white/40 dark:bg-black/20 outline-none focus:ring-2 ring-blue-400 dark:text-white transition-all disabled:opacity-50"
              autoComplete="email"
            />
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t('auth.nickname') || 'Nickname (optional)'}
              disabled={loading}
              className="w-full p-4 rounded-xl glass-panel bg-white/40 dark:bg-black/20 outline-none focus:ring-2 ring-blue-400 dark:text-white transition-all disabled:opacity-50"
            />
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder={t('auth.inviteCode') || 'Invite Code (optional)'}
              disabled={loading}
              className="w-full p-4 rounded-xl glass-panel bg-white/40 dark:bg-black/20 outline-none focus:ring-2 ring-blue-400 dark:text-white transition-all disabled:opacity-50"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('auth.confirmPassword') || 'Confirm Password'}
              disabled={loading}
              className="w-full p-4 rounded-xl glass-panel bg-white/40 dark:bg-black/20 outline-none focus:ring-2 ring-blue-400 dark:text-white transition-all disabled:opacity-50"
              autoComplete="new-password"
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
          className="w-full p-4 rounded-xl glass-panel bg-white/40 dark:bg-black/20 outline-none focus:ring-2 ring-blue-400 dark:text-white transition-all disabled:opacity-50"
          autoComplete="current-password"
        />
        <Button onClick={handleLogin} disabled={loading}>
          {loading ? t('common.loading') : mode === 'login' ? t('auth.login') : t('auth.register')}
        </Button>
        <Button
          variant="ghost"
          disabled={loading}
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
        >
          {mode === 'login' ? t('auth.register') : t('auth.login')}
        </Button>
      </div>

      <div className="mt-8 text-xs text-slate-400">
        {t('common.info')}: Laravel API v1 (Real Backend)
      </div>
    </div>
  );
};

export default LoginPage;
