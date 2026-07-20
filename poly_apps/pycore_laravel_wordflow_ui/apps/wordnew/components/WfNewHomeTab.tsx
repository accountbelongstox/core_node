/** WfNewHomeTab - the home tab body extracted from WfNewApp so the shell
 * stays under the 800-line modular limit. Pure presentation: state + handlers
 * come from the shell via props (prop names match the destructured hook bindings). */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Sparkles, GraduationCap, Flame, ChevronRight, 
  Search, Volume2, Star, Settings, Check, RefreshCw, Layers, 
  CheckCircle, Play, Pause, SkipForward, ArrowRight,
  Languages, Moon, Sun, Heart, Send, Info, Trash2, ArrowLeft, RotateCw,
  BarChart2, LogIn, ShieldCheck
} from 'lucide-react';

import { useShell } from '../../../shell/ShellContext';
// Single data gateway — mock vs real backend is decided ONLY by ./api/index.ts
// (swap one import line there). All data shapes come from the same TYPE surface.
import { wfNewApi, wfNewAdminApi, wfNewEndpoints, wfNewEndpointStore, WFNEW_API_HEALTH_EVENT, startSocialSse, stopSocialSse, subscribeSocial, DEFAULT_VOCAB_GROUP_NAME } from '../api';
import type { Word, WordGroup, BentoGroup, WfNewContentGroup, WfNewContentKind, WfNewHomeContent, WfNewStatistics, WfNewLanguage, WfNewSuperAdminStatus } from '../api';
// Unified local cache (CapDatabase: native SQLite / web IndexedDB). Lets the home
// hub paint INSTANTLY from cache, then refresh from the API, and lets a re-opened
// word group skip re-fetching the whole list. Never throws — a miss falls back to
// the network. See ./cache/WfNewContentCache.
import {
  getCachedGroups, getCachedGroupIds, putCachedGroups,
  getCachedWords, putCachedWords,
  setCacheScope, clearAuthScopedCache,
  dedupGroups,
  type WfNewCachedKind,
} from '../cache/WfNewContentCache';
import { wfNewSettings } from '../WfNewSettingsStore';
import { WfNewHomeContent as WfNewHomeContentWidget } from './WfNewHomeContent';
import { WfNewAgentArticlesSection } from './WfNewAgentArticlesSection';

// Modular Imports
import { UserStats, ElementTheme } from '../WfNewTypes';
import { translate, getSupportedLanguages } from '../WfNewLocales';
import { CUSTOM_THEMES } from '../WfNewThemes';
import { WfNewSearchOverlay } from './WfNewSearchOverlay';
import { WfNewToast } from './WfNewToast';
import { wfNewNotify, useWfNewToasts } from '../WfNewNotify';
import { WfNewBottomDock } from './WfNewBottomDock';
import { CourseBlockCard, WordRowItem } from './WfNewCards';
import { WfNewSettings } from '../pages/WfNewSettings';
import DailyReading from '../../../components/views/DailyReading';

// New Custom Study Suites Pages
import { WfNewWalkman } from '../pages/WfNewWalkman';
import { WfNewSubtitles } from '../pages/WfNewSubtitles';
import { WfNewAnalytics } from '../pages/WfNewAnalytics';
import { WfNewBilingual } from '../pages/WfNewBilingual';
import { WfNewBookReader } from '../pages/WfNewBookReader';
import { WfNewContentListPage } from '../pages/WfNewContentListPage';
import { WfNewLibraryPage } from '../pages/WfNewLibraryPage';
import { WfNewSocial } from '../pages/WfNewSocial';
import { WfNewAuth } from '../pages/WfNewAuth';
import { WfNewProfile } from '../pages/WfNewProfile';
import { WfNewLanguages } from '../pages/WfNewLanguages';
import { WfNewLearningModel } from '../pages/WfNewLearningModel';
import { WfNewReviewSettings } from '../pages/WfNewReviewSettings';
import { WfNewPlaybackSettings } from '../pages/WfNewPlaybackSettings';
import { WfNewAbout } from '../pages/WfNewAbout';
import { WfNewAdminPage } from '../pages/WfNewAdminPage';
import { WfNewWordDetailModal } from './WfNewWordDetailModal';
import { WfNewLabsTab } from './WfNewLabsTab';
import { WfNewAvatarView } from './WfNewAvatarView';
import { WfNewHomeDashboard } from './WfNewHomeDashboard';
import { WfNewOnboarding } from '../pages/WfNewOnboarding';
import { WfNewNavLogo } from './WfNewNavLogo';
import { WfNewNotificationBell } from './WfNewNotificationBell';

