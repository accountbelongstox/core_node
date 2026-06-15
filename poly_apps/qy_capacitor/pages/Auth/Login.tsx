/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Button, Badge } from '../../components/UI';
import { AuthModel } from '../../models';
import { LanguageCenter } from '../../i18n/LanguageCenter';
import { StateManager, GlobalState } from '../../services/StateManager';
import { StorageCenter } from '../../services/StorageCenter';
import {
  AuthLayout,
  AuthInput,
  AuthError,
} from '../../components/Auth';

const LoginPage = () => {
  const { login, navigate } = useContext(AppContext);
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

  // Load saved credentials from StorageCenter
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const credentials = await StorageCenter.auth.getCredentials();
        if (credentials.username) {
          setUsername(credentials.username);
        }
        if (credentials.password) {
          setPassword(credentials.password);
        }
      } catch (error) {
        console.log('[Login] Failed to load saved credentials:', error);
      }
    };

    loadSavedCredentials();
  }, []);

  const handleLogin = async () => {
    if (loading) {
      return;
    }

    setError('');

    if (!username || !password) {
      setError(t('auth.usernameRequired') + ' / ' + t('auth.passwordRequired'));
      return;
    }

    // [Removed] Password length validation removed - no minimum requirement

    if (mode === 'register' && password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
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
          
          // Save credentials to StorageCenter (works on both web and native)
          try {
            await StorageCenter.auth.saveCredentials(username, password);
            console.log('[Login] Credentials saved to StorageCenter');
          } catch (error) {
            console.error('[Login] Failed to save credentials:', error);
          }
          
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
          
          // Save credentials to StorageCenter (works on both web and native)
          try {
            await StorageCenter.auth.saveCredentials(username, password);
            console.log('[Login] Credentials saved to StorageCenter');
          } catch (error) {
            console.error('[Login] Failed to save credentials:', error);
          }
          
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
    <AuthLayout
      title="WordFlow AI"
      subtitle={t('home.welcome')}
    >
      <div className="w-full sm:max-w-sm sm:mx-auto space-y-5">
        <AuthError message={error} />

        <AuthInput
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={t('auth.username')}
          disabled={loading}
          autoComplete="username"
        />

        {mode === 'register' && (
          <>
            <AuthInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email')}
              disabled={loading}
              autoComplete="email"
            />
            <AuthInput
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t('auth.nickname')}
              disabled={loading}
            />
            <AuthInput
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder={t('auth.inviteCode')}
              disabled={loading}
            />
            <AuthInput
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('auth.confirmPassword')}
              disabled={loading}
              autoComplete="new-password"
            />
          </>
        )}

        <AuthInput
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={t('auth.password')}
          disabled={loading}
          autoComplete="current-password"
        />

        {/* Forgot Password Link - Only show in login mode */}
        {mode === 'login' && (
          <div className="text-right">
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="ds-link-more text-sm font-semibold text-[var(--klein-blue)] transition-colors hover:opacity-80"
            >
              {t('auth.forgotPassword')}
            </button>
          </div>
        )}

        <Button variant="grad" onClick={handleLogin} disabled={loading}>
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

      <div className="mt-[var(--space-breath)] flex justify-center">
        <Badge tone="neutral">{t('common.info')}: Laravel API v1</Badge>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
