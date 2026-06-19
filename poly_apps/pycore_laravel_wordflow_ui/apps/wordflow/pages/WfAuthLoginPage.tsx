import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useWfApp, useWfT } from '../WfAppContext';
import { Button, Badge } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import {
  WF_SUPPORTED_LANGUAGES,
  type WfSupportedLanguage,
} from '../../../core/api-libs/wordflow/wordflowLanguages';
import { notify } from '../../../core/notify/notify';

/** Normalize whatever /system/supported-languages returns into option rows. */
function normalizeLanguageOptions(raw: any): WfSupportedLanguage[] {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
  const out: WfSupportedLanguage[] = [];
  for (const item of list) {
    const code = typeof item?.code === 'string' ? item.code : '';
    if (!code) continue;
    out.push({
      code,
      name: typeof item?.name === 'string' && item.name ? item.name : code,
      native_name:
        typeof item?.native_name === 'string' && item.native_name ? item.native_name : item?.name || code,
      icon: typeof item?.icon === 'string' ? item.icon : undefined,
    });
  }
  return out;
}

const WfAuthLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, setUser } = useWfApp();
  const { t, lang } = useWfT();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Learning-language multi-select (register mode). Options come from the live
  // /system/supported-languages endpoint (mock or real); WF_SUPPORTED_LANGUAGES
  // is the offline fallback so the selector never renders empty. Default to the
  // shell language when it is a known catalog code, else English.
  const fallbackLang = WF_SUPPORTED_LANGUAGES.some((l) => l.code === lang) ? lang : 'en';
  const [languageOptions, setLanguageOptions] = useState<WfSupportedLanguage[]>(WF_SUPPORTED_LANGUAGES);
  const [learningLanguages, setLearningLanguages] = useState<string[]>([fallbackLang]);

  // Load the supported-language catalog once (cached by the API layer). Falls
  // back silently to the bundled list if the endpoint is unreachable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await wordflowApi.getSupportedLanguages();
        if (cancelled) return;
        const opts = normalizeLanguageOptions(raw);
        if (opts.length) setLanguageOptions(opts);
      } catch {
        // Keep the bundled WF_SUPPORTED_LANGUAGES fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleLearningLanguage = (code: string) => {
    setLearningLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

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
    if (mode === 'register' && learningLanguages.length === 0) {
      notify.error(t('auth.selectLanguageRequired'));
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
          learning_languages: learningLanguages,
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
    'w-full p-4 rounded-[var(--radius-button)] ds-glass ds-glass-edge border border-[var(--border-highlight)] outline-none text-[var(--color-text-primary)] transition-all disabled:opacity-50 focus:shadow-[0_0_0_3px_var(--klein-ring)] focus:border-white/50 bg-white/5 dark:bg-white/[0.03] placeholder-slate-400 dark:placeholder-slate-500';

  return (
    <div
      className="flex flex-col min-h-screen bg-transparent route-fade"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-[var(--page-padding-h)] py-[var(--page-padding-v)] pt-16">
        {/* Gradient logo block */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, opacity: 1, rotate: 6 }}
          transition={{ type: 'spring', damping: 15 }}
          className="w-24 h-24 rounded-[var(--radius-card)] mb-10 flex items-center justify-center text-4xl font-black shadow-2xl relative overflow-hidden group cursor-pointer"
          style={{ background: 'var(--klein-gradient)', color: 'var(--klein-on)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          {/* Internal specular highlight */}
          <div className="absolute inset-0 bg-white/20 -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          W
        </motion.div>

        <motion.h1
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="ds-section-title !text-3xl mb-2 text-center font-black tracking-tight"
        >
          WordFlow AI
        </motion.h1>

        <motion.p
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-[var(--color-text-secondary)] mb-[var(--space-breath)] text-center text-sm font-medium"
        >
          {t('home.welcome')}
        </motion.p>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="w-full ds-modal-panel p-6 sm:p-8 max-w-md shadow-2xl"
        >
          <div className="w-full space-y-5">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              /* Login accepts any identifier — username, email, or phone (the
               * backend matches on all three); register treats it as the raw
               * username. Never constrained to email format. */
              placeholder={mode === 'login' ? t('auth.usernameOrEmail') : t('auth.username')}
              disabled={loading}
              autoComplete="username"
              className={inputClass}
            />

            {mode === 'register' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="space-y-5 overflow-hidden"
              >
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

                {/* Learning-language multi-select — chip toggles sourced from
                    /system/supported-languages (backend-aligned catalog). */}
                <div>
                  <div className="flex items-baseline justify-between mb-2 px-1">
                    <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {t('auth.learningLanguages')}
                    </label>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {t('auth.learningLanguagesHint')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-1">
                    {languageOptions.map((opt) => {
                      const active = learningLanguages.includes(opt.code);
                      return (
                        <button
                          key={opt.code}
                          type="button"
                          disabled={loading}
                          onClick={() => toggleLearningLanguage(opt.code)}
                          aria-pressed={active}
                          className={[
                            'px-3 py-2 rounded-full text-sm font-medium border transition-all disabled:opacity-50',
                            active
                              ? 'text-[var(--klein-on)] border-transparent shadow-[var(--klein-grad-glow)]'
                              : 'ds-glass ds-glass-edge border-[var(--border-highlight)] text-[var(--color-text-primary)] hover:border-white/50',
                          ].join(' ')}
                          style={active ? { background: 'var(--klein-gradient)' } : undefined}
                        >
                          {opt.native_name}
                          {opt.native_name !== opt.name ? (
                            <span className="opacity-70"> · {opt.name}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
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
              <motion.input
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
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

            <Button variant="grad" onClick={handleSubmit} loading={loading}>
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
        </motion.div>
      </div>
    </div>
  );
};

export default WfAuthLoginPage;
