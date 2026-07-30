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
import { wfNewApi, wfNewAdminApi, wfNewEndpoints, wfNewEndpointStore, WORDNEW_API_HEALTH_EVENT, startSocialSse, stopSocialSse, subscribeSocial } from '../api';
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
// Ported dictionary-study experience (recite loop / flashcards / review / stats)
// for the Default Vocabulary Group deep-dive. See ./study + docs/设计文档.md.
import { WfNewGroupStudyPanel } from './study/WfNewGroupStudyPanel';
import { useShelfPriorityBoost } from '../hooks/usePriorityBoost';

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
  const { activeTheme, trans, lang, gGroups, selectedCourse, courseWords, favorites, setSelectedCourse, setCourseWords, setSelectedPracticeGroup, selectBookCourse, handleToggleFavorite, playPhoneticSpeech, setSelectedWordDetail } = props;
  // Shelf courses are vocabulary groups: stack untranslated words when opened.
  const shelfWords = useMemo(
    () => courseWords
      .filter((w) => w.hasTranslation === false || !(w.translation || '').trim())
      .map((w) => w.text)
      .filter(Boolean),
    [courseWords],
  );
  const shelfLang = selectedCourse?.language || lang || 'en';
  useShelfPriorityBoost(selectedCourse?.id ?? null, {
    words: shelfWords,
    language: shelfLang,
  });
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
                        lang={lang}
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

                  {/* Ported study experience: Browse / Cards / Recite / Review +
                      stats header, per-word reveal/pronounce/mark, and the Quiz
                      handoff. Words = already-loaded courseWords. */}
                  <WfNewGroupStudyPanel
                    group={selectedCourse}
                    words={courseWords}
                    lang={lang}
                    trans={trans}
                    theme={activeTheme}
                    favorites={favorites}
                    onToggleFavorite={handleToggleFavorite}
                    playPhoneticSpeech={playPhoneticSpeech}
                    onOpenDetail={setSelectedWordDetail}
                    onStartQuiz={() => {
                      // R1 (§5.2): Start Quiz Arena defaults to list + sequential
                      // playback, NOT the multiple-choice quiz. The panel
                      // owns the mode/recite start (handleStartQuiz); here we only
                      // record the practice-group context. The quiz stays reachable
                      // as a manual mode switch (startModePractice still exists).
                      setSelectedPracticeGroup(selectedCourse);
                    }}
                  />
                </div>
              )}
    </>
  );
};
