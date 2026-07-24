import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Sparkles, GraduationCap, Flame, ChevronRight, 
  Search, Volume2, Star, Settings, Check, RefreshCw, Layers, 
  CheckCircle, Play, Pause, SkipForward, ArrowRight,
  Languages, Moon, Sun, Heart, Send, Info, Trash2, ArrowLeft, RotateCw,
  BarChart2, LogIn, ShieldCheck
} from 'lucide-react';

import { useShell } from '../../shell/ShellContext';
// Single data gateway — mock vs real backend is decided ONLY by ./api/index.ts
// (swap one import line there). All data shapes come from the same TYPE surface.
import { wfNewApi, wfNewAdminApi, wfNewEndpoints, wfNewEndpointStore, WFNEW_API_HEALTH_EVENT, startSocialSse, stopSocialSse, subscribeSocial } from './api';
import type { Word, WordGroup, BentoGroup, WfNewContentGroup, WfNewContentKind, WfNewHomeContent, WfNewStatistics, WfNewLanguage, WfNewSuperAdminStatus } from './api';
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
} from './cache/WfNewContentCache';
import { wfNewSettings } from './WfNewSettingsStore';
import { WfNewHomeContent as WfNewHomeContentWidget } from './components/WfNewHomeContent';

// Modular Imports
import { UserStats, ElementTheme } from './WfNewTypes';
import { translate, getSupportedLanguages } from './WfNewLocales';
import { CUSTOM_THEMES } from './WfNewThemes';
import { WfNewSearchOverlay } from './components/WfNewSearchOverlay';
import { WfNewToast } from './components/WfNewToast';
import { wfNewNotify, useWfNewToasts } from './WfNewNotify';
import { WfNewBottomDock } from './components/WfNewBottomDock';
import { CourseBlockCard, WordRowItem } from './components/WfNewCards';
import { WfNewSettings } from './pages/WfNewSettings';

// New Custom Study Suites Pages
import { WfNewWalkman } from './pages/WfNewWalkman';
import { WfNewSubtitles } from './pages/WfNewSubtitles';
import { WfNewAnalytics } from './pages/WfNewAnalytics';
import { WfNewBilingual } from './pages/WfNewBilingual';
import { WfNewBookReader } from './pages/WfNewBookReader';
import { WfNewContentListPage } from './pages/WfNewContentListPage';
import { WfNewLibraryPage } from './pages/WfNewLibraryPage';
import { WfNewSocial } from './pages/WfNewSocial';
import { WfNewAuth } from './pages/WfNewAuth';
import { WfNewProfile } from './pages/WfNewProfile';
import { WfNewLanguages } from './pages/WfNewLanguages';
import { WfNewLearningModel } from './pages/WfNewLearningModel';
import { WfNewReviewSettings } from './pages/WfNewReviewSettings';
import { WfNewPlaybackSettings } from './pages/WfNewPlaybackSettings';
import { WfNewAbout } from './pages/WfNewAbout';
import { WfNewAdminPage } from './pages/WfNewAdminPage';
import { WfNewWordDetailModal } from './components/WfNewWordDetailModal';
import { WfNewConfirmAddLibraryModal } from './components/WfNewConfirmAddLibraryModal';
import { WfNewLabsTab } from './components/WfNewLabsTab';
import { WfNewHomeTab } from './components/WfNewHomeTab';
import { WfNewShelfTab } from './components/WfNewShelfTab';
import { WfNewPracticeTab } from './components/WfNewPracticeTab';
import { WfNewOrbs } from './components/WfNewOrbs';
import { WfNewHeader } from './components/WfNewHeader';
import { WfNewAvatarView } from './components/WfNewAvatarView';
import { WfNewHomeDashboard } from './components/WfNewHomeDashboard';
import { WfNewOnboarding } from './pages/WfNewOnboarding';
import { WfNewNavLogo } from './components/WfNewNavLogo';
import { WfNewNotificationBell } from './components/WfNewNotificationBell';
import { WfDailyReadingSection } from './components/daily-reading/WfDailyReadingSection';

import { useWfNewAppState, type WfTab } from './hooks/useWfNewAppState';

