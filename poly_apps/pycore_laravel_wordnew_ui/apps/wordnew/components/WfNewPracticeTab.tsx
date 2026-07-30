/** WfNewPracticeTab - the practice tab body extracted from WfNewApp so the shell
 * stays under the 800-line modular limit. Pure presentation: state + handlers
 * come from the shell via props (prop names match the destructured hook bindings). */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Sparkles, GraduationCap, Flame, ChevronRight,
  Search, Volume2, Star, Settings, Check, RefreshCw, Layers,
  CheckCircle, SkipForward, ArrowRight,
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
import { resolveAudioSync } from '../cache/WfNewAudioCache';
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

// Ported dict-client auto-play recite stack, reused for the practice pack's
// "按设置直接播放" experience (paged loader + per-word audio loop + word river).
import { useWfNewPracticePager } from '../hooks/useWfNewPracticePager';
import { useWfNewReciteController } from './study/useWfNewReciteController';
import { WfNewStudyWordList } from './study/WfNewStudyWordList';
import { WfNewAudioWave } from './study/WfNewAudioWave';
import { WfNewNoTranslation } from './study/WfNewNoTranslation';
import { WfNewStudySettingsSheet } from './study/WfNewStudySettingsSheet';
import { WfNewPracticeControlPanel } from './study/WfNewPracticeControlPanel';
import { wfNewStudyProgress } from './study/WfNewStudyProgress';
import { studyT } from './study/WfNewStudyLocales';

interface WfNewPracticeTabProps {
  activeTheme: ElementTheme; trans: (k: string, r?: Record<string, string|number>) => string;
  lang: string;
  addToast: (t: string, ty?: any) => void; gGroups: WordGroup[];
  selectedPracticeGroup: WordGroup | null; practiceMode: any;
  setPracticeMode: (m: any) => void;
  startGroupPractice: (g: WordGroup, m: any) => Promise<void>;
  startModePractice: (m: any) => void; courseWords: Word[];
  setCourseWords: (fn: any) => void;
  practiceIndex: number; setPracticeIndex: (n: any) => void;
  isFlipped: boolean; setIsFlipped: (fn: any) => void; setUserStats: (fn: any) => void;
  quizStreak: number; activeQuizOptions: any; selectedQuizOption: string | null;
  quizAnswered: boolean; handleQuizAnswer: (o: string) => void;
  quizFeedback: string | null; proceedQuizNext: () => void;
  isListeningPlaying: boolean; setIsListeningPlaying: (fn: any) => void;
  readParagraph: string; setSelectedWordDetail: (w: Word | null) => void;
  playPhoneticSpeech: (w: Word) => void;
  favorites: Word[]; onToggleFavorite: (w: Word) => void;
}

