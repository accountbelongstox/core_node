/** WfNewShelfTab - the shelf tab body extracted from WfNewApp so the shell
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
import { wfNewApi, wfNewAdminApi, wfNewEndpoints, wfNewEndpointStore, WFNEW_API_HEALTH_EVENT, startSocialSse, stopSocialSse, subscribeSocial } from '../api';
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

interface WfNewShelfTabProps {
  activeTheme: ElementTheme; trans: (k: string, r?: Record<string, string|number>) => string;
  lang: string; gGroups: WordGroup[];
  selectedCourse: WordGroup | null; courseWords: Word[]; favorites: Word[];
  setSelectedCourse: (c: WordGroup | null) => void; setCourseWords: (fn: any) => void;
  setSelectedPracticeGroup: (g: WordGroup | null) => void; setActiveTab: (t: any) => void;
  selectBookCourse: (g: WordGroup) => Promise<void>; startModePractice: (m: any) => void;
  handleToggleFavorite: (w: Word) => void; playPhoneticSpeech: (w: Word) => void;
  setSelectedWordDetail: (w: Word | null) => void;
}

export const WfNewShelfTab: React.FC<WfNewShelfTabProps> = (props) => {
  const { activeTheme, trans, lang, gGroups, selectedCourse, courseWords, favorites, setSelectedCourse, setCourseWords, setSelectedPracticeGroup, setActiveTab, selectBookCourse, startModePractice, handleToggleFavorite, playPhoneticSpeech, setSelectedWordDetail } = props;
  return (
    <>
              {!selectedCourse ? (
                <>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">{trans('library.title')}</h2>
                    <p className="text-zinc-500 text-xs mt-1">{trans('library.subtitle')}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {gGroups.map(g => (
                      <CourseBlockCard
                        key={g.id}
                        group={g}
                        theme={activeTheme}
                        onClick={() => selectBookCourse(g)}
                        lang={shellLang}
                        trans={trans}
                      />
                    ))}
                  </div>
                </>
              ) : (
                /* Interactive Course deep-dive panel */
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setSelectedCourse(null);
                        setCourseWords([]);
                      }}
                      className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight">{selectedCourse.name}</h2>
                      <p className="text-zinc-500 text-xs">{trans('home.examineSub')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Course Overview */}
                    <div className="space-y-4">
                      <div className={`p-6 rounded-3xl ${activeTheme.cardClass} space-y-4`}>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded">
                          {trans('detail.syllabus')}
                        </span>
                        
                        <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                          {selectedCourse.description || trans('home.courseDescFallback')}
                        </p>

                        <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-3 text-center">
                          <div className="p-3 bg-white/5 rounded-xl">
                            <p className="text-xl font-bold font-mono">{selectedCourse.count}</p>
                            <span className="text-[9px] uppercase font-mono text-zinc-500">Lexemes</span>
                          </div>
                          <div className="p-3 bg-white/5 rounded-xl">
                            <p className="text-xl font-bold font-mono">~4 days</p>
                            <span className="text-[9px] uppercase font-mono text-zinc-500">Repetitions</span>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="space-y-2 pt-2">
                          <button
                            onClick={() => {
                              setSelectedPracticeGroup(selectedCourse);
                              setActiveTab('practice');
                              startModePractice('study');
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-mono uppercase tracking-widest py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
                          >
                            <GraduationCap className="w-4 h-4" />
                            {trans('detail.learn')}
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedPracticeGroup(selectedCourse);
                              setActiveTab('practice');
                              startModePractice('quiz');
                            }}
                            className="w-full bg-white/5 hover:bg-white/10 text-zinc-300 font-mono uppercase tracking-widest py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border border-white/5"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {trans('detail.quiz')}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Word row lists (2 Columns wide) */}
                    <div className="lg:col-span-2 space-y-3">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-mono">
                          {trans('detail.vocab')} ({courseWords.length})
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 gap-2 max-h-[550px] overflow-y-auto pr-1 no-scrollbar">
                        {courseWords.map(word => (
                          <WordRowItem
                            key={word.id}
                            word={word}
                            isFav={favorites.some(f => f.id === word.id)}
                            onToggleFav={() => handleToggleFavorite(word)}
                            onPlayAudio={() => playPhoneticSpeech(word)}
                            onClick={() => setSelectedWordDetail(word)}
                            theme={activeTheme}
                            trans={trans}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
    </>
  );
};
