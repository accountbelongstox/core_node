import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Sparkles, Award, Settings, CheckCircle2, Languages, Globe, BookOpen,
  Activity, Shield, Flame, Trash2, Heart, SkipForward, ArrowRight, Save, Clock
} from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import { wfNewSettings } from '../WfNewSettingsStore';

interface WfNewProfileProps {
  activeTheme: ElementTheme;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  currentUser: {
    nickname: string;
    avatar: string;
    email: string;
    nativeLang: string;
    targetLang: string;
    bio: string;
    isLoggedIn: boolean;
  };
  onUpdateProfile: (updatedData: { nickname: string; avatar: string; nativeLang: string; targetLang: string; bio: string }) => void;
  learnedWordsCount: number;
}

interface BadgeItem {
  id: string;
  unlocked: boolean;
  color: string;
}

export const WfNewProfile: React.FC<WfNewProfileProps> = ({
  activeTheme,
  addToast,
  trans,
  currentUser,
  onUpdateProfile,
  learnedWordsCount
}) => {
  // Local state for editing the coordinates
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(currentUser.nickname);
  const [bio, setBio] = useState(currentUser.bio);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [nativeLang, setNativeLang] = useState(currentUser.nativeLang);
  const [targetLang, setTargetLang] = useState(currentUser.targetLang);

  // Avatar Selection List
  const AVATAR_POOL = ['🦁', '🦊', '🐈', '🐼', '🐰', '🐯', '🦉', '🛸', '🚀', '👾', '🪐', '🧠', '👑', '⚡'];

  // Badges lists
  // Badge text (name/description) is resolved via trans by id (profile.badgeName.* / badgeDesc.*).
  const [badges] = useState<BadgeItem[]>([
    { id: 'b-1', unlocked: true, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
    { id: 'b-2', unlocked: learnedWordsCount >= 100, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { id: 'b-3', unlocked: true, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    { id: 'b-4', unlocked: false, color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20' },
    { id: 'b-5', unlocked: true, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' }
  ]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      addToast(trans('profile.nickEmpty'), 'warning');
      return;
    }

    onUpdateProfile({
      nickname,
      bio,
      avatar,
      nativeLang,
      targetLang
    });

    setIsEditing(false);
    addToast(trans('profile.saved'), 'success');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* 1. Profile Interactive overview block */}
      <div className={`p-6 sm:p-8 rounded-3xl ${activeTheme.cardClass} border border-white/5 shadow-2xl relative overflow-hidden`}>
        
        {/* Glow decorative graphics */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
          
          {/* Left portion: big avatar */}
          <div className="relative group">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-900 border-2 border-indigo-500/40 flex items-center justify-center text-4xl sm:text-5xl select-none shadow-xl">
              {currentUser.avatar}
            </div>
            
            <span className="absolute bottom-1 right-1 bg-emerald-500 border border-slate-900 w-4 h-4 rounded-full" />
          </div>

          {/* Right portion: statistics and info */}
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div>
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <h3 className="text-xl font-black text-slate-100 flex items-center justify-center md:justify-start gap-2">
                  {currentUser.nickname}
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </h3>

                <span className="text-[9px] font-mono tracking-widest text-indigo-400 bg-indigo-500/15 border border-indigo-500/10 py-0.5 px-2 rounded-full uppercase self-center">
                  {trans('profile.rank')}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">{currentUser.email || 'offline-saved-profile@wordflow.io'}</p>
              <p className="text-xs text-zinc-400 italic mt-2">"{currentUser.bio || trans('profile.noBio')}"</p>
            </div>

            {/* Micro stats metrics */}
            <div className="grid grid-cols-3 gap-3 max-w-md pt-2">
              <div className="p-3 rounded-xl bg-white/2 border border-white/5 text-center">
                <span className="text-[9px] text-zinc-500 font-mono block uppercase">{trans('profile.learnedPool')}</span>
                <span className="text-sm font-black text-slate-200">{learnedWordsCount} {trans('profile.wordsUnit')}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/2 border border-white/5 text-center">
                <span className="text-[9px] text-zinc-500 font-mono block uppercase">{trans('profile.activeStreak')}</span>
                <span className="text-sm font-black text-orange-400 flex items-center justify-center gap-1">
                  🔥 {wfNewSettings.get('streakDays')}d
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/2 border border-white/5 text-center">
                <span className="text-[9px] text-zinc-500 font-mono block uppercase">{trans('profile.synapticRatio')}</span>
                <span className="text-sm font-black text-indigo-400">94.2%</span>
              </div>
            </div>

            {/* Quick launcher button to trigger edits */}
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono font-bold transition-all border border-white/10 cursor-pointer text-zinc-300"
              >
                {trans('profile.adjustBtn')}
              </button>
            )}
          </div>

        </div>

      </div>

      {/* 2. Interactive Editing forms if isEditing, else showcases credentials */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* EDITING FORM PORTLET */}
        {isEditing ? (
          <div className={`col-span-full p-6 sm:p-8 rounded-3xl ${activeTheme.cardClass} border border-indigo-500/20 shadow-xl space-y-5`}>
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Settings className="w-5 h-5 text-indigo-400" />
              <h4 className="text-sm font-black text-slate-100">
                {trans('profile.editTitle')}
              </h4>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left column details */}
                <div className="space-y-4">
                  
                  {/* Nickname input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 font-mono">
                      {trans('profile.nicknameLabel')}
                    </label>
                    <input
                      type="text"
                      required
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs outline-none bg-slate-900 border border-white/10 text-slate-100 focus:border-indigo-500`}
                    />
                  </div>

                  {/* Bio motto input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 font-mono">
                      {trans('profile.bioLabel')}
                    </label>
                    <input
                      type="text"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs outline-none bg-slate-900 border border-white/10 text-slate-100 focus:border-indigo-500`}
                    />
                  </div>

                  {/* Native / Target languages selection dropdowns */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 font-mono">{trans('auth.nativeTongue')}</label>
                      <select
                        value={nativeLang}
                        onChange={(e) => setNativeLang(e.target.value)}
                        className="w-full py-2.5 px-3 rounded-lg text-[10px] bg-slate-900 text-zinc-300 border border-white/10 outline-none cursor-pointer"
                      >
                        <option value="zh">{trans('lang.name.zh')}</option>
                        <option value="ja">{trans('lang.name.ja')}</option>
                        <option value="es">{trans('lang.name.es')}</option>
                        <option value="ko">{trans('lang.name.ko')}</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 font-mono">{trans('profile.targetLanguage')}</label>
                      <select
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="w-full py-2.5 px-3 rounded-lg text-[10px] bg-slate-900 text-zinc-300 border border-white/10 outline-none cursor-pointer"
                      >
                        <option value="en">{trans('lang.name.en')}</option>
                        <option value="fr">{trans('lang.name.fr')}</option>
                        <option value="de">{trans('lang.name.de')}</option>
                        <option value="es">{trans('lang.name.es')}</option>
                      </select>
                    </div>
                  </div>

                </div>

                {/* Right column: Avatar emoji select pool */}
                <div className="space-y-3">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 font-mono block">
                    {trans('profile.pickAvatar')}
                  </label>
                  <div className="grid grid-cols-5 gap-2 pb-2">
                    {AVATAR_POOL.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setAvatar(emoji)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg select-none transition-all cursor-pointer ${
                          avatar === emoji 
                            ? 'bg-indigo-500/20 border-2 border-indigo-500 scale-105' 
                            : 'bg-white/2 dark:bg-white/4 border border-white/5 hover:bg-white/5'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Actions submit row */}
              <div className="flex gap-3 justify-end pt-3.5 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono font-bold transition-all border border-white/5 text-zinc-400 cursor-pointer"
                >
                  {trans('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white text-xs font-mono font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Save className="w-4 h-4" />
                  <span>{trans('profile.saveBtn')}</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* COLUMN A: Dynamic Unlocked Badges (Left 2 columns) */}
            <div className={`lg:col-span-2 p-6 sm:p-8 rounded-3xl ${activeTheme.cardClass} border border-white/5 space-y-5 shadow-lg`}>
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <Award className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-black text-slate-100 font-mono uppercase tracking-wide">
                  {trans('profile.badgesTitle')}
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {badges.map(badge => (
                  <div 
                    key={badge.id}
                    className={`p-4 rounded-2xl border flex items-start gap-3 transition-colors ${
                      badge.unlocked 
                        ? badge.color 
                        : 'text-zinc-650 bg-zinc-900/10 border-zinc-805 opacity-50'
                    }`}
                  >
                    <div className="text-xl pt-0.5 select-none font-mono">🏆</div>
                    <div className="space-y-1">
                      <p className="text-xs font-black tracking-tight">{trans('profile.badgeName.' + badge.id)}</p>
                      <p className="text-[10px] leading-snug text-zinc-400">{trans('profile.badgeDesc.' + badge.id)}</p>
                      
                      <div className="pt-2">
                        {badge.unlocked ? (
                          <span className="text-[8px] font-black font-mono tracking-widest bg-emerald-500/15 text-emerald-400 py-0.5 px-2 rounded-full uppercase">
                            {trans('profile.unlocked')}
                          </span>
                        ) : (
                          <span className="text-[8px] font-black font-mono tracking-widest bg-zinc-800 text-zinc-500 py-0.5 px-2 rounded-full uppercase">
                            {trans('profile.locked')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* COLUMN B: Daily path tracking progress (Right 1 column) */}
            <div className={`p-6 sm:p-8 rounded-3xl ${activeTheme.cardClass} border border-white/5 space-y-4 shadow-lg`}>
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-black text-slate-100 font-mono uppercase tracking-wide">
                  {trans('profile.pathMetrics')}
                </h4>
              </div>

              <div className="space-y-4 font-mono text-[10px]">
                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span>{trans('profile.mSynaptic')}</span>
                    <span className="text-emerald-400 font-bold">{trans('profile.excellent')}</span>
                  </div>
                  <div className="w-full bg-slate-900/80 rounded-full h-2 overflow-hidden border border-white/5">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '92%' }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span>{trans('profile.mRetention')}</span>
                    <span className="text-indigo-400 font-bold">88.4%</span>
                  </div>
                  <div className="w-full bg-slate-900/80 rounded-full h-2 overflow-hidden border border-white/5">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: '88.4%' }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span>{trans('profile.mBalance')}</span>
                    <span className="text-amber-400 font-bold">{trans('profile.perfect')}</span>
                  </div>
                  <div className="w-full bg-slate-900/80 rounded-full h-2 overflow-hidden border border-white/5">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 space-y-2">
                  <div className="p-2.5 rounded-xl bg-slate-900/40 text-[9px] text-zinc-500 leading-relaxed">
                    🌟 <strong className="text-zinc-400">{trans('profile.tipLabel')}</strong>: {trans('profile.tipBody')}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

      </div>

    </div>
  );
};
