import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Mail, User, Shield, Sparkles, Languages, Compass, ArrowRight,
  ChevronRight, CheckCircle2, UserPlus, LogIn, Heart, Star, LogOut
} from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import { wfNewApi, type WfNewAuthUser } from '../api';

interface WfNewAuthProps {
  activeTheme: ElementTheme;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onLoginSuccess: (userData: { nickname: string; avatar: string; email: string; nativeLang: string; targetLang: string; bio: string; isLoggedIn: boolean }) => void;
  currentUser: {
    nickname: string;
    avatar: string;
    email: string;
    nativeLang: string;
    targetLang: string;
    bio: string;
    isLoggedIn: boolean;
  };
  onLogout: () => void;
}

export const WfNewAuth: React.FC<WfNewAuthProps> = ({ 
  activeTheme,
  addToast,
  trans,
  onLoginSuccess,
  currentUser,
  onLogout
}) => {
  const [isLoginView, setIsLoginView] = useState(true);

  // Form Field Inputs
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('Expanding my cognitive neural horizon in WordFlow.');
  const [nativeLang, setNativeLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('en');
  const [submitting, setSubmitting] = useState(false);

  // Avatar Options
  const AVATAR_POOL = ['🦁', '🦊', '🐈', '🐼', '🐰', '🐯', '🦉', '🛸', '🚀', '👾'];

  /** Deterministic avatar emoji for a backend user that has no emoji of its own. */
  const pickEmoji = (seed: string): string => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return AVATAR_POOL[hash % AVATAR_POOL.length];
  };

  /** True only for a short emoji string (NOT a backend avatar path / data URL). */
  const looksLikeEmoji = (v?: string): boolean =>
    !!v && v.length <= 6 && !/[a-z0-9]/i.test(v) && !v.includes('/') && !v.startsWith('http');

  /** True for an absolute image URL (http/https/data). */
  const looksLikeImageUrl = (v?: string): boolean => !!v && (/^https?:\/\//i.test(v) || v.startsWith('data:'));

  /**
   * Map the backend-aligned auth user onto the app's session profile shape. The
   * avatar resolves to the backend's AUTO-GENERATED / uploaded image when it has
   * a usable absolute URL (avatar_url); otherwise an existing emoji is kept, or a
   * deterministic emoji is derived from the username so the chip is never blank.
   */
  const toSessionProfile = (
    user: WfNewAuthUser,
    fallback: { email?: string; nativeLang?: string; targetLang?: string; bio?: string }
  ) => {
    const resolvedEmail = user.email || fallback.email || '';
    const nick =
      user.nickname || user.name || user.username ||
      (resolvedEmail.includes('@') ? resolvedEmail.split('@')[0] : '') || 'Cadet';
    let avatar: string;
    if (looksLikeImageUrl(user.avatar_url)) avatar = user.avatar_url as string;
    else if (looksLikeImageUrl(user.avatar)) avatar = user.avatar as string;
    else if (looksLikeEmoji(user.avatar)) avatar = user.avatar as string;
    else avatar = pickEmoji(user.username || resolvedEmail || nick);
    return {
      nickname: nick,
      avatar,
      email: resolvedEmail,
      nativeLang: user.native_language || fallback.nativeLang || 'zh',
      targetLang: (user.learning_languages && user.learning_languages[0]) || fallback.targetLang || 'en',
      bio: user.bio || fallback.bio || 'Linguistic coordinates locked.',
      isLoggedIn: true,
    };
  };

  /** Surface a backend/mock error message, falling back to a localized default. */
  const authErrorMessage = (err: any): string => {
    const msg = typeof err?.message === 'string' ? err.message : '';
    if (msg && !/^HTTP \d+/.test(msg)) return msg;
    return trans('auth.authFailed');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    // Username may be any identifier (username / email / phone) — never email-only.
    if (!username || !password) {
      addToast(trans('auth.needUserPass'), 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const { user } = await wfNewApi.login(username.trim(), password);
      const profile = toSessionProfile(user, {});
      onLoginSuccess(profile);
      addToast(trans('auth.welcomeBack', { name: profile.nickname }), 'success');
    } catch (err) {
      addToast(authErrorMessage(err), 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    // Username + password required; email is OPTIONAL; passwords must match.
    if (!username || !password) {
      addToast(trans('auth.needUserPass'), 'warning');
      return;
    }
    if (password !== confirmPassword) {
      addToast(trans('auth.passwordMismatch'), 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const { user } = await wfNewApi.register({
        username: username.trim(),
        password,
        email: email.trim() || undefined,
        nickname: nickname.trim() || undefined,
        native_language: nativeLang,
        // Target study language drives the backend's learning_languages set.
        learning_languages: [targetLang],
        bio,
        // No avatar sent — the backend auto-generates one; the UI derives an emoji.
      });
      const profile = toSessionProfile(user, { email: email.trim(), nativeLang, targetLang, bio });
      onLoginSuccess(profile);
      addToast(trans('auth.registered'), 'success');
    } catch (err) {
      addToast(authErrorMessage(err), 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto relative z-10 py-6">
      
      <AnimatePresence mode="wait">
        
        {/* VIEW A: User already logged in */}
        {currentUser.isLoggedIn ? (
          <motion.div
            key="logged-in-panel"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`p-6 sm:p-8 rounded-3xl ${activeTheme.cardClass} shadow-2xl border border-white/5 space-y-6 text-center`}
          >
            <div className="relative inline-block">
              <span className="text-6xl p-2 select-none filter drop-shadow-md block">
                {currentUser.avatar}
              </span>
              <span className="absolute bottom-1 right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border border-slate-900"></span>
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-slate-100 flex items-center justify-center gap-1.5">
                {currentUser.nickname}
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono tracking-wide">{currentUser.email}</p>
              <p className="text-xs text-zinc-500 italic px-4 font-serif">"{currentUser.bio}"</p>
            </div>

            {/* Language profile coordinates summary */}
            <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto py-3.5 bg-slate-900/40 rounded-2xl border border-white/5">
              <div className="text-center">
                <span className="text-[9px] text-zinc-500 font-mono block uppercase">{trans('auth.nativeTongue')}</span>
                <span className="text-xs font-bold text-indigo-400 uppercase font-mono">{currentUser.nativeLang}</span>
              </div>
              <div className="text-center border-l border-white/5">
                <span className="text-[9px] text-zinc-500 font-mono block uppercase">{trans('auth.targetStudy')}</span>
                <span className="text-xs font-bold text-amber-400 uppercase font-mono">{currentUser.targetLang}</span>
              </div>
            </div>

            {/* Account Management badges */}
            <div className="flex flex-wrap justify-center gap-1.5 pt-2">
              <span className="text-[8px] font-black font-mono tracking-widest bg-emerald-500/10 text-emerald-400 py-0.5 px-2 rounded-full uppercase">
                {trans('auth.badgeVerified')}
              </span>
              <span className="text-[8px] font-black font-mono tracking-widest bg-indigo-500/10 text-indigo-400 py-0.5 px-2 rounded-full uppercase">
                {trans('auth.badgePioneer')}
              </span>
            </div>

            {/* Action buttons */}
            <div className="pt-4 space-y-2.5">
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-white/2 border border-white/5 text-zinc-400 text-[10px] justify-center font-mono">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{trans('auth.syncedNote')}</span>
              </div>

              <button
                onClick={onLogout}
                className="w-full py-3 rounded-2xl bg-zinc-800 hover:bg-red-950/40 text-red-400 hover:text-red-300 transition-all font-mono text-xs font-black uppercase tracking-wider cursor-pointer border border-zinc-700/50 flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>{trans('auth.logout')}</span>
              </button>
            </div>
          </motion.div>
        ) : (
          /* VIEW B: Login / Register form */
          <motion.div
            key="auth-forms"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className={`p-6 sm:p-8 rounded-3xl ${activeTheme.cardClass} shadow-2xl border border-indigo-500/10 space-y-6`}
          >
            {/* Form tab controllers */}
            <div className="flex bg-white/2 dark:bg-white/4 p-1 rounded-2xl border border-white/5">
              <button
                onClick={() => setIsLoginView(true)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isLoginView
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{trans('auth.tabLogin')}</span>
              </button>
              <button
                onClick={() => setIsLoginView(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  !isLoginView
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{trans('auth.tabRegister')}</span>
              </button>
            </div>

            {/* Welcome slogans */}
            <div className="space-y-1">
              <h3 className="text-md font-extrabold text-slate-100 flex items-center gap-2">
                {isLoginView ? trans('auth.welcomeLogin') : trans('auth.welcomeRegister')}
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-[11px] text-zinc-500 font-mono">
                {isLoginView
                  ? trans('auth.sloganLogin')
                  : trans('auth.sloganRegister')}
              </p>
            </div>

            {/* Conditionally rendering form inputs */}
            <form onSubmit={isLoginView ? handleLoginSubmit : handleRegisterSubmit} className="space-y-4">

              {/* Username / identifier — any characters, NOT email-only (the
                  backend matches it against username / email / phone). */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">{trans('auth.usernameLabel')}</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={trans('auth.usernamePh')}
                    className="w-full py-2.5 pl-10 pr-4 rounded-xl text-xs bg-slate-900/60 border border-white/10 text-slate-100 outline-none focus:border-indigo-505 placeholder-zinc-500"
                  />
                </div>
              </div>

              {/* Optional Registration Nickname */}
              {!isLoginView && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">{trans('auth.nicknameLabel')}</label>
                  <div className="relative">
                    <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder={trans('auth.nicknamePh')}
                      className="w-full py-2.5 pl-10 pr-4 rounded-xl text-xs bg-slate-900/60 border border-white/10 text-slate-100 outline-none focus:border-indigo-505 placeholder-zinc-500"
                    />
                  </div>
                </div>
              )}

              {/* Email Address — register-only and OPTIONAL. */}
              {!isLoginView && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">{trans('auth.emailLabelOptional')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={trans('auth.emailPh')}
                      autoComplete="email"
                      className="w-full py-2.5 pl-10 pr-4 rounded-xl text-xs bg-slate-900/60 border border-white/10 text-slate-100 outline-none focus:border-indigo-505 placeholder-zinc-500"
                    />
                  </div>
                </div>
              )}

              {/* Security Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">{trans('auth.passwordLabel')}</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={isLoginView ? 'current-password' : 'new-password'}
                    className="w-full py-2.5 pl-10 pr-4 rounded-xl text-xs bg-slate-900/60 border border-white/10 text-slate-100 outline-none focus:border-indigo-505 placeholder-zinc-500"
                  />
                </div>
              </div>

              {/* Confirm Password — register-only (two-password confirmation). */}
              {!isLoginView && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">{trans('auth.confirmPasswordLabel')}</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full py-2.5 pl-10 pr-4 rounded-xl text-xs bg-slate-900/60 border border-white/10 text-slate-100 outline-none focus:border-indigo-505 placeholder-zinc-500"
                    />
                  </div>
                </div>
              )}

              {/* Additional parameters if Register view (native/target language coordinate selection) */}
              {!isLoginView && (
                <div className="space-y-4 pt-2 border-t border-dashed border-white/5">

                  {/* Languages config */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 font-mono">{trans('auth.nativeTongue')}</label>
                      <select
                        value={nativeLang}
                        onChange={(e) => setNativeLang(e.target.value)}
                        className="w-full py-2 px-3 rounded-lg text-[10px] bg-slate-900/80 text-zinc-300 border border-white/10 outline-none cursor-pointer"
                      >
                        <option value="zh">🇨🇳 {trans('lang.name.zh')}</option>
                        <option value="ja">🇯🇵 {trans('lang.name.ja')}</option>
                        <option value="es">🇪🇸 {trans('lang.name.es')}</option>
                        <option value="ko">🇰🇷 {trans('lang.name.ko')}</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 font-mono">{trans('auth.targetStudy')}</label>
                      <select
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="w-full py-2 px-3 rounded-lg text-[10px] bg-slate-900/80 text-zinc-300 border border-white/10 outline-none cursor-pointer"
                      >
                        <option value="en">🇺🇸 {trans('lang.name.en')}</option>
                        <option value="fr">🇫🇷 {trans('lang.name.fr')}</option>
                        <option value="de">🇩🇪 {trans('lang.name.de')}</option>
                        <option value="es">🇪🇸 {trans('lang.name.es')}</option>
                      </select>
                    </div>
                  </div>

                  {/* Bio motto */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">{trans('auth.bioLabel')}</label>
                    <input
                      type="text"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder={trans('auth.bioPh')}
                      className="w-full py-2 px-3 rounded-xl text-xs bg-slate-900/60 border border-white/10 text-slate-100 outline-none focus:border-indigo-505 placeholder-zinc-500"
                    />
                  </div>
                </div>
              )}

              {/* Secure Shield compliance text block */}
              <div className="flex items-center gap-1.5 p-2 bg-white/2 rounded-xl text-[9px] text-zinc-500 border border-white/5 font-mono">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>{trans('auth.secNote')}</span>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-650 hover:to-purple-750 text-white font-mono text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg hover:shadow-indigo-505/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>{submitting ? trans('common.loading') : isLoginView ? trans('auth.submitLogin') : trans('auth.submitRegister')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

            </form>

            {/* Fast Quick login trigger helper for easy preview */}
            {isLoginView && (
              <div className="text-center pt-2">
                <p className="text-[10px] text-zinc-500 font-mono">
                  {trans('auth.firstTime')}
                </p>
              </div>
            )}

          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
};
