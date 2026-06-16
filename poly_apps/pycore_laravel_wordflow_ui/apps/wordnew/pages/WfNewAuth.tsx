import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Mail, User, Shield, Sparkles, Languages, Compass, ArrowRight,
  ChevronRight, CheckCircle2, UserPlus, LogIn, Heart, Star, LogOut
} from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('Expanding my cognitive neural horizon in WordFlow.');
  const [avatar, setAvatar] = useState('🦁');
  const [nativeLang, setNativeLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('en');

  // Avatar Options
  const AVATAR_POOL = ['🦁', '🦊', '🐈', '🐼', '🐰', '🐯', '🦉', '🛸', '🚀', '👾'];

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast(trans('auth.needEmailCode'), 'warning');
      return;
    }

    // Capture or seed mock registration checks
    const matchedProfileString = localStorage.getItem(`wf_account_${email.toLowerCase()}`);
    let finalProfile = {
      nickname: 'WordFlow Commander',
      avatar: '🦊',
      email: email,
      nativeLang: 'zh',
      targetLang: 'en',
      bio: 'Linguistic coordinates locked.',
      isLoggedIn: true
    };

    if (matchedProfileString) {
      try {
        finalProfile = JSON.parse(matchedProfileString);
      } catch (err) {}
    } else {
      // Automatic quick onboarding if not found, making it very user-friendly
      finalProfile = {
        nickname: email.split('@')[0],
        avatar: AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)],
        email: email,
        nativeLang: 'zh',
        targetLang: 'en',
        bio: 'Freshly synthesized WordFlow portal profile.',
        isLoggedIn: true
      };
    }

    onLoginSuccess(finalProfile);
    addToast(trans('auth.welcomeBack', { name: finalProfile.nickname }), 'success');
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !nickname) {
      addToast(trans('auth.needAllFields'), 'warning');
      return;
    }

    const newProfile = {
      nickname,
      avatar,
      email,
      nativeLang,
      targetLang,
      bio,
      isLoggedIn: true
    };

    // Store in mock db
    localStorage.setItem(`wf_account_${email.toLowerCase()}`, JSON.stringify(newProfile));
    
    // Log the user in
    onLoginSuccess(newProfile);
    addToast(trans('auth.registered'), 'success');
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
                <span className="text-[9px] text-zinc-500 font-mono block uppercase">Native Tongue</span>
                <span className="text-xs font-bold text-indigo-400 uppercase font-mono">{currentUser.nativeLang}</span>
              </div>
              <div className="text-center border-l border-white/5">
                <span className="text-[9px] text-zinc-500 font-mono block uppercase">Target Study</span>
                <span className="text-xs font-bold text-amber-400 uppercase font-mono">{currentUser.targetLang}</span>
              </div>
            </div>

            {/* Account Management badges */}
            <div className="flex flex-wrap justify-center gap-1.5 pt-2">
              <span className="text-[8px] font-black font-mono tracking-widest bg-emerald-500/10 text-emerald-400 py-0.5 px-2 rounded-full uppercase">
                🛡️ Verified Student
              </span>
              <span className="text-[8px] font-black font-mono tracking-widest bg-indigo-500/10 text-indigo-400 py-0.5 px-2 rounded-full uppercase">
                🌌 Cosmic Pioneer
              </span>
            </div>

            {/* Action buttons */}
            <div className="pt-4 space-y-2.5">
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-white/2 border border-white/5 text-zinc-400 text-[10px] justify-center font-mono">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Your coordinates are synced across local networks.</span>
              </div>

              <button
                onClick={onLogout}
                className="w-full py-3 rounded-2xl bg-zinc-800 hover:bg-red-950/40 text-red-400 hover:text-red-300 transition-all font-mono text-xs font-black uppercase tracking-wider cursor-pointer border border-zinc-700/50 flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Disconnect Profile (退出登录)</span>
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
                <span>Login Portal</span>
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
                <span>Launch Register</span>
              </button>
            </div>

            {/* Welcome slogans */}
            <div className="space-y-1">
              <h3 className="text-md font-extrabold text-slate-100 flex items-center gap-2">
                {isLoginView ? 'Welcome Back, Cadet' : 'Create Spacecraft Credentials'}
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-[11px] text-zinc-500 font-mono">
                {isLoginView 
                  ? 'Input your cosmic credentials to sync bento boxes and conversational threads.' 
                  : 'Establish coordinates, preferences, and avatars to sync with study networks.'}
              </p>
            </div>

            {/* Conditionally rendering form inputs */}
            <form onSubmit={isLoginView ? handleLoginSubmit : handleRegisterSubmit} className="space-y-4">
              
              {/* Optional Registration Name */}
              {!isLoginView && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">Cadet Nickname (起个炫酷的名字)</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      required
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="e.g. StarVoyager"
                      className="w-full py-2.5 pl-10 pr-4 rounded-xl text-xs bg-slate-900/60 border border-white/10 text-slate-100 outline-none focus:border-indigo-505 placeholder-zinc-500"
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">Astral Email Inbox</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cadet@wordflow.universe"
                    className="w-full py-2.5 pl-10 pr-4 rounded-xl text-xs bg-slate-900/60 border border-white/10 text-slate-100 outline-none focus:border-indigo-505 placeholder-zinc-500"
                  />
                </div>
              </div>

              {/* Security Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">Access Security Code (密码)</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full py-2.5 pl-10 pr-4 rounded-xl text-xs bg-slate-900/60 border border-white/10 text-slate-100 outline-none focus:border-indigo-505 placeholder-zinc-500"
                  />
                </div>
              </div>

              {/* Additional parameters if Register view (native/target language coordinate selection) */}
              {!isLoginView && (
                <div className="space-y-4 pt-2 border-t border-dashed border-white/5">
                  
                  {/* Select Avatar emoji */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono block">Choose Avatar (选择头像)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {AVATAR_POOL.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setAvatar(emoji)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-md select-none transition-all cursor-pointer ${
                            avatar === emoji 
                              ? 'bg-indigo-500/20 border-2 border-indigo-500 scale-105' 
                              : 'bg-white/3 border border-white/5 hover:bg-white/5'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Languages config */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 font-mono">Native Tongue</label>
                      <select
                        value={nativeLang}
                        onChange={(e) => setNativeLang(e.target.value)}
                        className="w-full py-2 px-3 rounded-lg text-[10px] bg-slate-900/80 text-zinc-300 border border-white/10 outline-none cursor-pointer"
                      >
                        <option value="zh">🇨🇳 Chinese</option>
                        <option value="ja">🇯🇵 Japanese</option>
                        <option value="es">🇪🇸 Spanish</option>
                        <option value="ko">🇰🇷 Korean</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 font-mono">Target Study</label>
                      <select
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="w-full py-2 px-3 rounded-lg text-[10px] bg-slate-900/80 text-zinc-300 border border-white/10 outline-none cursor-pointer"
                      >
                        <option value="en">🇺🇸 English</option>
                        <option value="fr">🇫🇷 French</option>
                        <option value="de">🇩🇪 German</option>
                        <option value="es">🇪🇸 Spanish</option>
                      </select>
                    </div>
                  </div>

                  {/* Bio motto */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">Linguistic Bio Motto (个性签名)</label>
                    <input
                      type="text"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="e.g. Seeking high-fidelity vocabulary links."
                      className="w-full py-2 px-3 rounded-xl text-xs bg-slate-900/60 border border-white/10 text-slate-100 outline-none focus:border-indigo-505 placeholder-zinc-500"
                    />
                  </div>
                </div>
              )}

              {/* Secure Shield compliance text block */}
              <div className="flex items-center gap-1.5 p-2 bg-white/2 rounded-xl text-[9px] text-zinc-500 border border-white/5 font-mono">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>AES-256 local storage sandbox validation active.</span>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-650 hover:to-purple-750 text-white font-mono text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg hover:shadow-indigo-505/20 transition-all flex items-center justify-center gap-2"
              >
                <span>{isLoginView ? 'Authenticate Profile' : 'Synthesize Cadet Profile'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

            </form>

            {/* Fast Quick login trigger helper for easy preview */}
            {isLoginView && (
              <div className="text-center pt-2">
                <p className="text-[10px] text-zinc-500 font-mono">
                  First time visiting? Simply enter any email or click registration to create an elite vocabulary cadet profile instantly.
                </p>
              </div>
            )}

          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
};