interface WfNewHomeTabProps {
  activeTheme: ElementTheme; trans: (k: string, r?: Record<string, string|number>) => string;
  lang: string;
  dark: boolean; currentUser: any; nickname: string; avatarUrl: string; statistics: any;
  gGroups: WordGroup[]; bentoGroups: BentoGroup[]; userStats: UserStats;
  languageOptions: WfNewLanguage[]; homeContent: WfNewHomeContent; homeContentLoading: boolean;
  addToast: (t: string, ty?: any) => void; setActiveTab: (t: any) => void;
  setContentListKind: (k: any) => void;
  handleSaveDashboard: (n: any) => Promise<void>;
  openHomeGroup: (g: WfNewContentGroup) => void;
  loadMoreGroups: (k: any) => Promise<boolean>;
  selectBookCourse: (g: WordGroup) => Promise<void>;
  startGroupPractice: (g: WordGroup, m: any) => Promise<void>;
  startModePractice: (m: any) => void;
  addLibraryToStudy: (g: WfNewContentGroup) => void;
}

export const WfNewHomeTab: React.FC<WfNewHomeTabProps> = (props) => {
  const { activeTheme, trans, lang, dark, currentUser, nickname, avatarUrl, statistics, gGroups, bentoGroups, userStats, languageOptions, homeContent, homeContentLoading, addToast, setActiveTab, setContentListKind, handleSaveDashboard, openHomeGroup, loadMoreGroups, selectBookCourse, startGroupPractice, startModePractice, addLibraryToStudy } = props;

  // The pinned Default Vocabulary Group as a content-group card model — shown
  // ONCE, as the FIRST card of the WORD GROUPS section (it is the fixed
  // default pack; any word groups the user adds follow after it). It used to
  // ALSO render as a large hero card in the bento waterfall below — that
  // duplicate is filtered out there.
  const defaultWordGroup = useMemo<WfNewContentGroup | undefined>(() => {
    const g = gGroups.find((gr) => gr.name === DEFAULT_VOCAB_GROUP_NAME) ?? gGroups[0];
    if (!g) return undefined;
    return {
      id: g.id,
      kind: 'word',
      title: g.name,
      count: g.count,
      countUnit: 'words',
      language: g.language,
      description: g.description,
    };
  }, [gGroups]);
  return (
    <>
              {/* Unified learning dashboard. When LOGGED IN: identity + real backend
                  stats render and Save writes through. When LOGGED OUT: the stats
                  area is hidden entirely (no login CTA) — only the editable learning
                  settings row shows, and Save routes to login. */}
              <WfNewHomeDashboard
                activeTheme={activeTheme}
                trans={trans}
                lang={lang}
                isLoggedIn={currentUser.isLoggedIn}
                nickname={nickname}
                avatarUrl={avatarUrl}
                stats={statistics}
                groupName={gGroups[0]?.name || ''}
                groupCount={gGroups[0]?.count || 0}
                targetLang={currentUser.targetLang || wfNewSettings.get('settingTargetLang')}
                dailyGoal={userStats.dailyGoal}
                languageOptions={languageOptions}
                onSave={handleSaveDashboard}
              />

              {/* Omni-Symmetrical Audio-Visual Laboratory */}
              <div className="space-y-3.5 pt-4 animate-fade-in">
                <h3 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400 px-1">
                  Omni-Dimensional Audio-Visual Labs
                </h3>
                {/* Mobile: compact 2-col icon-on-top / label-below grid (no list rows);
                    sm+ keeps the richer card with description. */}
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                  
                  {/* Cyber Walkman Card */}
                  <div
                    onClick={() => {
                      setActiveTab('walkman');
                      window.speechSynthesis.cancel();
                    }}
                    className={`p-6 rounded-3xl ${activeTheme.cardClass} hover:border-indigo-500/25 border border-white/5 cursor-pointer hover:scale-[1.01] transition-all duration-300 group flex flex-col items-center text-center sm:items-start sm:text-left`}
                  >
                    <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl sm:rounded-2xl w-fit mb-2.5 sm:mb-4">
                      <Volume2 className="w-5.5 h-5.5 animate-pulse" />
                    </div>
                    <h4 className="font-extrabold text-[11px] leading-tight sm:text-sm text-slate-100 group-hover:text-indigo-400 transition-colors">
                      {trans('home.walkmanTitle')}
                    </h4>
                    <p className="hidden sm:block text-xs text-zinc-500 mt-2 font-mono leading-relaxed">
                      {trans('home.walkmanDesc')}
                    </p>
                  </div>

                  {/* Interactive Subtitles Video Card */}
                  <div
                    onClick={() => {
                      setActiveTab('subtitles');
                      window.speechSynthesis.cancel();
                    }}
                    className={`p-6 rounded-3xl ${activeTheme.cardClass} hover:border-fuchsia-500/25 border border-white/5 cursor-pointer hover:scale-[1.01] transition-all duration-300 group flex flex-col items-center text-center sm:items-start sm:text-left`}
                  >
                    <div className="p-3 bg-fuchsia-500/10 text-fuchsia-400 rounded-xl sm:rounded-2xl w-fit mb-2.5 sm:mb-4">
                      <Play className="w-5.5 h-5.5" />
                    </div>
                    <h4 className="font-extrabold text-[11px] leading-tight sm:text-sm text-slate-100 group-hover:text-fuchsia-400 transition-colors">
                      {trans('home.subsTitle')}
                    </h4>
                    <p className="hidden sm:block text-xs text-zinc-500 mt-2 font-mono leading-relaxed">
                      {trans('home.subsDesc')}
                    </p>
                  </div>

                  {/* Bilingual Cosmos Recital Room Card */}
                  <div
                    onClick={() => {
                      setActiveTab('bilingual');
                      window.speechSynthesis.cancel();
                    }}
                    className={`p-6 rounded-3xl ${activeTheme.cardClass} hover:border-amber-500/25 border border-white/5 cursor-pointer hover:scale-[1.01] transition-all duration-300 group flex flex-col items-center text-center sm:items-start sm:text-left`}
                  >
                    <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl sm:rounded-2xl w-fit mb-2.5 sm:mb-4">
                      <Languages className="w-5.5 h-5.5 text-amber-400" />
                    </div>
                    <h4 className="font-extrabold text-[11px] leading-tight sm:text-sm text-slate-100 group-hover:text-amber-400 transition-colors">
                      {trans('home.bilingualTitle')}
                    </h4>
                    <p className="hidden sm:block text-xs text-zinc-500 mt-2 font-mono leading-relaxed">
                      {trans('home.bilingualDesc')}
                    </p>
                  </div>

                  {/* Telemetry Stats Card */}
                  <div
                    onClick={() => {
                      setActiveTab('stats');
                      window.speechSynthesis.cancel();
                    }}
                    className={`p-6 rounded-3xl ${activeTheme.cardClass} hover:border-emerald-500/25 border border-white/5 cursor-pointer hover:scale-[1.01] transition-all duration-300 group flex flex-col items-center text-center sm:items-start sm:text-left`}
                  >
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl sm:rounded-2xl w-fit mb-2.5 sm:mb-4">
                      <BarChart2 className="w-5.5 h-5.5" />
                    </div>
                    <h4 className="font-extrabold text-[11px] leading-tight sm:text-sm text-slate-100 group-hover:text-emerald-400 transition-colors">
                      {trans('home.statsTitle')}
                    </h4>
                    <p className="hidden sm:block text-xs text-zinc-500 mt-2 font-mono leading-relaxed">
                      {trans('home.statsDesc')}
                    </p>
                  </div>

                </div>
              </div>

              {/* Quantum Recitation Portal modes */}
              <div className="space-y-3.5 pt-4">
                <h3 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400 px-1">
                  {trans('home.modesHeader')}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {([
                    { id: 'study', title: trans('modes.flashcards'), desc: trans('home.modeStudyDesc'), color: 'border-fuchsia-500/25 text-fuchsia-400', bg: 'bg-fuchsia-500/5' },
                    { id: 'quiz', title: trans('modes.quiz'), desc: trans('home.modeQuizDesc'), color: 'border-emerald-500/25 text-emerald-400', bg: 'bg-emerald-500/5' },
                    { id: 'listening', title: trans('modes.listening'), desc: trans('home.modeListenDesc'), color: 'border-amber-500/25 text-amber-400', bg: 'bg-amber-500/5' },
                    { id: 'reading', title: trans('modes.reading'), desc: trans('home.modeReadDesc'), color: 'border-blue-500/25 text-blue-400', bg: 'bg-blue-500/5' }
                  ] as const).map(mode => (
                    <div
                      key={mode.id}
                      onClick={() => {
                        const g = gGroups[0] || bentoGroups[0];
                        if (g) {
                          void startGroupPractice(g, mode.id);
                        } else {
                          setActiveTab('practice');
                          startModePractice(mode.id);
                        }
                      }}
                      className="p-4 sm:p-5 rounded-2xl bg-slate-900/15 border border-white/5 hover:border-indigo-500/25 hover:bg-slate-900/50 cursor-pointer group transition-all duration-300 flex flex-col items-center text-center sm:items-start sm:text-left"
                    >
                      <div className={`p-2.5 sm:p-3 rounded-xl w-fit mb-2.5 sm:mb-4 group-hover:scale-105 transition-transform ${mode.color} ${mode.bg}`}>
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <h4 className="font-extrabold text-[11px] leading-tight sm:text-sm text-slate-100 group-hover:text-indigo-400 transition-colors">
                        {mode.title}
                      </h4>
                      <p className="hidden sm:block text-xs text-zinc-500 mt-1.5 font-mono">{mode.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quantum Custom Bento Box Waterfall Catalog */}
              <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center px-1">
                  <div>
                    <h3 className="text-sm font-black font-mono uppercase tracking-widest text-zinc-400">
                      {trans('home.dossiersTitle')}
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {trans('home.dossiersDesc')}
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('shelf')}
                    className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {trans('home.allPacks')} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Staggered Bento Grid. The Default Vocabulary Group is
                    EXCLUDED here: it renders once, pinned as the first card of
                    the WORD GROUPS section below (the large hero card here was
                    its duplicate representation). */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-auto">
                  {bentoGroups.filter((group) => group.name !== DEFAULT_VOCAB_GROUP_NAME).map((group, idx) => {
                    // Match decoration variables
                    const progressVal = group.progress;
                    
                    return (
                      <motion.div
                        key={group.id}
                        onClick={() => {
                          setActiveTab('shelf');
                          selectBookCourse(group);
                        }}
                        whileHover={{ scale: 1.015, y: -4 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                        className={`rounded-3xl relative overflow-hidden cursor-pointer group flex flex-col justify-between p-6 transition-all duration-300 border backdrop-blur-xl ${group.gridSpan} ${
                          dark 
                            ? `bg-slate-900/40 border-white/5 hover:border-indigo-500/30 ${activeTheme.glowClass}` 
                            : `bg-white/40 border-zinc-200 hover:border-indigo-400/40 shadow-sm hover:shadow-indigo-100/40`
                        }`}
                      >
                        {/* A. Premium Photo Backdrops */}
                        <div 
                          className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-[0.14] dark:opacity-[0.08] pointer-events-none transition-transform duration-700 group-hover:scale-105"
                          style={{
                            backgroundImage: group.id === 'bento-cosmic-1' 
                              ? 'url("https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&q=60&w=800")' 
                              : group.id === 'bento-silicon-2'
                              ? 'url("https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&q=60&w=800")' 
                              : group.id === 'bento-literary-3'
                              ? 'url("https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=60&w=800")' 
                              : 'url("https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=60&w=800")'
                          }}
                        />

                        {/* B. Kinetic Text Waterfall Rainfall Backdrop */}
                        <div className="absolute inset-0 overflow-hidden opacity-[0.06] dark:opacity-[0.04] pointer-events-none select-none font-mono text-[8px] uppercase tracking-widest leading-none">
                          <div className={`flex flex-col gap-2 ${idx % 2 === 0 ? 'animate-[pulse_4s_infinite]' : 'animate-pulse'}`}>
                            {Array.from({ length: 12 }).map((_, rIdx) => (
                              <div key={rIdx} className="flex gap-4 whitespace-nowrap animate-marquee">
                                <span>{group.type}</span>
                                <span>{group.name.split(' ')[0]}</span>
                                <span>INDEXED</span>
                                <span>VOCAB</span>
                                <span>FLOW</span>
                                <span>SYNAPSE</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* C. Beautiful SVG Decorative Artwork Backdrops */}
                        <div className="absolute right-2 bottom-2 w-32 h-32 opacity-20 dark:opacity-15 pointer-events-none transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12">
                          {group.decorativeSvg === 'nebula' && (
                            <svg className="w-full h-full fill-none stroke-current text-indigo-500" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="30" strokeWidth="1" strokeDasharray="4 2" />
                              <circle cx="50" cy="50" r="20" strokeWidth="2" strokeDasharray="8 8" className="animate-[spin_20s_linear_infinite]" />
                              <path d="M10,50 L90,50 M50,10 L50,90" strokeWidth="0.5" strokeDasharray="1 3" />
                            </svg>
                          )}
                          {group.decorativeSvg === 'matrix' && (
                            <svg className="w-full h-full fill-none stroke-current text-emerald-500" viewBox="0 0 100 100">
                              <path d="M20,10 V90 M40,20 V80 M60,10 V90 M80,20 V80" strokeWidth="1.5" strokeDasharray="5 15" className="animate-[pulse_2s_infinite]" />
                              <circle cx="20" cy="40" r="3" fill="currentColor" />
                              <circle cx="60" cy="70" r="3" fill="currentColor" />
                            </svg>
                          )}
                          {group.decorativeSvg === 'stars' && (
                            <svg className="w-full h-full fill-none stroke-current text-rose-500" viewBox="0 0 100 100">
                              <polygon points="50,10 53,40 85,43 55,55 60,85 50,65 40,85 45,55 15,43 47,40" strokeWidth="1" className="animate-pulse" />
                              <circle cx="15" cy="15" r="2" fill="currentColor" />
                              <circle cx="85" cy="85" r="2" fill="currentColor" className="animate-ping" />
                            </svg>
                          )}
                          {group.decorativeSvg === 'waves' && (
                            <svg className="w-full h-full fill-none stroke-current text-sky-500" viewBox="0 0 100 100">
                              <path d="M10,30 Q30,60 50,30 T90,30" strokeWidth="1.5" className="animate-[bounce_3s_infinite]" />
                              <path d="M10,50 Q30,80 50,50 T90,50" strokeWidth="1" opacity="0.6" />
                              <path d="M10,70 Q30,100 50,70 T90,70" strokeWidth="0.5" opacity="0.3" />
                            </svg>
                          )}
                          {group.decorativeSvg === 'rings' && (
                            <svg className="w-full h-full fill-none stroke-current text-amber-500" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="35" strokeWidth="0.5" />
                              <circle cx="50" cy="50" r="25" strokeWidth="1" strokeDasharray="2 2" className="animate-[spin_10s_linear_infinite]" />
                              <circle cx="50" cy="50" r="15" strokeWidth="1.5" />
                            </svg>
                          )}
                          {group.decorativeSvg === 'bars' && (
                            <svg className="w-full h-full fill-none stroke-current text-fuchsia-500" viewBox="0 0 100 100">
                              <rect x="20" y="40" width="10" height="40" strokeWidth="1" className="animate-[pulse_1.5s_infinite]" />
                              <rect x="40" y="20" width="10" height="60" strokeWidth="1.5" className="animate-pulse" />
                              <rect x="60" y="50" width="10" height="30" strokeWidth="1" className="animate-[pulse_2.5s_infinite]" />
                            </svg>
                          )}
                        </div>

                        {/* Top Metadata Header with One-click Enroll */}
                        <div className="relative z-10 space-y-1">
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex gap-1.5 items-center">
                              <span className="text-[9px] font-black font-mono uppercase tracking-widest bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/10">
                                {group.badge}
                              </span>
                              <span className="text-[9px] font-mono uppercase tracking-wider bg-zinc-500/10 dark:bg-zinc-500/20 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-full border border-zinc-500/10" title={trans('tip.langCode')}>
                                lang: {group.language || 'en'}
                              </span>
                            </div>

                            {/* One-click Enroll button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addToast(trans('toast.pinned', { name: group.name }), 'success');
                              }}
                              className="px-2 py-1 text-[9px] font-mono font-bold tracking-tight uppercase bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-650 hover:to-indigo-750 text-white rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-1 cursor-pointer z-20"
                              title={trans('tip.sync1click')}
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>{trans('home.enroll')}</span>
                            </button>
                          </div>

                          <h4 className="text-md font-black tracking-tight mt-2.5 group-hover:text-indigo-500 transition-colors">
                            {group.name}
                          </h4>
                          <p className="text-[11px] text-zinc-500 font-sans line-clamp-2 leading-snug mt-1 max-w-[85%]">
                            {group.description}
                          </p>
                        </div>

                        {/* Bottom Status Panel */}
                        <div className="relative z-10 pt-4 mt-4 border-t border-zinc-200/50 dark:border-white/5 space-y-2">
                          <div className="flex justify-between items-end text-[10px] font-mono select-none">
                            <div className="space-y-0.5">
                              <span className="text-zinc-600 dark:text-zinc-400 block">{group.statsLabel}</span>
                              <span className="font-bold text-sky-500 dark:text-indigo-300">{trans('home.lexAvail', { n: group.count })}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-emerald-500">{trans('home.pctMastered', { n: progressVal })}</span>
                            </div>
                          </div>

                          {/* Linear progress bar */}
                          <div className="w-full bg-zinc-200/60 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <motion.div 
                              className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${progressVal}%` }}
                              transition={{ duration: 1.5, delay: idx * 0.1 }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Agent History generated articles — live poll */}
              <WfNewAgentArticlesSection
                theme={activeTheme}
                trans={trans}
                onOpenBook={(sourceKey, title) => {
                  openHomeGroup({
                    id: sourceKey,
                    kind: 'book',
                    sourceKey,
                    title,
                    count: 0,
                    countUnit: 'sentences',
                    category: 'agent_history',
                  });
                }}
              />

              {/* Multi-category content hub — live backend word / book / subtitle
                  / document groups (WfNewHomeContent widget reads getHomeContent). */}
              <WfNewHomeContentWidget
                content={homeContent}
                loading={homeContentLoading}
                theme={activeTheme}
                trans={trans}
                defaultWordGroup={defaultWordGroup}
                onOpen={openHomeGroup}
                onMore={(kind) => { setContentListKind(kind); setActiveTab('content-list'); }}
                onNeedMore={loadMoreGroups}
                onAddToStudy={addLibraryToStudy}
              />
    </>
  );
};
