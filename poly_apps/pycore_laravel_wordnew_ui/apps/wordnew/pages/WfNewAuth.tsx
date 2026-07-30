import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Mail, User, Shield, Sparkles, Languages, Compass, ArrowRight,
  ChevronRight, CheckCircle2, UserPlus, LogIn, Heart, Star, LogOut, Github
} from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import { wfNewApi, type WfNewAuthUser } from '../api';
import { useSocialAuth, type CapSocialProvider } from '@/shared/capabilities/CapSocialAuth';
import { WfNewLanguagePanel } from '../components/WfNewLanguagePanel';
import { WfNewAgreementModal } from '../components/WfNewAgreementModal';
import { getLanguageConfig } from '../WfNewLocales';

interface WfNewAuthProps {
  activeTheme: ElementTheme;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** Current UI language — used as the default native language + agreement language. */
  lang: string;
  onLoginSuccess: (userData: { nickname: string; avatar: string; email: string; userId: string; nativeLang: string; targetLang: string; bio: string; isLoggedIn: boolean }) => void;
  currentUser: {
    nickname: string;
    avatar: string;
    email: string;
    userId: string;
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
  lang,
  onLoginSuccess,
  currentUser,
  onLogout
}) => {
  const [isLoginView, setIsLoginView] = useState(true);

  // Form Field Inputs. Registration is intentionally MINIMAL: identifier +
  // password only. Nickname / email / native language / personal bio are NOT
  // collected (the backend auto-generates the profile); the learning target is
  // picked with the shared language panel and a User-Agreement consent is required.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [targetLangs, setTargetLangs] = useState<string[]>(['en']);
  const [agreed, setAgreed] = useState(false);
  const [langPanelOpen, setLangPanelOpen] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // One-click social login (Google / GitHub) — credential is acquired by the
  // shared CapSocialAuth lib and handed to the backend (wfNewApi.socialLogin),
  // which exchanges the OAuth code and returns a real session.
  const social = useSocialAuth();

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
    // Stable cache-scope identity: a logged-in user ALWAYS has an id or username
    // (the login form treats the identifier as username/email/phone — never
    // email-only), so never key the private content cache on the optional email.
    const userId = user.id != null ? String(user.id) : (user.username || user.email || '');
    return {
      nickname: nick,
      avatar,
      email: resolvedEmail,
      userId,
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

  /**
   * One-click social sign-in. Acquires a provider credential (CapSocialAuth) and
   * exchanges it via the backend; the same flow logs in OR registers (the backend
   * creates the account on first sign-in). Cancellation is silent.
   */
  const handleSocial = async (provider: CapSocialProvider) => {
    if (social.busy || submitting) return;
    if (!social.configured[provider]) {
      // Keys not provisioned yet → tell the user it's COMING SOON (即将上线)
      // rather than surfacing a technical "not configured" message. Wire the
      // OAuth client IDs (capSocial.configure / config/constants.ts) to enable it.
      addToast(trans('auth.socialComingSoon'), 'info');
      return;
    }
    try {
      const cred = provider === 'google' ? await social.signInGoogle() : await social.signInGitHub();
      if (!cred) return; // user cancelled
      const { user } = await wfNewApi.socialLogin(cred);
      const profile = toSessionProfile(user, {});
      onLoginSuccess(profile);
      addToast(trans('auth.welcomeBack', { name: profile.nickname }), 'success');
    } catch (err) {
      addToast(authErrorMessage(err), 'warning');
    }
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
    // Minimal registration: identifier + matching passwords + at least one
    // learning target + User-Agreement consent.
    if (!username || !password) {
      addToast(trans('auth.needUserPass'), 'warning');
      return;
    }
    if (password !== confirmPassword) {
      addToast(trans('auth.passwordMismatch'), 'warning');
      return;
    }
    if (targetLangs.length === 0) {
      addToast(trans('lang.needTarget'), 'warning');
      return;
    }
    if (!agreed) {
      addToast(trans('auth.mustAgree'), 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const { user } = await wfNewApi.register({
        username: username.trim(),
        password,
        // Native language is not asked at registration — default it to the app's
        // current UI language; the chosen targets drive learning_languages.
        native_language: lang,
        learning_languages: targetLangs,
        // No email / nickname / bio / avatar — the backend auto-generates the profile.
      });
      const profile = toSessionProfile(user, { nativeLang: lang, targetLang: targetLangs[0] });
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

              {/* Target language — picked with the SHARED floating language panel
                  (same component the home dashboard uses). Native language, nickname,
                  email and bio are intentionally NOT collected at registration. */}
              {!isLoginView && (
                <div className="space-y-1.5 pt-2 border-t border-dashed border-white/5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">{trans('auth.targetLangLabel')}</label>
                  <button
                    type="button"
                    onClick={() => setLangPanelOpen(true)}
                    className="w-full py-2.5 pl-10 pr-4 relative rounded-xl text-xs bg-slate-900/60 border border-white/10 text-slate-100 outline-none focus:border-indigo-505 text-left flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <Languages className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <span className="truncate">
                      {targetLangs.length
                        ? `${getLanguageConfig(targetLangs[0]).flag} ${targetLangs.map((c) => getLanguageConfig(c).nativeName).join(' · ')}`
                        : trans('auth.pickTargetLang')}
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                  </button>
                </div>
              )}

              {/* Secure Shield compliance text block */}
              <div className="flex items-center gap-1.5 p-2 bg-white/2 rounded-xl text-[9px] text-zinc-500 border border-white/5 font-mono">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>{trans('auth.secNote')}</span>
              </div>

              {/* User-Agreement consent — REQUIRED to register. */}
              {!isLoginView && (
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-indigo-500 cursor-pointer shrink-0"
                  />
                  <span className="text-[10px] text-zinc-400 font-mono leading-relaxed">
                    {trans('auth.agreePrefix')}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setAgreementOpen(true); }}
                      className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                    >
                      {trans('auth.agreementLink')}
                    </button>
                    {trans('auth.agreeSuffix')}
                  </span>
                </label>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting || (!isLoginView && !agreed)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-650 hover:to-purple-750 text-white font-mono text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg hover:shadow-indigo-505/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>{submitting ? trans('common.loading') : isLoginView ? trans('auth.submitLogin') : trans('auth.submitRegister')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

            </form>

            {/* Shared language panel (targets only, local — no pre-auth backend
                sync) + the multi-language User Agreement modal. */}
            <WfNewLanguagePanel
              open={langPanelOpen}
              onClose={() => setLangPanelOpen(false)}
              nativeLang={lang}
              targetLangs={targetLangs}
              hideNative
              localOnly
              onSave={(sel) => setTargetLangs(sel.learning_languages)}
              trans={trans}
              addToast={addToast}
            />
            <WfNewAgreementModal
              open={agreementOpen}
              onClose={() => setAgreementOpen(false)}
              lang={lang}
              trans={trans}
            />

            {/* One-click social login (Google / GitHub) — login + register both. */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-mono">
                  {trans('auth.orContinueWith')}
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSocial('google')}
                  disabled={social.busy || submitting}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-slate-800 font-mono text-xs font-bold border border-white/10 hover:bg-zinc-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {/* Google "G" mark (inline; lucide has no Google icon). */}
                  <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>{social.pending === 'google' ? trans('common.loading') : 'Google'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSocial('github')}
                  disabled={social.busy || submitting}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 text-white font-mono text-xs font-bold border border-white/10 hover:bg-slate-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Github className="w-4 h-4" />
                  <span>{social.pending === 'github' ? trans('common.loading') : 'GitHub'}</span>
                </button>
              </div>
            </div>

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
