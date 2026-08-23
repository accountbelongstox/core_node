import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { useShell } from '../../shell/ShellContext';
import { requestAuthLogin } from '../../core/auth/AuthRequestCenter';
import { wfNewSettings } from './WfNewSettingsStore';
import { WfNewAppChrome } from './components/WfNewAppChrome';
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
import { WfNewLabsTab } from './components/WfNewLabsTab';
import { WfNewHomeTab } from './components/WfNewHomeTab';
import { WfNewShelfTab } from './components/WfNewShelfTab';
import { WfNewPracticeTab } from './components/WfNewPracticeTab';
import { WfNewOrbs } from './components/WfNewOrbs';
import { WfNewHeader } from './components/WfNewHeader';
import { WordNewDailyReadingSection } from './components/daily-reading/WordNewDailyReadingSection';
import { useWordNewQueueRuntimeLifecycle } from './services/WordNewQueueRuntime';
import { setAudioCachePaused } from './runtime-store/WfNewAudioCache';

import { useWfNewAppState } from './hooks/useWfNewAppState';

export const WfNewApp: React.FC = () => {
  const { lang: shellLang, setLang: setShellLang, dark, toggleDark } = useShell();
  const [dailyReadingPlayerOpen, setDailyReadingPlayerOpen] = useState(false);
  const handleDailyReadingPlaybackState = useCallback(
    ({ open }: { open: boolean; playing: boolean }) => setDailyReadingPlayerOpen(open),
    [],
  );
  useWordNewQueueRuntimeLifecycle();

  const appState = useWfNewAppState({ shellLang, dark });
  const {
    activeThemeId,
    setActiveThemeId,
    activeTheme,
    activeTab,
    navStack,
    libraryRoute,
    setLibraryRoute,
    setActiveTab,
    goBack,
    goHome,
    currentUser,
    setCurrentUser,
    disableBgBreathing,
    addToast,
    nickname,
    setNickname,
    avatarUrl,
    setAvatarUrl,
    speechRate,
    setSpeechRate,
    handleUpdateProfile,
    superAdmin,
    handleLoginSuccess,
    handleLogout,
    trans,
    gGroups,
    bentoGroups,
    homeContent,
    homeContentLoading,
    bookReader,
    selectedSubtitleKey,
    contentListKind,
    setContentListKind,
    selectedCourse,
    courseWords,
    setCourseWords,
    userStats,
    setUserStats,
    statistics,
    languageOptions,
    favorites,
    selectedPracticeGroup,
    setSelectedPracticeGroup,
    practiceMode,
    setPracticeMode,
    practiceIndex,
    setPracticeIndex,
    isFlipped,
    setIsFlipped,
    quizStreak,
    quizAnswered,
    selectedQuizOption,
    quizFeedback,
    isListeningPlaying,
    setIsListeningPlaying,
    readParagraph,
    setSelectedWordDetail,
    newWordText,
    setNewWordText,
    newWordTransl,
    setNewWordTransl,
    newWordPhon,
    setNewWordPhon,
    newWordDef,
    setNewWordDef,
    loadMoreGroups,
    fetchContentListPageBound,
    openHomeGroup,
    handleSaveDashboard,
    handleToggleFavorite,
    playPhoneticSpeech,
    selectBookCourse,
    openWordGroupList,
    startGroupPractice,
    startModePractice,
    activeQuizOptions,
    handleQuizAnswer,
    proceedQuizNext,
    handleClearEverything,
    handleForgeCustomWord,
    handleAddLibraryToStudy,
    pageHeader,
  } = appState;

  // Route-scoped network gate: while WfNewApp is mounted (the /wordnew route
  // is active) background audio caching runs; on unmount it PAUSES with its
  // queue/state preserved, so wordnew network activity never continues under
  // another end's route. Resuming picks the queue up where it left off.
  useEffect(() => {
    setAudioCachePaused(false);
    return () => setAudioCachePaused(true);
  }, []);

  return (
    <div className={dark ? 'dark' : ''}>
      <div className={`min-h-screen transition-all duration-1000 overflow-x-hidden ${activeTheme.bgClass} ${
        activeTheme.id === 'nordic' ? 'text-slate-800 dark:text-slate-100' : (dark ? 'text-slate-100' : 'text-slate-900')
      }`}>
      
      {/* Decorative Luminous Orbs with dynamic dual-mode breathability and glassmorphism */}
      <WfNewOrbs disableBgBreathing={disableBgBreathing} dark={dark} />

      {/* Header section with glass background */}
      {!dailyReadingPlayerOpen && (
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
      )}

      {/* Main scrolling wrapper */}
      <main className={`mx-auto max-w-7xl ${dailyReadingPlayerOpen ? 'px-0 py-0 pb-0' : 'px-4 py-8 pb-32 sm:px-8'}`}>
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
                openWordGroupList={openWordGroupList}
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
                setSelectedPracticeGroup={setSelectedPracticeGroup}
                selectBookCourse={selectBookCourse}
                handleToggleFavorite={handleToggleFavorite}
                playPhoneticSpeech={playPhoneticSpeech}
                setSelectedWordDetail={setSelectedWordDetail}
                onCloseGroup={openWordGroupList}
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
              <WordNewDailyReadingSection
                theme={activeTheme}
                trans={trans}
                routeMode
                onGoHome={goHome}
                onPlaybackStateChange={handleDailyReadingPlaybackState}
                onOpenBook={(sourceKey, title) => openHomeGroup({
                  id: sourceKey,
                  kind: 'book',
                  sourceKey,
                  title,
                  count: 0,
                  countUnit: 'sentences',
                  category: 'daily',
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
                onRequireAuth={() => requestAuthLogin({ source: 'wordnew-social', reason: 'protected-feature' })}
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
                onLogin={() => requestAuthLogin({ source: 'wordnew-profile', reason: 'protected-feature' })}
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

      <WfNewAppChrome dark={dark} state={appState} />

      </div>
    </div>
  );
};

export default WfNewApp;