export const WfNewPracticeTab: React.FC<WfNewPracticeTabProps> = (props) => {
  const { activeTheme, trans, lang, addToast, gGroups, selectedPracticeGroup, practiceMode, setPracticeMode, startGroupPractice, startModePractice, courseWords, setCourseWords, practiceIndex, setPracticeIndex, isFlipped, setIsFlipped, setUserStats, quizStreak, activeQuizOptions, selectedQuizOption, quizAnswered, handleQuizAnswer, quizFeedback, proceedQuizNext, isListeningPlaying, setIsListeningPlaying, readParagraph, setSelectedWordDetail, playPhoneticSpeech, favorites, onToggleFavorite } = props;

  // ---- Auto-play recite experience for the 'listening' (Sound) mode ----------
  // Paged loader over the selected pack (real words, incl. the Default group) +
  // the ported recite controller. The pager also feeds courseWords so the
  // quiz/cards/reading modes render real words. Local UI mirrors the shelf
  // study panel (word river brief/auto-scroll + settings sheet).
  const gid = selectedPracticeGroup?.id ?? '';
  const practiceActive = !!selectedPracticeGroup;
  const [brief, setBrief] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showStudySettings, setShowStudySettings] = useState(false);
  // Large-font (big word + translation) mirror of the persisted wmLargeFont flag;
  // flipped from the floating control panel so the now-playing card re-renders.
  const [largeFont, setLargeFont] = useState<boolean>(() => !!wfNewSettings.get('wmLargeFont'));
  const autoStartedRef = useRef(false);
  // Immersive fullscreen playback — the /practice tab AUTO-ENTERS it once per
  // tab entry (WfNewApp mounts this component only while the tab is active, so
  // mount == entry). The same fixed overlay the shelf arena uses covers all
  // headers/tabs/cards, leaving ONLY the playlist + the floating console
  // (docked at bottom-6). Stop pauses and drops back to the normal practice
  // page; the armed ref stays spent so playback does NOT restart on this visit.
  const [immersive, setImmersive] = useState(true);
  const immersiveArmedRef = useRef(true);

  const pager = useWfNewPracticePager(gid, practiceActive);
  const recite = useWfNewReciteController({
    gid,
    words: pager.words,
    language: selectedPracticeGroup?.language,
    onActive: pager.notifyActive,
  });
  // Stable handle so effects can drive the controller without depending on the
  // recite object's per-render identity.
  const reciteRef = useRef(recite);
  reciteRef.current = recite;

  const isAbsoluteAudio = (u?: string): u is string =>
    !!u && (u.startsWith('http://') || u.startsWith('https://'));
  const speakWord = useCallback((w: Word) => {
    if (isAbsoluteAudio(w.audioUrl)) {
      try { void new Audio(resolveAudioSync(w.audioUrl) ?? w.audioUrl).play().catch(() => playPhoneticSpeech(w)); return; } catch { /* fall through */ }
    }
    playPhoneticSpeech(w);
  }, [playPhoneticSpeech]);

  const markWord = useCallback((w: Word, known: boolean) => {
    wfNewStudyProgress.mark(gid, w, known, selectedPracticeGroup?.language);
    addToast(studyT(lang, known ? 'study.toast.known' : 'study.toast.forgot'), known ? 'success' : 'warning');
  }, [gid, selectedPracticeGroup?.language, lang, addToast]);

  // Flip the persisted large-font flag and mirror it into local state so the
  // now-playing card + control panel reflect it immediately.
  const toggleLargeFont = useCallback(() => {
    const next = !wfNewSettings.get('wmLargeFont');
    wfNewSettings.setField('wmLargeFont', next);
    setLargeFont(next);
  }, []);

  // Mirror the current page into courseWords so quiz/cards/reading see real words.
  useEffect(() => {
    if (pager.words.length) setCourseWords(pager.words);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.words]);

  // Switching packs: stop playback and re-arm auto-start for the new pack.
  useEffect(() => {
    autoStartedRef.current = false;
    reciteRef.current.pause();
    reciteRef.current.setIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid]);

  // AUTO-START per settings ("按设置直接播放"): entering the Sound mode with words
  // loaded begins the recite loop once (gated on autoSpeech, default ON). Leaving
  // the mode pauses playback and re-arms the one-shot.
  useEffect(() => {
    if (practiceMode !== 'listening') {
      autoStartedRef.current = false;
      reciteRef.current.pause();
      return;
    }
    if (autoStartedRef.current || pager.words.length === 0) return;
    autoStartedRef.current = true;
    reciteRef.current.setIndex(0);
    if (wfNewSettings.get('autoSpeech')) reciteRef.current.play();
  }, [practiceMode, pager.words.length]);

  // IMMERSIVE ENTRY (the /practice tab auto-playback): make sure there is a
  // listening session to immerse in — no pack picked yet → take the first one
  // (the Default Vocabulary Group leads gGroups); a pack picked but another
  // mode active → switch to the Sound mode. Runs only while the immersive
  // entry is armed — after Stop the normal practice page is fully in charge
  // (the existing manual play path keeps working there).
  useEffect(() => {
    if (!immersive) return;
    if (!selectedPracticeGroup) {
      if (gGroups.length) void startGroupPractice(gGroups[0], 'listening');
      return;
    }
    if (practiceMode !== 'listening') startModePractice('listening');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immersive, selectedPracticeGroup, practiceMode, gGroups]);

  // Auto-start playback as soon as the first page of words has loaded — ONCE
  // per tab entry (Stop does not re-arm). Unlike the manual-path auto-start
  // above this one is NOT gated on the autoSpeech setting: navigating to the
  // tab IS the user's play intent here. Skipped when the loop already runs
  // (the settings-gated path may have started it first).
  useEffect(() => {
    if (!immersive || practiceMode !== 'listening') return;
    if (!immersiveArmedRef.current || pager.words.length === 0) return;
    immersiveArmedRef.current = false;
    if (reciteRef.current.isPlaying) return;
    reciteRef.current.setIndex(0);
    reciteRef.current.play();
  }, [immersive, practiceMode, pager.words.length]);

  // Stop (the console's Stop button): pause + leave the immersive overlay,
  // back to the normal practice page. immersiveArmedRef stays spent.
  const stopImmersive = useCallback(() => {
    reciteRef.current.pause();
    setImmersive(false);
  }, []);

  const reciteWord = pager.words[recite.index];
  const activeReciteId = reciteWord?.id ?? null;

  return (
    <>
              {!practiceMode ? (
                <div className="max-w-2xl mx-auto text-center py-16 space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black">{trans('practice.select')}</h2>
                    <p className="text-zinc-500 text-xs font-mono">{trans('practice.selectSub')}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {gGroups.map(g => (
                      <button
                        key={g.id}
                        onClick={() => { void startGroupPractice(g, 'listening'); }}
                        className={`p-5 rounded-2xl text-left border transition-all ${
                          selectedPracticeGroup?.id === g.id
                            ? 'border-indigo-500 bg-indigo-500/5'
                            : 'border-white/5 bg-slate-900/20 hover:bg-slate-900/40'
                        }`}
                      >
                        <h4 className="font-bold text-sm">{g.name}</h4>
                        <span className="text-[10px] font-mono text-zinc-500 mt-2 block">{g.count} Words total</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* ACTIVE PLAY MODES */
                <div className="space-y-6 max-w-3xl mx-auto">
                  
                  {/* Mode header */}
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                    <button
                      onClick={() => setPracticeMode(null)}
                      className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white"
                    >
                      <ArrowLeft className="w-4 h-4" /> Exit Session
                    </button>

                    <div className="flex gap-2">
                      {([
                        { id: 'study', label: 'Cards' },
                        { id: 'quiz', label: 'Arena' },
                        { id: 'listening', label: 'Sound' },
                        { id: 'reading', label: 'Synthesized' }
                      ] as const).map(m => (
                        <button
                          key={m.id}
                          onClick={() => startModePractice(m.id)}
                          className={`text-[10px] font-mono uppercase px-3 py-1.5 rounded-lg border transition-all ${
                            practiceMode === m.id
                              ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300'
                              : 'bg-transparent border-transparent text-zinc-500 hover:text-white'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SUBMODE INTERFACES */}
                  {practiceMode === 'study' && courseWords[practiceIndex] && (
                    <div className="flex flex-col items-center gap-6 py-6">
                      
                      {/* Perspective Card item */}
                      <div 
                        onClick={() => setIsFlipped(!isFlipped)}
                        className="w-full max-w-md h-72 cursor-pointer perspective"
                      >
                        <motion.div
                          animate={{ rotateY: isFlipped ? 180 : 0 }}
                          transition={{ duration: 0.6, ease: 'easeInOut' }}
                          className="w-full h-full relative transform-style-3d shadow-2xl rounded-3xl"
                        >
                          {/* Front Side */}
                          <div className={`absolute inset-0 backface-hidden flex flex-col justify-between p-8 rounded-3xl border border-indigo-500/20 bg-slate-900/80 text-center ${
                            activeTheme.id === 'nordic' ? 'bg-white text-slate-800' : ''
                          }`}>
                            <div className="self-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playPhoneticSpeech(courseWords[practiceIndex]);
                                }}
                                className="p-2 bg-white/5 rounded-full hover:bg-white/10"
                                title={trans('tip.speak')}
                              >
                                <Volume2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="space-y-2">
                              <h3 className="text-4xl font-black tracking-tight">{courseWords[practiceIndex].text}</h3>
                              <p className="text-sm font-mono text-zinc-400">{courseWords[practiceIndex].phonetic}</p>
                            </div>

                            <p className="text-[10px] uppercase font-mono text-zinc-600">{trans('card.flip')}</p>
                          </div>

                          {/* Back Side */}
                          <div className={`absolute inset-0 backface-hidden rotate-y-180 flex flex-col justify-between p-8 rounded-3xl border border-indigo-500/20 bg-indigo-950/90 text-center ${
                            activeTheme.id === 'nordic' ? 'bg-slate-50 text-slate-900' : ''
                          }`}>
                            <span className="text-[10px] font-mono font-bold text-zinc-500">Definition Map</span>

                            <div className="space-y-4">
                              <p className="text-xl font-bold text-indigo-400">{courseWords[practiceIndex].translation}</p>
                              <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                                {courseWords[practiceIndex].definition || 'Definition description placeholder'}
                              </p>
                              {courseWords[practiceIndex].example && (
                                <p className="text-[11px] italic font-mono text-zinc-500">
                                  &ldquo;{courseWords[practiceIndex].example}&rdquo;
                                </p>
                              )}
                            </div>

                            <div className="text-[10px] font-mono text-zinc-500">Mastery Dial: {courseWords[practiceIndex].masteryLevel || 70}%</div>
                          </div>
                        </motion.div>
                      </div>

                      {/* Control keys */}
                      <div className="flex gap-4 w-full max-w-md">
                        <button
                          onClick={() => {
                            addToast(trans('toast.removed'), 'warning');
                            setIsFlipped(false);
                            setPracticeIndex(prev => (prev + 1) % courseWords.length);
                          }}
                          className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-2xl text-xs font-mono font-bold border border-white/5"
                        >
                          {trans('practice.forgot')}
                        </button>

                        <button
                          onClick={() => {
                            addToast(trans('toast.added'), 'star');
                            setIsFlipped(false);
                            setUserStats(prev => ({ ...prev, dailyProgress: Math.min(prev.dailyProgress + 1, prev.dailyGoal) }));
                            setPracticeIndex(prev => (prev + 1) % courseWords.length);
                          }}
                          className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-mono font-bold"
                        >
                          {trans('practice.mastered')}
                        </button>
                      </div>
                    </div>
                  )}

                  {practiceMode === 'quiz' && courseWords[practiceIndex] && (
                    <div className="p-6 rounded-3xl bg-slate-900/35 border border-white/5 space-y-6">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-zinc-500">
                          Progress index: {practiceIndex + 1} / {courseWords.length}
                        </span>

                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded font-mono font-bold">
                          {trans('practice.quizStreak')}: {quizStreak}
                        </span>
                      </div>

                      <div className="space-y-2 text-center py-4">
                        <h3 className="text-3xl font-black text-white">{courseWords[practiceIndex].text}</h3>
                        <p className="text-xs font-mono text-indigo-400">{courseWords[practiceIndex].phonetic}</p>
                      </div>

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {activeQuizOptions.map(option => {
                          const isSelected = selectedQuizOption === option;
                          const isCorrect = option === courseWords[practiceIndex].translation;
                          
                          let btnClass = 'border-white/5 bg-slate-900/20 text-zinc-300 hover:bg-white/5';
                          if (quizAnswered) {
                            if (isCorrect) btnClass = 'border-emerald-500 bg-emerald-500/15 text-emerald-400';
                            else if (isSelected) btnClass = 'border-rose-500 bg-rose-500/15 text-rose-400';
                          }

                          return (
                            <button
                              key={option}
                              onClick={() => handleQuizAnswer(option)}
                              disabled={quizAnswered}
                              className={`p-4 rounded-2xl border text-left text-xs font-medium font-mono transition-all flex justify-between items-center ${btnClass}`}
                            >
                              <span>{option}</span>
                              {quizAnswered && isCorrect && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>

                      {quizAnswered && (
                        <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                          <p className={`text-xs font-mono font-bold ${quizFeedback === 'correct' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {quizFeedback === 'correct' ? trans('correct') : trans('incorrect')}
                          </p>

                          <button
                            onClick={proceedQuizNext}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5"
                          >
                            <span>{trans('practice.quizNext')}</span>
                            <SkipForward className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {practiceMode === 'listening' && (
                    <div className="space-y-4">
                      {/* Settings toggle + page indicator */}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-mono text-zinc-500">
                          {pager.loading
                            ? trans('practice.loadingWords')
                            : pager.legacy
                              ? studyT(lang, 'study.recite.of', { i: recite.index + 1, n: pager.words.length })
                              : `${trans('practice.pageOf', { page: pager.page, total: pager.totalPages })} · ${studyT(lang, 'study.recite.of', { i: recite.index + 1, n: pager.words.length })}`}
                        </span>
                        <button
                          onClick={() => setShowStudySettings((s) => !s)}
                          className={`p-2.5 rounded-xl border transition-all ${
                            showStudySettings
                              ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                              : 'bg-white/5 border-white/5 hover:bg-white/10 text-zinc-400'
                          }`}
                          title={studyT(lang, 'study.settings.title')}
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {showStudySettings && (
                        <WfNewStudySettingsSheet
                          lang={lang}
                          theme={activeTheme}
                          brief={brief}
                          setBrief={setBrief}
                          autoScroll={autoScroll}
                          setAutoScroll={setAutoScroll}
                          onClose={() => setShowStudySettings(false)}
                        />
                      )}

                      {reciteWord ? (
                        <>
                          {/* Now playing (word + translation grow when large-font is on) */}
                          <div className="p-6 rounded-3xl bg-slate-900/40 border border-indigo-500/20 flex flex-col items-center text-center gap-2">
                            <h3 className={`font-black tracking-tight ${largeFont ? 'text-5xl md:text-6xl' : 'text-3xl'}`}>{reciteWord.text}</h3>
                            <p className="text-xs font-mono text-indigo-400">{reciteWord.phonetic}</p>
                            {/* Playable 音波 + audio-count; animates with the recite loop. */}
                            <WfNewAudioWave
                              lang={lang}
                              size="md"
                              audioUrl={reciteWord.audioUrl}
                              audioFiles={reciteWord.audioFiles}
                              audioCount={reciteWord.audioCount}
                              playing={recite.isPlaying}
                              onPlay={() => speakWord(reciteWord)}
                              className="pt-1"
                            />
                            {reciteWord.translation ? (
                              <p className={`text-zinc-400 pt-1 ${largeFont ? 'text-xl' : 'text-sm'}`}>{reciteWord.translation}</p>
                            ) : (
                              <span className="pt-1">
                                <WfNewNoTranslation lang={lang} />
                              </span>
                            )}
                            {recite.isPlaying && (
                              <p className="text-[10px] text-emerald-400 font-mono animate-pulse pt-1">{trans('practice.listeningActive')}</p>
                            )}
                          </div>

                          {/* Sequential-reading queue: translations always shown; a row
                              tap moves the play cursor and starts (no detail modal). */}
                          <WfNewStudyWordList
                            words={pager.words}
                            lang={lang}
                            sourceLanguage={selectedPracticeGroup?.language || 'en'}
                            theme={activeTheme}
                            brief={brief}
                            favorites={favorites}
                            activeWordId={activeReciteId}
                            autoScroll={autoScroll}
                            alwaysShowTranslation
                            emptyText={studyT(lang, 'study.recite.empty')}
                            onSpeak={speakWord}
                            onKnown={(w) => markWord(w, true)}
                            onForgot={(w) => markWord(w, false)}
                            onToggleFav={onToggleFavorite}
                            onOpenDetail={setSelectedWordDetail}
                            onSelectWord={(_w, i) => { recite.pause(); recite.setIndex(i); recite.play(); }}
                          />

                          {/* Floating transport bar for the sequential-reading mode */}
                          <WfNewPracticeControlPanel
                            trans={trans}
                            recite={recite}
                            pager={pager}
                            largeFont={largeFont}
                            onToggleLargeFont={toggleLargeFont}
                          />
                        </>
                      ) : (
                        <div className="py-16 text-center text-xs font-mono text-zinc-500">
                          {pager.loading ? trans('practice.loadingWords') : studyT(lang, 'study.recite.empty')}
                        </div>
                      )}
                    </div>
                  )}

                  {practiceMode === 'reading' && (
                    <div className="p-6 rounded-3xl bg-slate-900/35 border border-white/5 space-y-6">
                      <div className="space-y-1">
                        <h4 className="text-sm font-extrabold uppercase font-mono tracking-wider text-indigo-400">Context Flow Synthesis</h4>
                        <p className="text-[10px] text-zinc-500 font-mono">{trans('practice.readDesc')}</p>
                      </div>

                      {/* Generated reading block */}
                      <p className="text-sm text-zinc-300 leading-8 font-serif px-2 border-l-2 border-indigo-500/30">
                        {readParagraph.split(' ').map((word, i) => {
                          const clean = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
                          const isTarget = courseWords.some(cw => cw.text.toLowerCase() === clean.toLowerCase());
                          
                          if (isTarget) {
                            const exactWord = courseWords.find(cw => cw.text.toLowerCase() === clean.toLowerCase())!;
                            return (
                              <span 
                                key={i}
                                onClick={() => {
                                  setSelectedWordDetail(exactWord);
                                  playPhoneticSpeech(exactWord);
                                }}
                                className="text-indigo-400 font-black cursor-pointer hover:bg-indigo-500/15 duration-200 px-1 py-0.5 rounded leading-none border-b border-indigo-400/40 mr-1 inline-block"
                              >
                                {word}
                              </span>
                            );
                          }
                          return <span key={i} className="mr-1">{word}</span>;
                        })}
                      </p>
                    </div>
                  )}

                </div>
              )}

      {/* Immersive fullscreen playback overlay (mirrors the shelf arena in
          WfNewGroupStudyPanel): covers the app chrome — headers, tabs and the
          cards above stay rendered underneath but are fully hidden — so ONLY
          the playlist + the floating console (docked at bottom-6) show. The
          console's Stop button (onStop) exits back to the normal page. */}
      {immersive && practiceMode === 'listening' && (
        <div className="fixed inset-0 z-[60] bg-slate-950 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 pt-6 pb-32">
            <WfNewStudyWordList
              words={pager.words}
              lang={lang}
              sourceLanguage={selectedPracticeGroup?.language || 'en'}
              theme={activeTheme}
              brief={brief}
              favorites={favorites}
              activeWordId={activeReciteId}
              autoScroll={autoScroll}
              alwaysShowTranslation
              jumbo
              readCountOf={(w) => wfNewStudyProgress.recordOf(gid, w.id)?.rc ?? 0}
              emptyText={pager.loading ? trans('practice.loadingWords') : studyT(lang, 'study.recite.empty')}
              onSpeak={speakWord}
              onKnown={(w) => markWord(w, true)}
              onForgot={(w) => markWord(w, false)}
              onToggleFav={onToggleFavorite}
              onOpenDetail={setSelectedWordDetail}
              onSelectWord={(_w, i) => { recite.pause(); recite.setIndex(i); recite.play(); }}
            />
          </div>
          <WfNewPracticeControlPanel
            trans={trans}
            recite={recite}
            pager={pager}
            largeFont={largeFont}
            onToggleLargeFont={toggleLargeFont}
            onStop={stopImmersive}
            docked
          />
        </div>
      )}
    </>
  );
};
