/** WfNewPracticeTab - the practice tab body extracted from WfNewApp so the shell
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

interface WfNewPracticeTabProps {
  activeTheme: ElementTheme; trans: (k: string, r?: Record<string, string|number>) => string;
  addToast: (t: string, ty?: any) => void; gGroups: WordGroup[];
  selectedPracticeGroup: WordGroup | null; practiceMode: any;
  setPracticeMode: (m: any) => void;
  startGroupPractice: (g: WordGroup, m: any) => Promise<void>;
  startModePractice: (m: any) => void; courseWords: Word[];
  practiceIndex: number; setPracticeIndex: (n: any) => void;
  isFlipped: boolean; setIsFlipped: (fn: any) => void; setUserStats: (fn: any) => void;
  quizStreak: number; activeQuizOptions: any; selectedQuizOption: string | null;
  quizAnswered: boolean; handleQuizAnswer: (o: string) => void;
  quizFeedback: string | null; proceedQuizNext: () => void;
  isListeningPlaying: boolean; setIsListeningPlaying: (fn: any) => void;
  readParagraph: string; setSelectedWordDetail: (w: Word | null) => void;
  playPhoneticSpeech: (w: Word) => void;
}

export const WfNewPracticeTab: React.FC<WfNewPracticeTabProps> = (props) => {
  const { activeTheme, trans, addToast, gGroups, selectedPracticeGroup, practiceMode, setPracticeMode, startGroupPractice, startModePractice, courseWords, practiceIndex, setPracticeIndex, isFlipped, setIsFlipped, setUserStats, quizStreak, activeQuizOptions, selectedQuizOption, quizAnswered, handleQuizAnswer, quizFeedback, proceedQuizNext, isListeningPlaying, setIsListeningPlaying, readParagraph, setSelectedWordDetail, playPhoneticSpeech } = props;
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
                        onClick={() => { void startGroupPractice(g, 'study'); }}
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
                    <div className="p-8 rounded-3xl bg-slate-900/20 border border-white/5 flex flex-col items-center text-center gap-6 py-12">
                      <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                        <Volume2 className="w-8 h-8 animate-pulse" />
                      </div>

                      <div className="space-y-2 max-w-md">
                        <h4 className="font-extrabold text-lg text-slate-100">
                          {trans('playlist.loop')}
                        </h4>
                        <p className="text-xs text-zinc-500 font-mono leading-relaxed">
                          {trans('practice.listeningDesc')}
                        </p>
                      </div>

                      {courseWords[practiceIndex] && (
                        <div className="p-5 bg-white/5 rounded-2xl min-w-[240px] text-center border border-white/5 space-y-1">
                          <p className="text-2xl font-black text-indigo-300">{courseWords[practiceIndex].text}</p>
                          <p className="text-xs text-zinc-500 font-mono">{courseWords[practiceIndex].phonetic}</p>
                          <p className="text-sm font-semibold text-zinc-400 pt-1.5 border-t border-white/5">{courseWords[practiceIndex].translation}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setPracticeIndex(prev => (prev - 1 + courseWords.length) % courseWords.length);
                            playPhoneticSpeech(courseWords[(practiceIndex - 1 + courseWords.length) % courseWords.length]);
                          }}
                          className="p-3 bg-white/5 rounded-full text-zinc-300 hover:bg-white/10"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setIsListeningPlaying(!isListeningPlaying)}
                          className="p-4 bg-indigo-600 rounded-full hover:bg-indigo-500 text-white"
                        >
                          {isListeningPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </button>

                        <button
                          onClick={() => {
                            setPracticeIndex(prev => (prev + 1) % courseWords.length);
                            playPhoneticSpeech(courseWords[(practiceIndex + 1) % courseWords.length]);
                          }}
                          className="p-3 bg-white/5 rounded-full text-zinc-300 hover:bg-white/10"
                        >
                          <SkipForward className="w-4 h-4" />
                        </button>
                      </div>

                      {isListeningPlaying && (
                        <p className="text-[10px] text-emerald-400 font-mono animate-pulse">{trans('practice.listeningActive')}</p>
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
    </>
  );
};
