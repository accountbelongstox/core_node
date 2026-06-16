import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Sparkles, GraduationCap, Flame, ChevronRight, 
  Search, Volume2, Star, Settings, Check, RefreshCw, Layers, 
  CheckCircle, Play, Pause, SkipForward, ArrowRight,
  Languages, Moon, Sun, Heart, Cpu, Send, Info, Trash2, ArrowLeft, RotateCw,
  BarChart2
} from 'lucide-react';

import { useShell } from '../../shell/ShellContext';
import { wordflowApi } from '../../core/api-libs/wordflow/WordflowApi';
import type { Word, WordGroup, User } from '../../core/api-libs/wordflow/wordflowTypes';

// Modular Imports
import { UserStats, ElementTheme } from './WfNewTypes';
import { LOCALES } from './WfNewLocales';
import { CUSTOM_THEMES } from './WfNewThemes';
import { WfNewSearchOverlay } from './components/WfNewSearchOverlay';
import { WfNewToast, ToastMessage } from './components/WfNewToast';
import { WfNewBottomDock } from './components/WfNewBottomDock';
import { CourseBlockCard, WordRowItem } from './components/WfNewCards';
import { WfNewSettings } from './pages/WfNewSettings';

// Mock DB exclusively for wordnew
import { MOCK_BENTO_GROUPS, MOCK_VOCABULARY_MAP } from './WfNewMockDb';

// New Custom Study Suites Pages
import { WfNewWalkman } from './pages/WfNewWalkman';
import { WfNewSubtitles } from './pages/WfNewSubtitles';
import { WfNewAnalytics } from './pages/WfNewAnalytics';
import { WfNewBilingual } from './pages/WfNewBilingual';
import { WfNewSocial } from './pages/WfNewSocial';
import { WfNewAuth } from './pages/WfNewAuth';
import { WfNewProfile } from './pages/WfNewProfile';
import { WfNewOnboarding } from './pages/WfNewOnboarding';

