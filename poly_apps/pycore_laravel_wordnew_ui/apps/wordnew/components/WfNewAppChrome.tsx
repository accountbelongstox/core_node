import React, { lazy, Suspense, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { wfNewApi } from '../api';
import { useWfNewAppState, type WordNewTab } from '../hooks/useWfNewAppState';
import { wfNewSettings } from '../WfNewSettingsStore';
import { WfNewBottomDock } from './WfNewBottomDock';
import { WfNewConfirmAddLibraryModal } from './WfNewConfirmAddLibraryModal';
import { WfNewGlobalSearch } from './search/WfNewGlobalSearch';
import { useShell } from '../../../shell/ShellContext';
import { WfNewWordDetailModal } from './WfNewWordDetailModal';
import { WfNewOnboarding } from '../pages/WfNewOnboarding';
import { appUpdateSupported } from '../platform/capabilities/CapAppUpdate';

const WordNewUpdateBanner = lazy(() => import('./update/WordNewUpdateBanner'));

interface WfNewAppChromeProps {
  dark: boolean;
  state: ReturnType<typeof useWfNewAppState>;
}

export const WfNewAppChrome: React.FC<WfNewAppChromeProps> = ({ dark, state }) => {
  const {
    activeTab,
    activeTheme,
    addLibraryConfirm,
    closeAddLibraryConfirm,
    confirmAddLibraryNow,
    courseWords,
    favorites,
    goHome,
    handleOnboardingComplete,
    handleToggleFavorite,
    isSearchOverlayOpen,
    playPhoneticSpeech,
    practiceMode,
    selectedWordDetail,
    setActiveTab,
    setActiveThemeId,
    setIsSearchOverlayOpen,
    setPracticeMode,
    setSelectedCourse,
    setSelectedWordDetail,
    setUserStats,
    setWordGroupRouteId,
    showOnboarding,
    trans,
    currentUser,
    superAdmin,
    homeContent,
    wordPool,
    openHomeGroup,
    setNewWordText,
  } = state;
  const { lang } = useShell();

  // Global shortcut: Ctrl/Cmd+K anywhere, "/" when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOverlayOpen(true);
      } else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsSearchOverlayOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setIsSearchOverlayOpen]);

  return (
    <>
      {appUpdateSupported() && <Suspense fallback={null}><WordNewUpdateBanner trans={trans} /></Suspense>}

      <WfNewGlobalSearch
        isOpen={isSearchOverlayOpen}
        onClose={() => setIsSearchOverlayOpen(false)}
        trans={trans}
        lang={lang}
        homeContent={homeContent}
        wordPool={wordPool}
        favorites={favorites}
        isLoggedIn={currentUser.isLoggedIn}
        isSuperAdmin={!!superAdmin?.enabled}
        onOpenPage={(tab) => setActiveTab(tab)}
        onOpenContent={openHomeGroup}
        onSelectWord={setSelectedWordDetail}
        onPlayAudio={playPhoneticSpeech}
        onToggleFavorite={handleToggleFavorite}
        onForgeWord={(text) => {
          setNewWordText(text);
          setActiveTab('labs');
        }}
      />

      <WfNewWordDetailModal
        word={selectedWordDetail}
        activeTheme={activeTheme}
        isFavorite={!!selectedWordDetail && favorites.some((favorite) => favorite.id === selectedWordDetail.id)}
        onClose={() => setSelectedWordDetail(null)}
        onToggleFavorite={handleToggleFavorite}
        onPlay={playPhoneticSpeech}
      />

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

      {activeTab !== 'daily-reading' && (
        <WfNewBottomDock
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab === 'home') goHome();
            else setActiveTab(tab as WordNewTab);
            if (tab === 'shelf') setWordGroupRouteId(null);
            setSelectedCourse(null);
            setPracticeMode(null);
          }}
          trans={trans}
          activeTheme={activeTheme}
          dark={dark}
        />
      )}

      <AnimatePresence>
        {showOnboarding && (
          <WfNewOnboarding
            onComplete={handleOnboardingComplete}
            trans={trans}
            activeTheme={activeTheme}
            onSelectTheme={(themeId) => {
              setActiveThemeId(themeId);
              wfNewSettings.setField('themeId', themeId);
              void wfNewApi.updatePreferences({ app_settings: { themeId } }).catch(() => {});
            }}
            onSetGoal={(goal) => {
              setUserStats((previous) => ({ ...previous, dailyGoal: goal }));
              wfNewSettings.setField('dailyGoal', goal);
              void wfNewApi.updatePreferences({ daily_goal: goal }).catch(() => {});
            }}
          />
        )}
      </AnimatePresence>

    </>
  );
};
