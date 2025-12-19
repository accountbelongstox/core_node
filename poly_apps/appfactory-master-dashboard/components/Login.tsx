
import React, { useState } from 'react';
import { UserRole } from '../types';
import { useApp } from '../contexts/AppContext';
import { Zap, Mail, Lock, ShieldCheck, Headphones, Code, Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../services/i18nService';
import { authService, BUILTIN_ACCOUNTS } from '../services/authService';

export const Login: React.FC = () => {
  const { t, login, language, setLanguage } = useApp();
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.ADMIN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 根据选择的角色，自动填充示例账号
  const getExampleAccount = () => {
    const accounts = Object.values(BUILTIN_ACCOUNTS).filter(acc => acc.role === activeRole);
    return accounts[0];
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authService.login({
        email: email || getExampleAccount()?.email || '',
        password: password || getExampleAccount()?.password || '',
        role: activeRole,
      });

      if (result.success && result.user && result.token) {
        login(result.user, result.token);
      } else {
        setError(result.error || t('login.loginFailed'));
      }
    } catch (err: any) {
      setError(err.message || t('login.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 快速登录按钮
  const handleQuickLogin = (accountEmail: string, accountPassword: string) => {
    setEmail(accountEmail);
    setPassword(accountPassword);
  };

  const roles = [
    { id: UserRole.ADMIN, label: t('login.admin'), icon: <ShieldCheck size={20} /> },
    { id: UserRole.CS, label: t('login.cs'), icon: <Headphones size={20} /> },
    { id: UserRole.TECH, label: t('login.tech'), icon: <Code size={20} /> },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 transition-colors">
      <div className="w-full max-w-md">
        {/* Language Selector */}
        <div className="absolute top-4 right-4">
          <div className="relative">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 pr-10 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
            <Globe className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-500/30 mb-4">
            <Zap size={32} fill="currentColor" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('app.name')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">{t('login.subtitle')}</p>
        </div>

        {/* Role Tabs */}
        <div className="bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 flex gap-1">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeRole === role.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {role.icon}
              {role.label}
            </button>
          ))}
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                账号
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={getExampleAccount()?.email || '请输入账号（如：123）'}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('login.password')}
                </label>
                <button type="button" className="text-xs text-indigo-600 hover:text-indigo-500 font-medium">
                  {t('login.forgotPassword')}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 ml-1">
              <input
                type="checkbox"
                id="remember"
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="remember" className="text-sm text-slate-600 dark:text-slate-400">
                {t('login.rememberMe')}
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/25 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : t('login.signIn')}
            </button>

            {/* 快速登录提示 */}
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p className="font-medium">{t('login.quickLogin')}:</p>
              <div className="flex flex-wrap gap-2">
                {Object.values(BUILTIN_ACCOUNTS)
                  .filter(acc => acc.role === activeRole)
                  .slice(0, 2)
                  .map(acc => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleQuickLogin(acc.email, acc.password)}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      {acc.name}
                    </button>
                  ))}
              </div>
            </div>
          </form>

          {/* Role Info Footer */}
          <div className="px-8 py-4 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700 flex justify-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              {t('login.accessingAs')}: <span className="font-bold text-indigo-600 dark:text-indigo-400">{activeRole.toUpperCase()}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