export const WfNewApp: React.FC = () => {
  const { lang: shellLang, setLang: setShellLang, dark, toggleDark } = useShell();

  const {
    activeThemeId,
    setActiveThemeId,
    activeTheme,
    activeTab,
    setActiveTabRaw,
    navStack,
    setNavStack,
    libraryRoute,
    setLibraryRoute,
    activeTabRef,
    navStackRef,
    setActiveTab,
    goBack,
    goHome,
    currentUser,
    setCurrentUser,
    disableBgBreathing,
    setDisableBgBreathing,
    toasts,
    addToast,
    nickname,
    setNickname,
    avatarUrl,
    setAvatarUrl,
    speechRate,
    setSpeechRate,
    handleUpdateProfile,
    superAdmin,
    setSuperAdmin,
    showOnboarding,
    setShowOnboarding,
    handleOnboardingComplete,
    isLoggedInRef,
    currentEndpointId,
    applyCacheScope,
    clearUserSession,
    handleLoginSuccess,
    handleLogout,
    trans,
    gGroups,
    setGGroups,
    bentoGroups,
    setBentoGroups,
    homeContent,
    setHomeContent,
    homeContentLoading,
    setHomeContentLoading,
    loadMoreInFlight,
    homeCountRef,
    bookReader,
    setBookReader,
    selectedSubtitleKey,
    setSelectedSubtitleKey,
    contentListKind,
    setContentListKind,
    selectedCourse,
    setSelectedCourse,
    courseWords,
    setCourseWords,
    wordPool,
    setWordPool,
    loading,
    setLoading,
    userStats,
    setUserStats,
    statistics,
    setStatistics,
    languageOptions,
    setLanguageOptions,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    searching,
    setSearching,
    isSearchOverlayOpen,
    setIsSearchOverlayOpen,
    favorites,
    setFavorites,
    selectedPracticeGroup,
    setSelectedPracticeGroup,
    practiceMode,
    setPracticeMode,
    practiceIndex,
    setPracticeIndex,
    isFlipped,
    setIsFlipped,
    quizScore,
    setQuizScore,
    quizStreak,
    setQuizStreak,
    quizAnswered,
    setQuizAnswered,
    selectedQuizOption,
    setSelectedQuizOption,
    quizFeedback,
    setQuizFeedback,
    isListeningPlaying,
    setIsListeningPlaying,
    listeningIntervalRef,
    readParagraph,
    setReadParagraph,
    selectedWordDetail,
    setSelectedWordDetail,
    newWordText,
    setNewWordText,
    newWordTransl,
    setNewWordTransl,
    newWordPhon,
    setNewWordPhon,
    newWordDef,
    setNewWordDef,
    loadContent,
    HOME_PER_PAGE,
    loadHomeContent,
    loadMoreGroups,
    fetchContentListPage,
    fetchContentListPageBound,
    loadVocabularyCached,
    openHomeGroup,
    handleSaveDashboard,
    handleToggleFavorite,
    playPhoneticSpeech,
    selectBookCourse,
    startGroupPractice,
    startModePractice,
    activeQuizOptions,
    handleQuizAnswer,
    proceedQuizNext,
    handleClearEverything,
    handleForgeCustomWord,
    handleAddLibraryToStudy,
    addLibraryConfirm,
    confirmAddLibraryNow,
    closeAddLibraryConfirm,
    pageHeader,
  } = useWfNewAppState({ shellLang, dark });

  return (
    <div className={dark ? 'dark' : ''}>
      <div className={`min-h-screen transition-all duration-1000 overflow-x-hidden ${activeTheme.bgClass} ${
        activeTheme.id === 'nordic' ? 'text-slate-800 dark:text-slate-100' : (dark ? 'text-slate-100' : 'text-slate-900')
      }`}>
      
      {/* Decorative Luminous Orbs with dynamic dual-mode breathability and glassmorphism */}
      <WfNewOrbs disableBgBreathing={disableBgBreathing} dark={dark} />

      {/* Header section with glass background */}
      <WfNewHeader
        activeTheme={activeTheme}
        trans={trans}
        navStack={navStack}
        goBack={goBack}
        goHome={goHome}
        pageHeader={pageHeader}
        setIsSearchOverlayOpen={setIsSearchOverlayOpen}
        setActiveTab={setActiveTab}
        activeTab={activeTab}
        currentUser={currentUser}
        superAdmin={superAdmin}
        nickname={nickname}
        avatarUrl={avatarUrl}
        addToast={addToast}
      />

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
              <WfNewHomeTab
                activeTheme={activeTheme}
                trans={trans}
                lang={shellLang}
                dark={dark}
                currentUser={currentUser}
                nickname={nickname}
                avatarUrl={avatarUrl}
                statistics={statistics}
                gGroups={gGroups}
                bentoGroups={bentoGroups}
                userStats={userStats}
                languageOptions={languageOptions}
                homeContent={homeContent}
                homeContentLoading={homeContentLoading}
                addToast={addToast}
                setActiveTab={setActiveTab}
                setContentListKind={setContentListKind}
                handleSaveDashboard={handleSaveDashboard}
                openHomeGroup={openHomeGroup}
                loadMoreGroups={loadMoreGroups}
                selectBookCourse={selectBookCourse}
                startGroupPractice={startGroupPractice}
                startModePractice={startModePractice}
                addLibraryToStudy={handleAddLibraryToStudy}
              />
            </motion.div>
          )}

          {/* ====== CONTENT LIST PAGE (full category — 20 rows/page) ====== */}
          {activeTab === 'content-list' && contentListKind && (
            <motion.div
              key="content-list"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <WfNewContentListPage
                kind={contentListKind}
                groups={homeContent[({ word: 'words', book: 'books', subtitle: 'subtitles', library: 'libraries', document: 'documents' } as const)[contentListKind]]}
                theme={activeTheme}
                trans={trans}
                onOpen={openHomeGroup}
                fetchPage={fetchContentListPageBound}
              />
            </motion.div>
          )}

          {/* ====== VOCABULARY LIBRARY WORD-BROWSER (paginated, URL-routed) ====== */}
          {activeTab === 'library' && libraryRoute && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <WfNewLibraryPage
                libraryId={libraryRoute.id}
                title={libraryRoute.title}
                language={libraryRoute.language}
                page={libraryRoute.page}
                view={libraryRoute.view}
                theme={activeTheme}
                trans={trans}
                onChangePage={(p) => setLibraryRoute((r) => (r ? { ...r, page: p } : r))}
                onChangeView={(v) => setLibraryRoute((r) => (r ? { ...r, view: v } : r))}
              />
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
              <WfNewShelfTab
                activeTheme={activeTheme}
                trans={trans}
                lang={shellLang}
                gGroups={gGroups}
                selectedCourse={selectedCourse}
                courseWords={courseWords}
                favorites={favorites}
                setSelectedCourse={setSelectedCourse}
                setCourseWords={setCourseWords}
                setSelectedPracticeGroup={setSelectedPracticeGroup}
                setActiveTab={setActiveTab}
                selectBookCourse={selectBookCourse}
                startModePractice={startModePractice}
                handleToggleFavorite={handleToggleFavorite}
                playPhoneticSpeech={playPhoneticSpeech}
                setSelectedWordDetail={setSelectedWordDetail}
              />
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
              <WfNewPracticeTab
                activeTheme={activeTheme}
                trans={trans}
                lang={shellLang}
                addToast={addToast}
                gGroups={gGroups}
                selectedPracticeGroup={selectedPracticeGroup}
                practiceMode={practiceMode}
                setPracticeMode={setPracticeMode}
                startGroupPractice={startGroupPractice}
                startModePractice={startModePractice}
                courseWords={courseWords}
                setCourseWords={setCourseWords}
                practiceIndex={practiceIndex}
                setPracticeIndex={setPracticeIndex}
                isFlipped={isFlipped}
                setIsFlipped={setIsFlipped}
                setUserStats={setUserStats}
                quizStreak={quizStreak}
                activeQuizOptions={activeQuizOptions}
                selectedQuizOption={selectedQuizOption}
                quizAnswered={quizAnswered}
                handleQuizAnswer={handleQuizAnswer}
                quizFeedback={quizFeedback}
                proceedQuizNext={proceedQuizNext}
                isListeningPlaying={isListeningPlaying}
                setIsListeningPlaying={setIsListeningPlaying}
                readParagraph={readParagraph}
                setSelectedWordDetail={setSelectedWordDetail}
                playPhoneticSpeech={playPhoneticSpeech}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
              />
            </motion.div>
          )}

          {/* ====== AI COGNITIVE LAB (body extracted to WfNewLabsTab) ====== */}
          {activeTab === 'labs' && (
            <motion.div key="labs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <WfNewLabsTab
                activeTheme={activeTheme}
                trans={trans}
                courseWords={courseWords}
                newWordText={newWordText}
                setNewWordText={setNewWordText}
                newWordTransl={newWordTransl}
                setNewWordTransl={setNewWordTransl}
                newWordPhon={newWordPhon}
                setNewWordPhon={setNewWordPhon}
                newWordDef={newWordDef}
                setNewWordDef={setNewWordDef}
                onForge={handleForgeCustomWord}
                onRemoveCustom={(id) => {
                  setCourseWords((prev) => prev.filter((w) => w.id !== id));
                  addToast(trans('toast.wipedForge'), 'warning');
                }}
                onOpenDailyReading={() => setActiveTab('daily-reading')}
              />
            </motion.div>
          )}

          {/* ====== SETTINGS PAGE TAB ====== */}
          {activeTab === 'settings' && (
            <WfNewSettings
              activeTheme={activeTheme}
              saveThemeChoice={(id) => { setActiveThemeId(id); wfNewSettings.setField('themeId', id); }}
              lang={shellLang}
              setLang={setShellLang}
              dark={dark}
              toggleDark={toggleDark}
              userStats={userStats}
              setUserStats={setUserStats}
              nickname={nickname}
              setNickname={setNickname}
              avatarUrl={avatarUrl}
              setAvatarUrl={setAvatarUrl}
              speechRate={speechRate}
              setSpeechRate={setSpeechRate}
              onClearCache={handleClearEverything}
              onOpenLanguages={() => setActiveTab('languages')}
              onOpenLearningModel={() => setActiveTab('learning-model')}
              onOpenPlaybackSettings={() => setActiveTab('playback')}
              onOpenLabs={() => setActiveTab('labs')}
              onOpenAbout={() => setActiveTab('about')}
              onOpenAdmin={() => setActiveTab('admin')}
              isSuperAdmin={!!superAdmin?.enabled}
              isLoggedIn={currentUser.isLoggedIn}
              trans={trans}
            />
          )}

          {/* ====== ABOUT TAB ====== */}
          {activeTab === 'about' && (
            <motion.div
              key="about"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <WfNewAbout activeTheme={activeTheme} trans={trans} />
            </motion.div>
          )}

          {/* ====== SUPER-ADMIN CONSOLE (loopback local-management mode) ====== */}
          {activeTab === 'admin' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <WfNewAdminPage
                activeTheme={activeTheme}
                trans={trans}
                addToast={addToast}
                superAdmin={superAdmin}
                onOpenLibrary={(id, title, language) => {
                  // Reuse the existing dedicated word-browser page for drilling
                  // into a library (same surface home cards open).
                  setLibraryRoute({ id, page: 1, view: 'dash', title, language });
                  setActiveTab('library');
                }}
              />
            </motion.div>
          )}

          {/* ====== LEARNING LANGUAGES TAB (native + multi-target) ====== */}
          {activeTab === 'languages' && (
            <motion.div
              key="languages"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <WfNewLanguages
                activeTheme={activeTheme}
                trans={trans}
                addToast={addToast}
                onSaved={(sel) => {
                  wfNewSettings.setField('settingNativeLang', sel.native_language);
                  if (sel.learning_languages[0]) {
                    wfNewSettings.setField('settingTargetLang', sel.learning_languages[0]);
                  }
                }}
              />
            </motion.div>
          )}

          {/* ====== LEARNING MODEL (memorization mode + walkman params) ====== */}
          {activeTab === 'learning-model' && (
            <motion.div key="learning-model" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <WfNewLearningModel
                activeTheme={activeTheme}
                trans={trans}
                onOpenReview={() => setActiveTab('review-settings')}
              />
            </motion.div>
          )}

          {/* ====== REVIEW SETTINGS (sub-page of Learning Model) ====== */}
          {activeTab === 'review-settings' && (
            <motion.div key="review-settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <WfNewReviewSettings activeTheme={activeTheme} trans={trans} />
            </motion.div>
          )}

          {/* ====== PLAYBACK SETTINGS (subtitle player prefs, sub-page of Settings) ====== */}
          {activeTab === 'playback' && (
            <motion.div key="playback" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <WfNewPlaybackSettings activeTheme={activeTheme} trans={trans} />
            </motion.div>
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
              <WfNewWalkman
                activeTheme={activeTheme} 
                courseWords={courseWords} 
                addToast={addToast}
                trans={trans}
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
              <WfNewSubtitles
                activeTheme={activeTheme}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                addToast={addToast}
                sourceKey={selectedSubtitleKey}
                onOpenPlaybackSettings={() => setActiveTab('playback')}
                trans={trans}
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
              <WfNewBilingual
                activeTheme={activeTheme}
                addToast={addToast}
                trans={trans}
                dark={dark}
              />
            </motion.div>
          )}

          {/* ====== DAILY BILINGUAL ARTICLES (Pycore publish, Laravel authority) ====== */}
          {activeTab === 'daily-reading' && (
            <motion.div
              key="daily-reading"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <WfDailyReadingSection
                theme={activeTheme}
                trans={trans}
                routeMode
                onOpenBook={(sourceKey, title) => openHomeGroup({
                  id: sourceKey,
                  kind: 'book',
                  sourceKey,
                  title,
                  count: 0,
                  countUnit: 'sentences',
                  category: 'agent_history',
                })}
              />
            </motion.div>
          )}

          {/* ====== BOOK READER (book -> chapter -> bilingual verses) ====== */}
          {activeTab === 'book-reader' && bookReader && (
            <motion.div
              key="book-reader"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <WfNewBookReader
                sourceKey={bookReader.sourceKey}
                title={bookReader.title}
                activeTheme={activeTheme}
                trans={trans}
                dark={dark}
                addToast={addToast}
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
              <WfNewSocial
                activeTheme={activeTheme}
                addToast={addToast}
                trans={trans}
                currentUser={currentUser}
                onRequireAuth={() => setActiveTab('auth')}
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
              <WfNewProfile
                activeTheme={activeTheme}
                addToast={addToast}
                trans={trans}
                currentUser={currentUser}
                onUpdateProfile={handleUpdateProfile}
                onAvatarUpdated={(url) => {
                  // The upload already persisted to the backend — reflect it
                  // immediately everywhere (top-right chip + big avatar + store)
                  // without needing a separate profile Save.
                  setAvatarUrl(url);
                  wfNewSettings.setField('avatar', url);
                  setCurrentUser(prev => ({ ...prev, avatar: url }));
                }}
                onLogin={() => setActiveTab('auth')}
                onLogout={handleLogout}
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
              <WfNewAuth
                activeTheme={activeTheme}
                addToast={addToast}
                trans={trans}
                lang={shellLang}
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
              <WfNewAnalytics
                activeTheme={activeTheme}
                addToast={addToast}
                trans={trans}
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

      {/* Detailed Word modal popup (extracted to WfNewWordDetailModal) */}
      <WfNewWordDetailModal
        word={selectedWordDetail}
        activeTheme={activeTheme}
        isFavorite={!!selectedWordDetail && favorites.some((f) => f.id === selectedWordDetail.id)}
        onClose={() => setSelectedWordDetail(null)}
        onToggleFavorite={handleToggleFavorite}
        onPlay={playPhoneticSpeech}
      />

      {/* Confirm "add library to Default Vocabulary Group" dialog */}
      <WfNewConfirmAddLibraryModal
        open={!!addLibraryConfirm}
        groupTitle={addLibraryConfirm?.group.title ?? ''}
        loading={!!addLibraryConfirm?.loading}
        submitting={!!addLibraryConfirm?.submitting}
        preview={addLibraryConfirm?.preview ?? null}
        error={addLibraryConfirm?.error ?? null}
        onCancel={closeAddLibraryConfirm}
        onConfirm={confirmAddLibraryNow}
        trans={trans}
      />

      {/* Floating Bottom Navigator dock */}
      <WfNewBottomDock
        activeTab={activeTab}
        setActiveTab={(tab) => {
          // Dock Home is a direct "go home" (clears history); other dock tabs are
          // forward navigations that push onto the stack.
          if (tab === 'home') goHome();
          else setActiveTab(tab as WfTab);
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
            trans={trans}
            activeTheme={activeTheme}
            onSelectTheme={(themeId) => {
              setActiveThemeId(themeId);
              wfNewSettings.setField('themeId', themeId);
              // Roam the theme choice in the backend's opaque app_settings blob.
              void wfNewApi.updatePreferences({ app_settings: { themeId } }).catch(() => {});
            }}
            onSetGoal={(goal) => {
              setUserStats(prev => ({ ...prev, dailyGoal: goal }));
              wfNewSettings.setField('dailyGoal', goal);
              // Roam the daily goal in the backend preferences.
              void wfNewApi.updatePreferences({ daily_goal: goal }).catch(() => {});
            }}
          />
        )}
      </AnimatePresence>

      {/* Premium Notification Toasters */}
      <WfNewToast toasts={toasts} onDismiss={wfNewNotify.dismiss} />

      </div>
    </div>
  );
};

export default WfNewApp;