export const WfNewApp: React.FC = () => {
  const { lang: shellLang, setLang: setShellLang, dark, toggleDark } = useShell();

  // Selected atmospheric theme state
  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    return localStorage.getItem('wf_new_theme_id') || 'cosmic';
  });

  const activeTheme = useMemo(() => {
    return CUSTOM_THEMES.find(t => t.id === activeThemeId) || CUSTOM_THEMES[0];
  }, [activeThemeId]);

  // Tab navigation states
  const [activeTab, setActiveTab] = useState<'home' | 'shelf' | 'practice' | 'labs' | 'settings' | 'walkman' | 'subtitles' | 'stats' | 'bilingual' | 'social' | 'profile' | 'auth'>('home');

  // Unified global auth user state
  const [currentUser, setCurrentUser] = useState(() => {
    return {
      nickname: localStorage.getItem('wf_new_nickname') || 'WordFlow Commander',
      avatar: localStorage.getItem('wf_new_avatar') || '🦊',
      email: localStorage.getItem('wf_auth_email') || 'commander@wordflow.universe',
      nativeLang: localStorage.getItem('wf_auth_native_lang') || 'zh',
      targetLang: localStorage.getItem('wf_auth_target_lang') || 'en',
      bio: localStorage.getItem('wf_auth_bio') || 'Expanding my cognitive neural horizon in WordFlow.',
      isLoggedIn: localStorage.getItem('wf_auth_is_logged_in') === 'true'
    };
  });

  // Synchronized background breathing toggle state from settings
  const [disableBgBreathing, setDisableBgBreathing] = useState<boolean>(() => {
    return localStorage.getItem('wf_setting_disable_bg_breathing') === 'true';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setDisableBgBreathing(localStorage.getItem('wf_setting_disable_bg_breathing') === 'true');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Custom Local Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (text: string, type: 'success' | 'info' | 'warning' | 'star' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, text, type }]);
  };
  const handleDismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Profile data
  const [nickname, setNickname] = useState<string>(() => {
    return localStorage.getItem('wf_new_nickname') || 'WordFlow Commander';
  });
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    return localStorage.getItem('wf_new_avatar') || '🦊';
  });
  const [speechRate, setSpeechRate] = useState<number>(() => {
    const r = localStorage.getItem('wf_new_speech_rate');
    return r ? parseFloat(r) : 1.0;
  });

  // Synchronized callback when profile saves
  const handleUpdateProfile = (updated: { nickname: string; avatar: string; nativeLang: string; targetLang: string; bio: string }) => {
    setNickname(updated.nickname);
    setAvatarUrl(updated.avatar);
    localStorage.setItem('wf_new_nickname', updated.nickname);
    localStorage.setItem('wf_new_avatar', updated.avatar);
    
    setCurrentUser(prev => {
      const copy = {
        ...prev,
        nickname: updated.nickname,
        avatar: updated.avatar,
        nativeLang: updated.nativeLang,
        targetLang: updated.targetLang,
        bio: updated.bio
      };
      localStorage.setItem('wf_auth_native_lang', updated.nativeLang);
      localStorage.setItem('wf_auth_target_lang', updated.targetLang);
      localStorage.setItem('wf_auth_bio', updated.bio);
      return copy;
    });
  };

  // Onboarding startup sequence state
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    addToast('Onboarding configuration sequence fully synchronized.', 'success');
  };

  const handleLoginSuccess = (payload: typeof currentUser) => {
    setNickname(payload.nickname);
    setAvatarUrl(payload.avatar);
    localStorage.setItem('wf_new_nickname', payload.nickname);
    localStorage.setItem('wf_new_avatar', payload.avatar);
    localStorage.setItem('wf_auth_email', payload.email);
    localStorage.setItem('wf_auth_native_lang', payload.nativeLang);
    localStorage.setItem('wf_auth_target_lang', payload.targetLang);
    localStorage.setItem('wf_auth_bio', payload.bio);
    localStorage.setItem('wf_auth_is_logged_in', 'true');
    setCurrentUser({
      ...payload,
      isLoggedIn: true
    });
    setShowOnboarding(true);
    addToast('Spacecraft command thread authenticated. Initiating calibration sequence!', 'success');
    setActiveTab('profile');
  };

  const handleLogout = () => {
    localStorage.setItem('wf_auth_is_logged_in', 'false');
    setCurrentUser(prev => ({
      ...prev,
      isLoggedIn: false
    }));
    addToast('Logged out of WordFlow spacecraft thread.', 'info');
    setActiveTab('auth');
  };

  // Multilingual translation helper
  const trans = (key: string) => {
    const dict = LOCALES[shellLang] || LOCALES['en'];
    return dict[key] || key;
  };

  // Base API storage structures
  const [gGroups, setGGroups] = useState<WordGroup[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<WordGroup | null>(null);
  const [courseWords, setCourseWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userStats, setUserStats] = useState<UserStats>({
    learned: 432,
    streak: 8,
    dailyGoal: 20,
    dailyProgress: 12
  });

  // Search logic
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Word[]>([]);
  const [searching, setSearching] = useState(false);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [favorites, setFavorites] = useState<Word[]>([]);

  // Practice runner parameters
  const [selectedPracticeGroup, setSelectedPracticeGroup] = useState<WordGroup | null>(null);
  const [practiceMode, setPracticeMode] = useState<'study' | 'quiz' | 'listening' | 'reading' | null>(null);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz parameters
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [selectedQuizOption, setSelectedQuizOption] = useState<string | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);

  // Listening Loop state
  const [isListeningPlaying, setIsListeningPlaying] = useState(false);
  const listeningIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic contextual reading generator paragraphs
  const [readParagraph, setReadParagraph] = useState('');
  const [selectedWordDetail, setSelectedWordDetail] = useState<Word | null>(null);

  // Custom AI Lab manual forge form
  const [newWordText, setNewWordText] = useState('');
  const [newWordTransl, setNewWordTransl] = useState('');
  const [newWordPhon, setNewWordPhon] = useState('');
  const [newWordDef, setNewWordDef] = useState('');

  // Fetch API profile & packages
  const loadContent = async () => {
    setLoading(true);
    try {
      const groups = await wordflowApi.getWordGroups();
      setGGroups(Array.isArray(groups) ? groups : []);
      
      const profile = await wordflowApi.getUserProfile();
      if (profile) {
        if (profile.nickname || profile.name) {
          setNickname(profile.nickname || profile.name);
        }
        setUserStats({
          learned: profile.learned_words ?? profile.totalLearned ?? 432,
          streak: profile.streak ?? 8,
          dailyGoal: parseInt(localStorage.getItem('wf_new_daily_goal') || '20'),
          dailyProgress: profile.dailyProgress ?? 12
        });
      }
    } catch (e) {
      console.warn('Backend endpoint simulation mode engaged.', e);
      // Fallback pre-filled groups for gorgeous bento layout and cards
      setGGroups([
        ...MOCK_BENTO_GROUPS,
        { id: 'g-1', name: 'Standard CET-4 Symmetrical Base', count: 64, progress: 45, type: 'Core CET-4', language: 'en', description: 'Excellent general vocabularies featuring frequent occurrence metrics.' },
        { id: 'g-2', name: 'High-end TOEFL Cosmic Terminology', count: 120, progress: 24, type: 'TOEFL Academic', language: 'en', description: 'Comprehensive advanced spectrum definitions suited for researchers.' },
        { id: 'g-3', name: 'Celestial Literary Expressions', count: 48, progress: 70, type: 'Literary Suite', language: 'en', description: 'Ephemeral and highly aesthetic terms frequently encountered in editorials.' },
        { id: 'g-4', name: 'Psychology & Cognitive Mechanics', count: 32, progress: 90, type: 'Humanities', language: 'en', description: 'Deep structural words related to human mind perception systems.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Synchronize light/dark state globally to document element for perfect Tailwind operation
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  useEffect(() => {
    loadContent();
    // Load local Favorites and target limits
    try {
      const savedFavs = localStorage.getItem('wf_new_favorites');
      if (savedFavs) {
        setFavorites(JSON.parse(savedFavs));
      }
      const savedGoal = localStorage.getItem('wf_new_daily_goal');
      if (savedGoal) {
        setUserStats(prev => ({ ...prev, dailyGoal: parseInt(savedGoal) }));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Sync favorites
  const handleToggleFavorite = (word: Word) => {
    let output = [...favorites];
    if (favorites.some(f => f.id === word.id)) {
      output = output.filter(f => f.id !== word.id);
      addToast(trans('toast.removed'), 'warning');
    } else {
      output.push(word);
      addToast(trans('toast.added'), 'success');
    }
    setFavorites(output);
    localStorage.setItem('wf_new_favorites', JSON.stringify(output));
  };

  // Perform Speeches robustly with rates
  const playPhoneticSpeech = (word: Word) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word.text);
      utterance.lang = 'en-US';
      utterance.rate = speechRate;
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn("SpeechSynthesis not robustly supported in host iframe.");
    }
  };

  // Match words online or locally
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const trigger = setTimeout(async () => {
      try {
        const queryResult = await wordflowApi.queryDictionary({ text: searchQuery });
        if (queryResult && queryResult.word) {
          const list = Array.isArray(queryResult) ? queryResult : [queryResult.word];
          setSearchResults(list);
        } else {
          // Fallback fuzzy filter locally
          const filterRegex = new RegExp(searchQuery, 'i');
          const defaultPool = getFallbackDataset('all');
          setSearchResults(defaultPool.filter(w => filterRegex.test(w.text) || filterRegex.test(w.translation)));
        }
      } catch {
        const filterRegex = new RegExp(searchQuery, 'i');
        const defaultPool = getFallbackDataset('all');
        setSearchResults(defaultPool.filter(w => filterRegex.test(w.text) || filterRegex.test(w.translation)));
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(trigger);
  }, [searchQuery]);

  const selectBookCourse = async (group: WordGroup) => {
    setSelectedCourse(group);
    try {
      const response = await wordflowApi.queryWords({ gid: group.id });
      if (Array.isArray(response) && response.length > 0) {
        setCourseWords(response);
      } else {
        setCourseWords(getFallbackDataset(group.id));
      }
    } catch {
      setCourseWords(getFallbackDataset(group.id));
    }
  };

  // Listening continuous loop implementation
  useEffect(() => {
    if (isListeningPlaying && courseWords.length > 0) {
      // Say first word instantly
      playPhoneticSpeech(courseWords[practiceIndex]);

      listeningIntervalRef.current = setInterval(() => {
        setPracticeIndex(prev => {
          const nextVal = (prev + 1) % courseWords.length;
          playPhoneticSpeech(courseWords[nextVal]);
          return nextVal;
        });
      }, 4300);
    } else {
      if (listeningIntervalRef.current) clearInterval(listeningIntervalRef.current);
    }
    return () => {
      if (listeningIntervalRef.current) clearInterval(listeningIntervalRef.current);
    };
  }, [isListeningPlaying, courseWords]);

  // Launch Practice Session Mode
  const startModePractice = (mode: 'study' | 'quiz' | 'listening' | 'reading') => {
    setPracticeMode(mode);
    setPracticeIndex(0);
    setIsFlipped(false);
    setQuizAnswered(false);
    setQuizStreak(0);
    setQuizFeedback(null);
    setSelectedQuizOption(null);

    if (mode === 'listening') {
      setIsListeningPlaying(true);
    } else {
      setIsListeningPlaying(false);
    }

    if (mode === 'reading' && courseWords.length > 0) {
      // Assemble nice literary paragraphs showcasing these high-frequency keywords
      const terms = courseWords.map(w => w.text);
      if (terms.length > 0) {
        setReadParagraph(
          `In modern computational environments, our active appreciation of visual aesthetics defines the interface standard. Users operate with extreme focus, but their attention remains an ephemeral spark. To prevent overload, software engineers must respect human cognition. When designing, we seek symmetrical layout parameters where elements glow with radiant halos. However, like nebula dust in deep outer space, these virtual visual concepts are quickly replaced by raw mathematical code matrices.`
        );
      }
    }
  };

  // Quiz multiple options generation
  const activeQuizOptions = useMemo(() => {
    if (practiceMode !== 'quiz' || courseWords.length === 0) return [];
    const current = courseWords[practiceIndex];
    if (!current) return [];

    const translations = new Set<string>();
    translations.add(current.translation);

    const pool = getFallbackDataset('all');
    while (translations.size < 4 && pool.length > 4) {
      const randomWord = pool[Math.floor(Math.random() * pool.length)];
      if (randomWord.translation !== current.translation) {
        translations.add(randomWord.translation);
      }
    }

    return Array.from(translations).sort(() => Math.random() - 0.5);
  }, [practiceMode, practiceIndex, courseWords]);

  const handleQuizAnswer = (option: string) => {
    if (quizAnswered) return;
    const current = courseWords[practiceIndex];
    setSelectedQuizOption(option);
    setQuizAnswered(true);

    if (option === current.translation) {
      setQuizFeedback('correct');
      setQuizStreak(prev => prev + 1);
      setQuizScore(prev => prev + 10);
      setUserStats(prev => ({ ...prev, dailyProgress: Math.min(prev.dailyProgress + 1, prev.dailyGoal) }));
      playPhoneticSpeech(current);
    } else {
      setQuizFeedback('incorrect');
      setQuizStreak(0);
    }
  };

  const proceedQuizNext = () => {
    setQuizAnswered(false);
    setQuizFeedback(null);
    setSelectedQuizOption(null);
    if (practiceIndex + 1 < courseWords.length) {
      setPracticeIndex(prev => prev + 1);
    } else {
      // Loops or ends
      addToast(trans('quiz.complete'), 'success');
      setPracticeMode(null);
    }
  };

  // Clear LocalStorage cache helper
  const handleClearEverything = () => {
    localStorage.removeItem('wf_new_favorites');
    localStorage.removeItem('wf_new_nickname');
    localStorage.removeItem('wf_new_avatar');
    localStorage.removeItem('wf_new_daily_goal');
    localStorage.removeItem('wf_new_speech_rate');
    setFavorites([]);
    setNickname('WordFlow Commander');
    setAvatarUrl('🦊');
    setSpeechRate(1.0);
    setUserStats(prev => ({ ...prev, dailyGoal: 20 }));
    addToast(trans('toast.cacheClear'), 'success');
  };

  // Custom forging system
  const handleForgeCustomWord = () => {
    if (!newWordText.trim() || !newWordTransl.trim()) {
      addToast('Please input spell and translation!', 'warning');
      return;
    }
    const newlyForged: Word = {
      id: `custom-${Date.now()}`,
      text: newWordText,
      phonetic: newWordPhon || '/forged/',
      translation: newWordTransl,
      definition: newWordDef || 'Custom forged lexeme in cognitive sanctum.',
      example: 'The master pilot forged custom terms to interface with the control machine.',
      tags: ['Forged']
    };

    // Prepend to current word shelf list
    setCourseWords(prev => [newlyForged, ...prev]);
    addToast(`Successfully forged ${newWordText}!`, 'success');
    
    // Reset form
    setNewWordText('');
    setNewWordTransl('');
    setNewWordPhon('');
    setNewWordDef('');
  };

  // Dictionary pool helpers
  const getFallbackDataset = (id: string): Word[] => {
    if (MOCK_VOCABULARY_MAP[id]) {
      return MOCK_VOCABULARY_MAP[id];
    }
    return [
      { id: 'all-1', text: 'Aesthetics', phonetic: '/esˈθet.ɪks/', translation: '美学，美联审美', definition: 'Concerned with key appreciation of natural beauty structure.', example: 'The architectural grid displays classical Nordic aesthetics.', masteryLevel: 80, tags: ['Aesthetics'] },
      { id: 'all-2', text: 'Glow', phonetic: '/ɡləʊ/', translation: '发光，产生温暖红光', definition: 'Produce a steady radiation light without active combustion.', example: 'The emerald aurora produced a glowing halo in the sky.', masteryLevel: 95, tags: ['Cosmic'] },
      { id: 'all-3', text: 'Cognition', phonetic: '/kɒɡˈnɪʃ.ən/', translation: '认知，掌握理解能力', definition: 'The physical mechanism of absorbing environmental metrics.', example: 'AI models replicate parts of human cognition.', masteryLevel: 72, tags: ['Psychology'] },
      { id: 'all-4', text: 'Nebula', phonetic: '/ˈneb.jə.lə/', translation: '星云', definition: 'A vast cloud of particle gas floating in the outer space.', example: 'The Hubble telescope captured a high-res image of the nebula.', masteryLevel: 65, tags: ['Cosmic'] },
      { id: 'all-5', text: 'Ephemeral', phonetic: '/ɪˈfem.ər.əl/', translation: '短暂的，虚幻即逝的', definition: 'Existing or remaining for a very temporary timeframe.', example: 'The auroral elements are highly ephemeral spectacles.', masteryLevel: 58, tags: ['Literature'] },
      { id: 'all-6', text: 'Symmetrical', phonetic: '/sɪˈmet.rɪ.kəl/', translation: '对称的，均称而工整', definition: 'Designed of mirror-like identical components along an axis.', example: 'Symmetrical grid setups feel incredibly restful.', masteryLevel: 90, tags: ['Design'] }
    ];
  };

  return (
    <div className={dark ? 'dark' : ''}>
      <div className={`min-h-screen transition-all duration-1000 overflow-x-hidden ${activeTheme.bgClass} ${
        activeTheme.id === 'nordic' ? 'text-slate-800 dark:text-slate-100' : (dark ? 'text-slate-100' : 'text-slate-900')
      }`}>
      
      {/* Decorative Luminous Orbs with dynamic dual-mode breathability and glassmorphism */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Orb 1: Upper Right */}
        <motion.div
          animate={disableBgBreathing ? undefined : {
            scale: [1, 1.15, 0.95, 1.05, 1],
            x: [0, 25, -20, 10, 0],
            y: [0, -40, 20, -10, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={`absolute top-[-10%] right-[5%] w-[450px] h-[450px] rounded-full filter blur-[120px] transition-colors duration-1000 ${
            dark 
              ? 'bg-indigo-600/10' 
              : 'bg-indigo-400/25 shadow-[inset_0_0_80px_rgba(168,85,247,0.15)] bg-purple-300/20'
          }`}
        />
        {/* Orb 2: Middle Left */}
        <motion.div
          animate={disableBgBreathing ? undefined : {
            scale: [1, 0.85, 1.1, 0.95, 1],
            x: [0, -35, 20, -10, 0],
            y: [0, 50, -20, 25, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          className={`absolute top-[35%] left-[-5%] w-[380px] h-[380px] rounded-full filter blur-[100px] transition-colors duration-1000 ${
            dark 
              ? 'bg-fuchsia-600/8' 
              : 'bg-pink-400/25 shadow-[inset_0_0_80px_rgba(244,63,94,0.15)] bg-rose-200/20'
          }`}
        />
        {/* Orb 3: Bottom Right */}
        <motion.div
          animate={disableBgBreathing ? undefined : {
            scale: [1, 1.2, 0.9, 1.1, 1],
            x: [0, 30, -20, 15, 0],
            y: [0, 40, -30, 10, 0],
          }}
          transition={{
            duration: 14,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
          className={`absolute bottom-[10%] right-[-5%] w-[420px] h-[420px] rounded-full filter blur-[110px] transition-colors duration-1000 ${
            dark 
              ? 'bg-emerald-600/8' 
              : 'bg-emerald-300/25 bg-teal-200/15'
          }`}
        />
      </div>

      {/* Header section with glass background */}
      <header className={`sticky top-0 z-40 w-full backdrop-blur-xl border-b border-white/5 py-4 px-4 sm:px-8 flex justify-between items-center transition-all ${
        activeTheme.id === 'nordic' 
          ? 'bg-white/80 dark:bg-slate-950/70' 
          : 'bg-slate-950/40'
      }`}>
        <div className="flex items-center cursor-pointer" onClick={() => setActiveTab('home')}>
          <div>
            <span className="text-base font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-fuchsia-100 to-white">
              WORDNEW
            </span>
            <span className="text-[9px] uppercase tracking-widest font-mono text-zinc-500 block">
              Omni-Cognition v5.0
            </span>
          </div>
        </div>

        {/* Real-time search button triggering instant search popup */}
        <div className="relative max-w-sm flex-1 mx-6 hidden md:block">
          <button
            onClick={() => setIsSearchOverlayOpen(true)}
            className={`w-full py-2.5 pl-4 pr-10 rounded-full text-xs font-mono text-left flex items-center gap-2 border transition-all ${
              activeTheme.id === 'nordic'
                ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <span>{trans('search.placeholder')}</span>
          </button>
        </div>

        {/* Setting items right portion */}
        <div className="flex items-center gap-2.5 font-mono">
          <button
            onClick={() => setIsSearchOverlayOpen(true)}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 md:hidden"
            title="Instant search"
          >
            <Search className="w-4 h-4 text-zinc-300" />
          </button>

          {/* Social exchange portal */}
          <button
            onClick={() => setActiveTab('social')}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-full border bg-white/5 hover:bg-indigo-500/10 text-indigo-400 hover:text-indigo-300 transition-all text-xs cursor-pointer ${
              activeTab === 'social' ? 'bg-indigo-500/15 border-indigo-500/30' : 'border-white/5'
            }`}
            title="Social Corridor & Chat with friends"
          >
            <span>🌐</span>
            <span className="hidden sm:inline font-mono font-bold text-[10px] tracking-tight">Social Loop</span>
          </button>

          {/* Individual Profile Console / Login bubble */}
          <button
            onClick={() => setActiveTab(currentUser.isLoggedIn ? 'profile' : 'auth')}
            className={`flex items-center gap-2 p-1.5 pr-3 rounded-full border bg-white/5 transition-all cursor-pointer ${
              activeTab === 'profile' || activeTab === 'auth' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'text-zinc-300 hover:bg-white/10 border-white/5'
            }`}
            title="Profile Console or Auth"
          >
            <div className="w-7 h-7 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-sm relative select-none">
              {avatarUrl}
              <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-950 ${
                currentUser.isLoggedIn ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`} />
            </div>
            <span className="text-[10px] sm:text-xs font-bold font-mono truncate max-w-[80px]">
              {currentUser.isLoggedIn ? nickname : 'Login'}
            </span>
          </button>

          <button 
            onClick={toggleDark}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-zinc-300"
            title="Toggle Light/Dark Theme"
          >
            {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-purple-400" />}
          </button>

          <button 
            onClick={() => setShellLang(shellLang === 'en' ? 'zh' : 'en')}
            className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/5 px-2.5 py-1.5 rounded-full text-zinc-300 font-bold text-xs"
            title="Toggle Dialect"
          >
            <Languages className="w-3.5 h-3.5 text-indigo-400" />
            <span>{shellLang === 'en' ? 'EN' : '中文'}</span>
          </button>
        </div>
      </header>

      {/* Main scrolling wrapper */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 pb-32">
        <AnimatePresence mode="wait">
          
          {/* ====== HOME CONTROL CENTER ====== */}
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-xs font-bold text-fuchsia-400 uppercase tracking-widest font-mono">
                    {trans('welcome.back')}
                  </span>
                  <h2 className="text-3xl font-black tracking-tight mt-1 bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-100 to-indigo-400">
                    {avatarUrl} Commander, {nickname}
                  </h2>
                </div>
                <div className="text-xs text-zinc-500 font-mono hidden sm:block">
                  Orbital Cycle: {new Date().toLocaleDateString()}
                </div>
              </div>

              {/* Dynamic stats dashboards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Dial progress widget */}
                <div className={`p-6 rounded-3xl relative overflow-hidden transition-all duration-300 hover:scale-[1.01] ${activeTheme.glowClass} bg-slate-900/60 border border-white/5`}>
                  <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 font-mono">
                          {trans('goal.title')}
                        </p>
                        <p className="text-4xl font-black font-mono mt-2 tracking-tight text-white">
                          {userStats.dailyProgress} <span className="text-lg text-indigo-300 font-medium">/ {userStats.dailyGoal}</span>
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-white font-mono font-black text-sm">
                        {Math.round((userStats.dailyProgress / userStats.dailyGoal) * 100)}%
                      </div>
                    </div>

                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-indigo-400 to-fuchsia-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((userStats.dailyProgress / userStats.dailyGoal) * 100, 100)}%` }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Master Count display */}
                <div className={`p-6 rounded-3xl relative flex justify-between items-center transition-all duration-300 hover:scale-[1.01] ${activeTheme.cardClass}`}>
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest font-mono block">
                      {trans('stats.learned')}
                    </span>
                    <p className="text-3xl font-black font-mono tracking-tight">{userStats.learned}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">Synaptic storage indices active</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                </div>

                {/* Fire Streak Card */}
                <div className={`p-6 rounded-3xl relative flex justify-between items-center transition-all duration-300 hover:scale-[1.01] ${activeTheme.cardClass}`}>
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest font-mono block">
                      {trans('stats.streak')}
                    </span>
                    <p className="text-3xl font-black font-mono tracking-tight">
                      {userStats.streak} <span className="text-sm font-sans font-bold text-zinc-400">{trans('stats.days')}</span>
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono">Sustained discipline intact</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                    <Flame className="w-6 h-6 animate-pulse" />
                  </div>
                </div>

              </div>

              {/* Omni-Symmetrical Audio-Visual Laboratory */}
              <div className="space-y-3.5 pt-4 animate-fade-in">
                <h3 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400 px-1">
                  Omni-Dimensional Audio-Visual Labs
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  {/* Cyber Walkman Card */}
                  <div
                    onClick={() => {
                      setActiveTab('walkman');
                      window.speechSynthesis.cancel();
                    }}
                    className={`p-6 rounded-3xl ${activeTheme.cardClass} hover:border-indigo-500/25 border border-white/5 cursor-pointer hover:scale-[1.01] transition-all duration-300 group`}
                  >
                    <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl w-fit mb-4">
                      <Volume2 className="w-5.5 h-5.5 animate-pulse" />
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-100 group-hover:text-indigo-400 transition-colors">
                      Cyber Walkman (随身听单词播放)
                    </h4>
                    <p className="text-xs text-zinc-500 mt-2 font-mono leading-relaxed">
                      Continuous loop English recital engine featuring dual-language translation speech queues and cassette rotating reel deck.
                    </p>
                  </div>

                  {/* Interactive Subtitles Video Card */}
                  <div
                    onClick={() => {
                      setActiveTab('subtitles');
                      window.speechSynthesis.cancel();
                    }}
                    className={`p-6 rounded-3xl ${activeTheme.cardClass} hover:border-fuchsia-500/25 border border-white/5 cursor-pointer hover:scale-[1.01] transition-all duration-300 group`}
                  >
                    <div className="p-3 bg-fuchsia-500/10 text-fuchsia-400 rounded-2xl w-fit mb-4">
                      <Play className="w-5.5 h-5.5" />
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-100 group-hover:text-fuchsia-400 transition-colors">
                      Interactive Subtitles (英文字幕学习)
                    </h4>
                    <p className="text-xs text-zinc-500 mt-2 font-mono leading-relaxed">
                      Video simulated viewport: click any index word inside active subtitle line to query instant definitions.
                    </p>
                  </div>

                  {/* Bilingual Cosmos Recital Room Card */}
                  <div
                    onClick={() => {
                      setActiveTab('bilingual');
                      window.speechSynthesis.cancel();
                    }}
                    className={`p-6 rounded-3xl ${activeTheme.cardClass} hover:border-amber-500/25 border border-white/5 cursor-pointer hover:scale-[1.01] transition-all duration-300 group`}
                  >
                    <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl w-fit mb-4">
                      <Languages className="w-5.5 h-5.5 text-amber-400" />
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-100 group-hover:text-amber-400 transition-colors">
                      Bilingual Recital (双语对照朗读)
                    </h4>
                    <p className="text-xs text-zinc-500 mt-2 font-mono leading-relaxed">
                      Proportional target-to-native speech synthesizer compared loops, syllable breakdowns, and customizable reading orders.
                    </p>
                  </div>

                  {/* Telemetry Stats Card */}
                  <div
                    onClick={() => {
                      setActiveTab('stats');
                      window.speechSynthesis.cancel();
                    }}
                    className={`p-6 rounded-3xl ${activeTheme.cardClass} hover:border-emerald-500/25 border border-white/5 cursor-pointer hover:scale-[1.01] transition-all duration-300 group`}
                  >
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl w-fit mb-4">
                      <BarChart2 className="w-5.5 h-5.5" />
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-100 group-hover:text-emerald-400 transition-colors">
                      Precision Stats Board (学习统计面板)
                    </h4>
                    <p className="text-xs text-zinc-500 mt-2 font-mono leading-relaxed">
                      Track active focus mins stats, browse thematic mastery meters and play forgetting curve recall simulators.
                    </p>
                  </div>

                </div>
              </div>

              {/* Quantum Recitation Portal modes */}
              <div className="space-y-3.5 pt-4">
                <h3 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400 px-1">
                  Cognitive Accelerator Subsystems
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {([
                    { id: 'study', title: trans('modes.flashcards'), desc: 'Spaced neural grids flip cards', color: 'border-fuchsia-500/25 text-fuchsia-400', bg: 'bg-fuchsia-500/5' },
                    { id: 'quiz', title: trans('modes.quiz'), desc: 'Spelling target validation arena', color: 'border-emerald-500/25 text-emerald-400', bg: 'bg-emerald-500/5' },
                    { id: 'listening', title: trans('modes.listening'), desc: 'Auditory sub-conscious play streams', color: 'border-amber-500/25 text-amber-400', bg: 'bg-amber-500/5' },
                    { id: 'reading', title: trans('modes.reading'), desc: 'Synthesized context helper stream', color: 'border-blue-500/25 text-blue-400', bg: 'bg-blue-500/5' }
                  ] as const).map(mode => (
                    <div
                      key={mode.id}
                      onClick={() => {
                        setSelectedPracticeGroup(gGroups[0] || null);
                        if (gGroups[0]) {
                          setCourseWords(getFallbackDataset(gGroups[0].id));
                        }
                        setActiveTab('practice');
                        startModePractice(mode.id);
                      }}
                      className="p-5 rounded-2xl bg-slate-900/15 border border-white/5 hover:border-indigo-500/25 hover:bg-slate-900/50 cursor-pointer group transition-all duration-300"
                    >
                      <div className={`p-3 rounded-xl w-fit mb-4 group-hover:scale-105 transition-transform ${mode.color} ${mode.bg}`}>
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-100 group-hover:text-indigo-400 transition-colors">
                        {mode.title}
                      </h4>
                      <p className="text-xs text-zinc-500 mt-1.5 font-mono">{mode.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quantum Custom Bento Box Waterfall Catalog */}
              <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center px-1">
                  <div>
                    <h3 className="text-sm font-black font-mono uppercase tracking-widest text-zinc-400">
                      QUANTUM DOSSIERS (便当盒瀑布流单词组)
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      Glassmorphic cognitive capsules with kinetic letter rain backdrops
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('shelf')}
                    className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    All Classical Packs <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Staggered Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-auto">
                  {MOCK_BENTO_GROUPS.map((group, idx) => {
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
                        {/* A. Premium Photo Backdrops ("带有背景图的界面效果") */}
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

                        {/* B. Kinetic Text Waterfall Rainfall Backdrop ("背景图文的瀑布流动态效果") */}
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

                        {/* Top Metadata Header with 一键加入 (One-click Enroll) */}
                        <div className="relative z-10 space-y-1">
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex gap-1.5 items-center">
                              <span className="text-[9px] font-black font-mono uppercase tracking-widest bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/10">
                                {group.badge}
                              </span>
                              <span className="text-[9px] font-mono uppercase tracking-wider bg-zinc-500/10 dark:bg-zinc-500/20 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-full border border-zinc-500/10" title="Language code modifier">
                                lang: {group.language || 'en'}
                              </span>
                            </div>

                            {/* One-click Enroll button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addToast(`[${group.name}] is pinned with 1-Click! Synced with your custom dashboard.`, 'success');
                              }}
                              className="px-2 py-1 text-[9px] font-mono font-bold tracking-tight uppercase bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-650 hover:to-indigo-750 text-white rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-1 cursor-pointer z-20"
                              title="Sync with 1-click"
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>一键加入</span>
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
                              <span className="font-bold text-sky-500 dark:text-indigo-300">{group.count} Lexicons Available</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-emerald-500">{progressVal}% Mastered</span>
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
            </motion.div>
          )}

          {/* ====== COURSE SHELF TAB ====== */}
          {activeTab === 'shelf' && (
            <motion.div
              key="shelf"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              className="space-y-6"
            >
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
                      <p className="text-zinc-500 text-xs">Examine pronunciations, context models and spelling maps</p>
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
                          {selectedCourse.description || 'Synthesizing standard frequency distribution curves tailored dynamically based on your neural memory footprint configuration.'}
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
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ====== PRACTICE ARENA TAB ====== */}
          {activeTab === 'practice' && (
            <motion.div
              key="practice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
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
                        onClick={() => {
                          setSelectedPracticeGroup(g);
                          setCourseWords(getFallbackDataset(g.id));
                          startModePractice('study');
                        }}
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
                                title="Speech pronunciation"
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
            </motion.div>
          )}

          {/* ====== AI COGNITIVE LAB ====== */}
          {activeTab === 'labs' && (
            <motion.div
              key="labs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6 max-w-3xl mx-auto"
            >
              <div className="text-center py-2">
                <h2 className="text-2xl font-black">{trans('lab.title')}</h2>
                <p className="text-zinc-500 text-xs font-mono">{trans('lab.sub')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Forge Form */}
                <div className={`md:col-span-2 p-6 rounded-3xl ${activeTheme.cardClass} space-y-4`}>
                  <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-indigo-400">
                    {trans('lab.addWord')}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-mono text-zinc-500">{trans('lab.wordText')}</label>
                      <input
                        type="text"
                        placeholder="e.g. Ephemeral"
                        value={newWordText}
                        onChange={(e) => setNewWordText(e.target.value)}
                        className={`w-full py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none ${activeTheme.inputClass}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-mono text-zinc-500">{trans('lab.wordTransl')}</label>
                      <input
                        type="text"
                        placeholder="e.g. 短暂的，瞬息逝去"
                        value={newWordTransl}
                        onChange={(e) => setNewWordTransl(e.target.value)}
                        className={`w-full py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none ${activeTheme.inputClass}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-mono text-zinc-500">{trans('lab.wordPhon')}</label>
                    <input
                      type="text"
                      placeholder="e.g. /ɪˈfem.ər.əl/"
                      value={newWordPhon}
                      onChange={(e) => setNewWordPhon(e.target.value)}
                      className={`w-full py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none ${activeTheme.inputClass}`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-mono text-zinc-500">{trans('lab.wordDef')}</label>
                    <textarea
                      rows={3}
                      placeholder="Context sentence or lexical mapping rules..."
                      value={newWordDef}
                      onChange={(e) => setNewWordDef(e.target.value)}
                      className={`w-full py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none resize-none ${activeTheme.inputClass}`}
                    />
                  </div>

                  <button
                    onClick={handleForgeCustomWord}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-2xl text-xs font-mono font-bold uppercase tracking-wider"
                  >
                    {trans('lab.btn')}
                  </button>
                </div>

                {/* Forged lists */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-500">Live Active Injectors</h4>
                  
                  <div className="space-y-2 max-h-[380px] overflow-y-auto no-scrollbar">
                    {courseWords.filter(w => w.id.startsWith('custom')).map(word => (
                      <div key={word.id} className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex justify-between items-center">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-indigo-400">{word.text}</p>
                          <p className="text-[10px] text-zinc-500 truncate mt-1">{word.translation}</p>
                        </div>
                        <button
                          onClick={() => {
                            setCourseWords(prev => prev.filter(w => w.id !== word.id));
                            addToast('Wiped from custom forge list', 'warning');
                          }}
                          className="p-1.5 bg-white/5 rounded-lg text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {courseWords.filter(w => w.id.startsWith('custom')).length === 0 && (
                      <div className="text-center py-12 text-xs font-mono text-zinc-600">
                        No forged words in current live catalog. Add one to see it here!
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* ====== SETTINGS PAGE TAB ====== */}
          {activeTab === 'settings' && (
            <WfNewSettings
              activeTheme={activeTheme}
              saveThemeChoice={setActiveThemeId}
              lang={shellLang}
              setLang={setShellLang}
              userStats={userStats}
              setUserStats={setUserStats}
              nickname={nickname}
              setNickname={setNickname}
              avatarUrl={avatarUrl}
              setAvatarUrl={setAvatarUrl}
              speechRate={speechRate}
              setSpeechRate={setSpeechRate}
              onClearCache={handleClearEverything}
              trans={trans}
            />
          )}

          {/* ====== CYBERNETIC WALKMAN RECITAL TAB ====== */}
          {activeTab === 'walkman' && (
            <motion.div
              key="walkman"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setActiveTab('home');
                      window.speechSynthesis.cancel();
                    }}
                    className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Virtual Cyber Walkman (随身听)</h2>
                    <p className="text-zinc-500 text-xs font-mono">Simulated magnetic tape English speech loops with translation queue</p>
                  </div>
                </div>
              </div>
              <WfNewWalkman 
                activeTheme={activeTheme} 
                courseWords={courseWords} 
                addToast={addToast} 
                lang={shellLang} 
              />
            </motion.div>
          )}

          {/* ====== INTERACTIVE SUBTITLES TRACK VIEW ====== */}
          {activeTab === 'subtitles' && (
            <motion.div
              key="subtitles"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setActiveTab('home');
                      window.speechSynthesis.cancel();
                    }}
                    className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Interactive Subtitles Playroom (英文字幕播放学习)</h2>
                    <p className="text-zinc-500 text-xs font-mono">Interact with streaming lessons, highlight and look up words on click</p>
                  </div>
                </div>
              </div>
              <WfNewSubtitles 
                activeTheme={activeTheme} 
                favorites={favorites} 
                onToggleFavorite={handleToggleFavorite} 
                addToast={addToast} 
              />
            </motion.div>
          )}

          {/* ====== BILINGUAL COSMOS RECITAL VIEW ====== */}
          {activeTab === 'bilingual' && (
            <motion.div
              key="bilingual"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setActiveTab('home');
                      window.speechSynthesis.cancel();
                    }}
                    className="p-1.5 md:p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-305 border border-white/5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Bilingual Cosmos Recital (双语对照朗读学习)</h2>
                    <p className="text-zinc-500 text-xs font-mono">Continuous dual-speech cycle reciting native translation strings & target texts</p>
                  </div>
                </div>
              </div>
              <WfNewBilingual 
                activeTheme={activeTheme} 
                addToast={addToast} 
                dark={dark} 
              />
            </motion.div>
          )}

          {/* ====== SOCIAL COOPERATIVE CORRIDOR VIEW ====== */}
          {activeTab === 'social' && (
            <motion.div
              key="social"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('home')}
                  className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
                  <span>Home</span>
                  <span>/</span>
                  <span className="text-indigo-400">Social Loop</span>
                </div>
              </div>

              <WfNewSocial
                activeTheme={activeTheme}
                addToast={addToast}
                currentUser={currentUser}
              />
            </motion.div>
          )}

          {/* ====== COGNITIVE PROFILE DASHBOARD ====== */}
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('home')}
                    className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Commander Profile Console (个人页)</h2>
                    <p className="text-zinc-500 text-xs font-mono">Customize space crest decals, track retention speeds and unlock cognitive items</p>
                  </div>
                </div>
              </div>

              <WfNewProfile
                activeTheme={activeTheme}
                addToast={addToast}
                currentUser={currentUser}
                onUpdateProfile={handleUpdateProfile}
                learnedWordsCount={courseWords.length || 72}
              />
            </motion.div>
          )}

          {/* ====== MOCK AUTHENTICATION PORTAL ====== */}
          {activeTab === 'auth' && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('home')}
                  className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
                  <span>Home</span>
                  <span>/</span>
                  <span className="text-indigo-400">Authentication Portal</span>
                </div>
              </div>

              <WfNewAuth
                activeTheme={activeTheme}
                addToast={addToast}
                currentUser={currentUser}
                onLoginSuccess={handleLoginSuccess}
                onLogout={handleLogout}
              />
            </motion.div>
          )}

          {/* ====== PRECISION STATISTICS & RETENTION CHART TAB ====== */}
          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setActiveTab('home');
                      window.speechSynthesis.cancel();
                    }}
                    className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Precision Analytics Board (智控统计盘)</h2>
                    <p className="text-zinc-500 text-xs font-mono">Aesthetic telemetry curves, active mins tracking and Ebbinghaus forgetting rate modeler</p>
                  </div>
                </div>
              </div>
              <WfNewAnalytics 
                activeTheme={activeTheme} 
                addToast={addToast} 
              />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Floating high-end search overlay dialog */}
      <WfNewSearchOverlay
        isOpen={isSearchOverlayOpen}
        onClose={() => setIsSearchOverlayOpen(false)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchResults={searchResults}
        searching={searching}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        onSelectWord={(word) => {
          setSelectedWordDetail(word);
          setIsSearchOverlayOpen(false);
        }}
        onPlayAudio={playPhoneticSpeech}
        trans={trans}
        activeTheme={activeTheme}
        dark={dark}
      />

      {/* Detailed Word modal popup */}
      <AnimatePresence>
        {selectedWordDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedWordDetail(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md p-6 rounded-3xl border border-white/10 shadow-2xl relative z-10 space-y-4 ${
                activeTheme.id === 'nordic' 
                  ? 'bg-white text-slate-800' 
                  : 'bg-slate-900 text-white'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-mono uppercase bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-bold">Lexicon index</span>
                <button
                  onClick={() => handleToggleFavorite(selectedWordDetail)}
                  className="p-1 rounded hover:bg-white/10"
                >
                  <Star className={`w-4 h-4 ${favorites.some(f => f.id === selectedWordDetail.id) ? 'fill-amber-400 text-amber-400' : 'text-zinc-400'}`} />
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-3xl font-black text-indigo-300">{selectedWordDetail.text}</h3>
                  <button
                    onClick={() => playPhoneticSpeech(selectedWordDetail)}
                    className="p-2 bg-white/5 rounded-full hover:bg-white/10"
                  >
                    <Volume2 className="w-4 h-4 text-zinc-300" />
                  </button>
                </div>
                <p className="text-xs font-mono text-zinc-500">{selectedWordDetail.phonetic}</p>
              </div>

              <p className="text-sm font-bold text-zinc-300 border-t border-b border-white/5 py-3">{selectedWordDetail.translation}</p>

              {selectedWordDetail.definition && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block">En Definition</span>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans">{selectedWordDetail.definition}</p>
                </div>
              )}

              {selectedWordDetail.example && (
                <div className="space-y-1 pt-1.5">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block">Practical Example</span>
                  <p className="text-xs font-mono italic text-zinc-400 leading-relaxed">&ldquo;{selectedWordDetail.example}&rdquo;</p>
                </div>
              )}

              <button
                onClick={() => setSelectedWordDetail(null)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-xs font-mono text-zinc-400 rounded-xl mt-2"
              >
                Close details
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Bottom Navigator dock */}
      <WfNewBottomDock
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedCourse(null);
          setPracticeMode(null);
        }}
        trans={trans}
        activeTheme={activeTheme}
        dark={dark}
      />

      {/* Dynamic 3-Step Startup Onboarding Wizard */}
      <AnimatePresence>
        {showOnboarding && (
          <WfNewOnboarding
            onComplete={handleOnboardingComplete}
            activeTheme={activeTheme}
            onSelectTheme={(themeId) => {
              setActiveThemeId(themeId);
              localStorage.setItem('wf_new_theme_id', themeId);
            }}
            onSetGoal={(goal) => {
              setUserStats(prev => ({ ...prev, dailyGoal: goal }));
            }}
          />
        )}
      </AnimatePresence>

      {/* Premium Notification Toasters */}
      <WfNewToast toasts={toasts} onDismiss={handleDismissToast} />

      </div>
    </div>
  );
};

export default WfNewApp;
